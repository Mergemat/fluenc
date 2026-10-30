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
/** The same change made again under a new id, as if by another learner. */
const copy = (operation: ProgressOperation) => {
  counter += 1;
  return { ...operation, id: `op-${counter}` };
};
const enroll = (itemId: string, enrolledAt = "2026-10-20T08:00:00.000Z") =>
  change(
    {
      kind: "enroll",
      data: { itemType: "sentence", itemId, enrolledAt },
    },
    enrolledAt
  );
const review = (itemId: string, reviewedAt: string, rating = 3) =>
  change(
    {
      kind: "review",
      data: {
        itemType: "sentence",
        itemId,
        rating,
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
  expect(quiet.cursor).toBe(next.cursor);
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

test("a review that arrives late is scheduled as if it had arrived in order", async () => {
  const enrolled = enroll("s01", "2026-10-01T08:00:00.000Z");
  const first = review("s01", "2026-10-02T08:00:00.000Z");
  const forgot = review("s01", "2026-10-06T08:00:00.000Z", 1);
  const remembered = review("s01", "2026-10-11T08:00:00.000Z");

  await writeOperations("learner-in-order", [enrolled, first, forgot]);
  await writeOperations("learner-in-order", [remembered]);

  // The phone forgot it offline; the laptop's later review reached the server first.
  await writeOperations("learner-late", [enrolled, first].map(copy));
  await writeOperations("learner-late", [copy(remembered)]);
  const before = await readPatch("learner-late", null);
  await writeOperations("learner-late", [copy(forgot)]);

  const inOrder = await readLearnerState("learner-in-order");
  const late = await readLearnerState("learner-late");
  expect(late.cards).toEqual(inOrder.cards);
  // Devices that already synced hear about the corrected card.
  const next = await readPatch("learner-late", before.cursor);
  expect(next.patch.cards["sentence:s01"]).toEqual(
    inOrder.cards["sentence:s01"]
  );
});

test("a review taken back leaves the card as if it never happened, even when another arrives late", async () => {
  const enrolled = enroll("s01", "2026-10-01T08:00:00.000Z");
  const first = review("s01", "2026-10-02T08:00:00.000Z");
  const late = review("s01", "2026-10-01T20:00:00.000Z", 1);
  const mistaken = review("s01", "2026-10-04T08:00:00.000Z", 4);

  await writeOperations("learner-never-mistaken", [enrolled, late, first]);

  const learner = "learner-took-back";
  await writeOperations(learner, [copy(enrolled)]);
  // The device taking the review back missed the first review.
  const card = (await readLearnerState(learner)).cards["sentence:s01"];
  if (!card) {
    throw new Error("expected the card");
  }
  await writeOperations(learner, [copy(first)]);
  const before = await readLearnerState(learner);
  const mistake = copy(mistaken);
  await writeOperations(learner, [
    mistake,
    change({
      kind: "undo",
      data: { reviewId: mistake.id, itemType: "sentence", itemId: "s01", card },
    }),
  ]);
  expect(await readLearnerState(learner)).toEqual(before);

  // A review made before the mistake, by a device that was offline, still counts; the mistake does not.
  await writeOperations(learner, [copy(late)]);
  expect((await readLearnerState(learner)).cards).toEqual(
    (await readLearnerState("learner-never-mistaken")).cards
  );
});

test("a late review of the learner's own word keeps its card", async () => {
  const learner = "learner-own-word";
  // Not a course word, so only focus puts it in the learner's catalog.
  const word = { itemType: "word", itemId: "马马" } as const;
  const reviewWord = (reviewedAt: string) =>
    change(
      {
        kind: "review",
        data: { ...word, rating: 3, durationMs: 0, reviewedAt },
      },
      reviewedAt
    );
  await writeOperations(learner, [
    change({
      kind: "focus",
      data: {
        add: [
          {
            kind: "word",
            hanzi: "马马",
            pinyin: "mǎmǎ",
            meaning: "horses",
            label: "own",
            addedAt: "2026-10-01T08:00:00.000Z",
          },
        ],
      },
    }),
    change(
      {
        kind: "enroll",
        data: { ...word, enrolledAt: "2026-10-01T08:00:00.000Z" },
      },
      "2026-10-01T08:00:00.000Z"
    ),
    reviewWord("2026-10-02T08:00:00.000Z"),
    reviewWord("2026-10-11T08:00:00.000Z"),
  ]);
  // Rebuilding the card replays its enroll, which needs the catalog with focus in it.
  await writeOperations(learner, [reviewWord("2026-10-06T08:00:00.000Z")]);
  expect((await readLearnerState(learner)).cards["word:马马"]?.reps).toBe(3);
});

test("an earlier enroll that arrives late sets when the card was introduced", async () => {
  const learner = "learner-enrolled-late";
  await writeOperations(learner, [enroll("s01", "2026-10-22T08:00:00.000Z")]);
  await writeOperations(learner, [enroll("s01", "2026-10-20T08:00:00.000Z")]);
  expect(
    (await readLearnerState(learner)).cards["sentence:s01"]?.introducedAt
  ).toBe("2026-10-20T08:00:00.000Z");
});

test("a device clock running ahead cannot push a card's reviews into the future", async () => {
  const learner = "learner-fast-clock";
  const now = new Date("2026-10-21T09:00:00.000Z");
  await writeOperations(learner, [enroll("s01")], now);
  await writeOperations(
    learner,
    [review("s01", "2027-01-01T00:00:00.000Z")],
    now
  );
  const ahead = (await readLearnerState(learner)).cards["sentence:s01"];
  expect(ahead?.lastReview).toBe(now.toISOString());

  // A device with the right clock reviews it an hour later, at the time it says.
  await writeOperations(learner, [review("s01", "2026-10-21T10:00:00.000Z")]);
  const next = (await readLearnerState(learner)).cards["sentence:s01"];
  expect(next?.lastReview).toBe("2026-10-21T10:00:00.000Z");
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

test("an older name or story that arrives late does not replace a newer one", async () => {
  const learner = "learner-renamed";
  const movie = (actorName: string, at: string) =>
    change(
      {
        kind: "movie",
        data: {
          characterId: "马",
          actorKey: "m",
          actorName,
          finalKey: "a",
          setName: `${actorName}'s garden`,
          tone: 3,
          roomName: `${actorName}'s kitchen`,
          props: [{ component: "马", propName: `${actorName}'s horse` }],
        },
      },
      at
    );
  const story = (text: string, at: string) =>
    change({ kind: "livingLink", data: { wordId: "5", story: text } }, at);

  await writeOperations(learner, [
    movie("Mia", "2026-10-22T08:00:00.000Z"),
    story("we stand together", "2026-10-22T08:00:00.000Z"),
  ]);
  // Renamed on a phone two days earlier, offline until now.
  await writeOperations(learner, [
    movie("Max", "2026-10-20T08:00:00.000Z"),
    story("an old story", "2026-10-20T08:00:00.000Z"),
  ]);
  expect(await readLearnerState(learner)).toMatchObject({
    actors: { m: "Mia" },
    sets: { a: "Mia's garden" },
    rooms: { 3: "Mia's kitchen" },
    props: { 马: "Mia's horse" },
    livingLinks: { 5: "we stand together" },
  });

  await writeOperations(learner, [movie("Ana", "2026-10-23T08:00:00.000Z")]);
  expect((await readLearnerState(learner)).actors).toEqual({ m: "Ana" });
});

test("one learner never sees another's progress", async () => {
  await writeOperations("learner-e", [enroll("s02")]);
  expect(Object.keys((await readLearnerState("learner-f")).cards)).toEqual([]);
  expect(Object.keys((await readLearnerState("learner-e")).cards)).toEqual([
    "sentence:s02",
  ]);
});
