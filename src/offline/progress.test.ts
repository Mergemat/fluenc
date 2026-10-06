import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { openDB } from "idb";
import { State } from "ts-fsrs";

import { emptyLearnerState, type LearnerState } from "../lib/learner-state";
import { deriveDashboard } from "../lib/learner-views";
import { expectDefined } from "../test/expect-defined";

const stateRequest = mock(async (): Promise<LearnerState> => emptyLearnerState);
const enrollRequest = mock(async (_input: unknown): Promise<unknown> => ({}));
const reviewRequest = mock(async (_input: unknown): Promise<unknown> => ({}));
mock.module("../server/curriculum", () => ({
  getLearnerState: stateRequest,
  enrollItem: enrollRequest,
  reviewItem: reviewRequest,
  saveMovie: mock(async () => ({})),
  saveLivingLink: mock(async () => ({})),
}));

const {
  flushProgress,
  getCachedLearner,
  getOfflineLearner,
  hasPendingProgress,
  persistLearner,
  saveEnrollment,
  saveReview,
  seedLearner,
} = await import("./progress");
const { learnerQueryOptions, loadLearner } = await import("./queries");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { onLine: true },
});

const snapshot = (state: LearnerState = emptyLearnerState) => ({
  state,
  at: Date.now(),
});
const dashboard = (data: { state: LearnerState; at: number } | null) => {
  const current = expectDefined(data);
  return deriveDashboard(current.state, new Date(current.at));
};
const cardIds = (data: { state: LearnerState } | null) =>
  Object.keys(data?.state.cards ?? {});
const withStory = (story: string): LearnerState => ({
  ...emptyLearnerState,
  livingLinks: { 5: story },
});

async function clearDatabase() {
  const database = await openDB("fluenc-offline", 1);
  await database.clear("outbox");
  await database.clear("cache");
  database.close();
}

beforeEach(async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  stateRequest.mockReset().mockImplementation(async () => emptyLearnerState);
  enrollRequest.mockReset().mockImplementation(async () => ({}));
  reviewRequest.mockReset().mockImplementation(async () => ({}));
  await persistLearner(snapshot());
  await clearDatabase();
  await persistLearner(snapshot());
});

afterAll(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
  mock.restore();
});

test("a stalled server does not hold up enrollment, rating, or the next card", async () => {
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<unknown>();
  enrollRequest.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  const flush = flushProgress();
  await started.promise;
  try {
    const next = await saveEnrollment({ itemType: "sentence", itemId: "s02" });
    expect(dashboard(next).reviewQueue.map((item) => item.id)).toEqual([
      "s01",
      "s02",
    ]);
    const rated = await saveReview({
      itemType: "sentence",
      itemId: "s01",
      rating: 3,
      durationMs: 100,
    });
    expect(dashboard(rated).reviewQueue.map((item) => item.id)).toEqual([
      "s02",
    ]);
    expect(dashboard(rated).scheduledQueue[0]?.reps).toBe(1);
    expect(
      dashboard(await getCachedLearner()).reviewQueue.map((item) => item.id)
    ).toEqual(["s02"]);
    expect(
      dashboard(await getOfflineLearner()).reviewQueue.map((item) => item.id)
    ).toEqual(["s02"]);
    expect(stateRequest).not.toHaveBeenCalled();
  } finally {
    response.resolve({});
    await flush;
  }
  expect(await hasPendingProgress()).toBe(false);
  expect(enrollRequest).toHaveBeenCalledTimes(2);
  expect(reviewRequest).toHaveBeenCalledTimes(1);
});

test("a late state response cannot restore a card even after its save has synced", async () => {
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<LearnerState>();
  stateRequest.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const fetch = getOfflineLearner();
  await started.promise;
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  await flushProgress();
  expect(await hasPendingProgress()).toBe(false);
  response.resolve(emptyLearnerState);
  expect(cardIds(await fetch)).toEqual(["sentence:s01"]);
  expect(cardIds(await getCachedLearner())).toEqual(["sentence:s01"]);
});

test("failed sync retains ordered operations and retries the same review event", async () => {
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  await saveReview({
    itemType: "sentence",
    itemId: "s01",
    rating: 4,
    durationMs: 100,
  });
  reviewRequest.mockRejectedValueOnce(
    new Error("Connection lost after sending")
  );
  expect(await flushProgress()).toBe(1);
  expect(await hasPendingProgress()).toBe(true);
  expect(dashboard(await getCachedLearner()).reviewQueue).toHaveLength(0);
  expect(await flushProgress()).toBe(1);
  expect(reviewRequest.mock.calls[0]).toEqual(reviewRequest.mock.calls[1]);
  expect(await hasPendingProgress()).toBe(false);
});

test("concurrent local saves and a stale persisted snapshot do not lose progress", async () => {
  await Promise.all([
    saveEnrollment({ itemType: "sentence", itemId: "s01" }),
    saveEnrollment({ itemType: "sentence", itemId: "s02" }),
  ]);
  await persistLearner(snapshot());
  expect(cardIds(await getCachedLearner()).sort()).toEqual([
    "sentence:s01",
    "sentence:s02",
  ]);
});

test("offline saves advance locally and can be synchronized after reconnecting", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  await saveReview({
    itemType: "sentence",
    itemId: "s01",
    rating: 1,
    durationMs: 100,
  });
  expect(await flushProgress()).toBe(0);
  const waiting = dashboard(await getOfflineLearner());
  expect(waiting.reviewQueue).toHaveLength(0);
  expect(waiting.scheduledQueue.map((item) => item.id)).toEqual(["s01"]);
  expect(Date.parse(expectDefined(waiting.nextReviewAt))).toBeGreaterThan(
    Date.now()
  );
  expect(enrollRequest).not.toHaveBeenCalled();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  expect(await flushProgress()).toBe(2);
});

test("cancelled requests cannot write their response into the offline cache", async () => {
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<LearnerState>();
  stateRequest.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const controller = new AbortController();
  const fetch = getOfflineLearner(controller.signal);
  const rejected = fetch.catch((error: unknown) => error);
  await started.promise;
  controller.abort();
  response.resolve(withStory("late"));
  expect(await rejected).toBeInstanceOf(Error);
  expect((await getCachedLearner())?.state.livingLinks).toEqual({});
});

test("cold offline startup restores the last synced state without contacting the server", async () => {
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  await saveReview({
    itemType: "sentence",
    itemId: "s01",
    rating: 3,
    durationMs: 100,
  });
  await flushProgress();
  expect(await hasPendingProgress()).toBe(false);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });
  const client = new QueryClient();
  try {
    await loadLearner(client);
    const restored = dashboard(
      client.getQueryData(learnerQueryOptions.queryKey) ?? null
    );
    expect(restored.reviewQueue).toHaveLength(0);
    expect(restored.scheduledQueue[0]?.id).toBe("s01");
    expect(stateRequest).not.toHaveBeenCalled();
  } finally {
    client.clear();
  }
});

test("cold startup opens cached lessons while a network refresh is still pending", async () => {
  await persistLearner(snapshot(withStory("cached")));
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<LearnerState>();
  stateRequest.mockImplementationOnce(() => {
    started.resolve();
    return response.promise;
  });
  const client = new QueryClient();
  try {
    await loadLearner(client);
    await started.promise;
    expect(
      client.getQueryData(learnerQueryOptions.queryKey)?.state.livingLinks[5]
    ).toBe("cached");
    expect(client.isFetching()).toBe(1);
    response.resolve(withStory("fresh"));
    await client.fetchQuery(learnerQueryOptions);
    expect(
      client.getQueryData(learnerQueryOptions.queryKey)?.state.livingLinks[5]
    ).toBe("fresh");
  } finally {
    response.resolve(emptyLearnerState);
    client.clear();
  }
});

test("seeding stores learner state only when none is cached", async () => {
  await clearDatabase();
  await seedLearner(snapshot(withStory("seeded")));
  await seedLearner(snapshot(withStory("ignored")));
  expect((await getCachedLearner())?.state.livingLinks[5]).toBe("seeded");
});

test("progress cached by an older version migrates to learner state, even offline", async () => {
  await clearDatabase();
  const card = {
    due: "2026-09-24T16:00:00.000Z",
    stability: 3,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 2,
    lapses: 0,
    state: State.Review,
    lastReview: "2026-09-23T02:00:00.000Z",
  };
  const database = await openDB("fluenc-offline", 1);
  await database.put("cache", {
    key: "lessons-v3:dashboard",
    value: {
      reviewQueue: [],
      lockedWords: [],
      scheduledQueue: [{ type: "sentence", id: "s01", card }],
      buildQueue: [
        {
          type: "character",
          id: "马",
          movie: {
            actorKey: "m",
            actorName: "Mia",
            finalKey: "a",
            setName: "Garden",
            tone: 3,
            roomName: "Bedroom",
            components: [{ hanzi: "马", propName: "horse" }],
          },
        },
      ],
    },
  });
  await database.put("cache", {
    key: "lessons-v3:library",
    value: { words: [{ id: "5", livingLink: "we stand together" }] },
  });
  database.close();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });

  const migrated = await getCachedLearner();
  expect(migrated?.state).toEqual({
    cards: { "sentence:s01": card },
    actors: { m: "Mia" },
    sets: { a: "Garden" },
    rooms: {},
    props: { 马: "horse" },
    livingLinks: { 5: "we stand together" },
  });
  const reopened = await openDB("fluenc-offline", 1);
  expect(await reopened.getAllKeys("cache")).toEqual(["learner-v1"]);
  reopened.close();
});

test("without local state, unsynced saves are replayed on the server state", async () => {
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  const database = await openDB("fluenc-offline", 1);
  await database.clear("cache");
  database.close();
  stateRequest.mockImplementationOnce(async () => withStory("remote"));
  const restored = await getOfflineLearner();
  expect(cardIds(restored)).toEqual(["sentence:s01"]);
  expect(restored.state.livingLinks[5]).toBe("remote");
});
