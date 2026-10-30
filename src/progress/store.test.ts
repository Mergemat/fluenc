import { afterAll, expect, test } from "bun:test";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";

import { emptyLearnerState } from "../lib/learner-state";

const card = {
  due: "2026-10-01T00:00:00.000Z",
  stability: 3,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 3,
  learningSteps: 0,
  reps: 4,
  lapses: 0,
  state: 2,
  lastReview: "2026-09-28T00:00:00.000Z",
  introducedAt: "2026-09-01T00:00:00.000Z",
};

// Test files share globals: this one opens its own database and puts everything back after.
const originals = ["window", "indexedDB"].map(
  (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
);
afterAll(() => {
  for (const [key, original] of originals) {
    if (original) {
      Object.defineProperty(globalThis, key, original);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("a device that saved its progress as one value keeps it, its queue and its account", async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
  const base = {
    ...emptyLearnerState,
    cards: { "sentence:s01": card },
    actors: { m: "Ana" },
  };
  // The unsent review is already applied to what the learner sees.
  const state = {
    ...base,
    cards: { ...base.cards, "sentence:s01": { ...card, reps: 5 } },
    livingLinks: { 5: "we stand together" },
  };
  const old = await openDB("fluenc", 1, {
    upgrade(database) {
      database.createObjectStore("meta");
      database.createObjectStore("queue", {
        keyPath: "sequence",
        autoIncrement: true,
      });
    },
  });
  await old.put("meta", base, "base");
  await old.put("meta", state, "state");
  await old.put("meta", 7, "cursor");
  await old.put("meta", { id: "user-1", email: "a@example.com" }, "learner");
  await old.add("queue", {
    id: "review-1",
    at: "2026-10-01T08:00:00.000Z",
    kind: "livingLink",
    data: { wordId: "5", story: "we stand together" },
  });
  old.close();

  // A copy of the store of its own, so it opens this database rather than another test's.
  const fresh = "./store.ts?v1";
  const store: typeof import("./store") = await import(fresh);
  const { stateOf } = await import("./rows");
  const [cards, names, livingLinks] = await Promise.all([
    store.readTable("cards"),
    store.readTable("names"),
    store.readTable("livingLinks"),
  ]);
  expect(stateOf({ cards, names, livingLinks })).toEqual({
    ...state,
    focus: [],
  });
  expect(await store.readOutgoing(10)).toMatchObject({
    cursor: 7,
    learner: { id: "user-1" },
    operations: [{ id: "review-1", kind: "livingLink" }],
  });

  // The server's copy is kept apart, so its answer still lands under the queued change.
  const saved = await store.acceptSync({
    acknowledged: [],
    cursor: 8,
    learner: { id: "user-1", email: "a@example.com" },
    reset: false,
    patch: {
      cards: {},
      actors: {},
      sets: {},
      rooms: {},
      props: {},
      livingLinks: { 5: "from another device" },
      focus: [],
      removedFocus: [],
    },
  });
  expect(saved.changes).toEqual([]);
  expect(
    stateOf({ livingLinks: await store.readTable("livingLinks") }).livingLinks
  ).toEqual({ 5: "we stand together" });
});
