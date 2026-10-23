import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProgressOperation } from "../lib/learner-state";

// A throwaway database with every migration, standing in for Turso.
const directory = await mkdtemp(join(tmpdir(), "fluenc-sync-"));
process.env.TURSO_DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.TURSO_AUTH_TOKEN = "local";

const { db } = await import("../db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { readLearnerState, readPatch, writeOperations } = await import(
  "./sync.server"
);

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

let counter = 0;
const change = (
  operation: Omit<ProgressOperation, "id" | "at">,
  at = "2026-10-20T08:00:00.000Z"
) => {
  counter += 1;
  return { ...operation, id: `op-${counter}`, at } as ProgressOperation;
};
const enroll = (itemId: string, enrolledAt = "2026-10-20T08:00:00.000Z") =>
  change({
    kind: "enroll",
    data: { itemType: "sentence", itemId, enrolledAt },
  });
const review = (itemId: string, reviewedAt: string) =>
  change(
    {
      kind: "review",
      data: {
        itemType: "sentence",
        itemId,
        rating: 3,
        durationMs: 0,
        reviewedAt,
      },
    },
    reviewedAt
  );

test("two devices see each other's progress through incremental patches", async () => {
  const learner = "learner-a";
  await writeOperations(learner, [enroll("s01")]);
  const first = await readPatch(learner, null);
  expect(Object.keys(first.patch.cards)).toEqual(["sentence:s01"]);

  // The other device reviews it; the first device asks only for what changed since.
  await writeOperations(learner, [review("s01", "2026-10-21T08:00:00.000Z")]);
  const next = await readPatch(learner, first.cursor);
  expect(next.cursor).toBeGreaterThan(first.cursor);
  expect(next.patch.cards["sentence:s01"]?.reps).toBe(1);

  // Nothing new, nothing sent.
  const quiet = await readPatch(learner, next.cursor);
  expect(quiet.patch.cards).toEqual({});
});

test("a change sent twice is applied once", async () => {
  const learner = "learner-b";
  const enrolled = enroll("s01");
  const reviewed = review("s01", "2026-10-21T08:00:00.000Z");
  await writeOperations(learner, [enrolled, reviewed]);
  // The answer was lost, so the device sends the same changes again.
  await writeOperations(learner, [enrolled, reviewed]);
  const state = await readLearnerState(learner);
  expect(state.cards["sentence:s01"]?.reps).toBe(1);
});

test("changes the course does not have are recorded but change nothing", async () => {
  const learner = "learner-c";
  await writeOperations(learner, [
    enroll("not-a-sentence"),
    review("s01", "2026-10-21T08:00:00.000Z"),
  ]);
  expect((await readLearnerState(learner)).cards).toEqual({});
});

test("names, stories and focus sync, and a removed focus entry reaches devices", async () => {
  const learner = "learner-d";
  await writeOperations(learner, [
    change({
      kind: "movie",
      data: {
        characterId: "马",
        actorKey: "m",
        actorName: "Mia",
        finalKey: "a",
        setName: "Garden",
        tone: 3,
        roomName: "Kitchen",
        props: [{ component: "马", propName: "horse" }],
      },
    }),
    change({
      kind: "livingLink",
      data: { wordId: "5", story: "we stand together" },
    }),
    change({
      kind: "focus",
      data: {
        add: [
          {
            kind: "word",
            hanzi: "中国",
            pinyin: "zhōngguó",
            meaning: "China",
            label: "HSK 1 · L3",
            addedAt: "2026-10-20T08:00:00.000Z",
          },
        ],
      },
    }),
  ]);
  const first = await readPatch(learner, null);
  expect(first.patch).toMatchObject({
    actors: { m: "Mia" },
    sets: { a: "Garden" },
    rooms: { 3: "Kitchen" },
    props: { 马: "horse" },
    livingLinks: { 5: "we stand together" },
  });
  // The server splits the pinyin, so devices need no pinyin dictionary.
  expect(first.patch.focus[0]?.syllables).toEqual(["zhōng", "guó"]);

  await writeOperations(learner, [
    change({ kind: "focus", data: { remove: ["中国"] } }),
  ]);
  const next = await readPatch(learner, first.cursor);
  expect(next.patch.removedFocus).toEqual(["word:中国"]);
  expect((await readLearnerState(learner)).focus).toEqual([]);
  // A device syncing for the first time never hears about it.
  expect((await readPatch(learner, null)).patch.removedFocus).toEqual([]);
});

test("one learner never sees another's progress", async () => {
  await writeOperations("learner-e", [enroll("s02")]);
  expect(Object.keys((await readLearnerState("learner-f")).cards)).toEqual([]);
  expect(Object.keys((await readLearnerState("learner-e")).cards)).toEqual([
    "sentence:s02",
  ]);
});
