import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import "fake-indexeddb/auto";
import { openDB } from "idb";

import {
  emptyLearnerState,
  type LearnerPatch,
  type LearnerState,
} from "../lib/learner-state";
import type { SyncResponse } from "../server/sync.contract";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator"
);
const originalFetch = globalThis.fetch;
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { onLine: true },
});

// A device from before accounts: its copy of the shared learner and one unsent review.
const legacy = await openDB("fluenc-offline", 1, {
  upgrade(database) {
    database.createObjectStore("cache", { keyPath: "key" });
    database.createObjectStore("outbox", {
      keyPath: "sequence",
      autoIncrement: true,
    });
  },
});
await legacy.put("cache", {
  key: "learner-v1",
  value: {
    ...emptyLearnerState,
    cards: {
      "sentence:s01": serverCardShape(),
      "sentence:s02": serverCardShape(),
    },
    livingLinks: { 5: "we stand together" },
  },
});
await legacy.add("outbox", {
  kind: "review",
  data: {
    eventId: "old-review-1",
    itemType: "sentence",
    itemId: "s01",
    rating: 3,
    durationMs: 0,
    reviewedAt: "2026-10-01T08:00:00.000Z",
  },
});
legacy.close();

const {
  clearProgress,
  countPending,
  readLearner,
  readOutgoing,
  saveEnrollment,
  saveReview,
} = await import("./progress");
const migrated = await readLearner();
const migratedQueue = await readOutgoing(10);
const { getSyncStatus, syncNow } = await import("./sync");

const learner = { id: "user-1", email: "learner@example.com" };
const emptyPatch: LearnerPatch = {
  cards: {},
  actors: {},
  sets: {},
  rooms: {},
  props: {},
  livingLinks: {},
  focus: [],
  removedFocus: [],
};

interface SentBody {
  cursor: number | null;
  learner: string | null;
  operations: { id: string; kind: string; data: { itemId?: string } }[];
}
const requests: SentBody[] = [];

/** A server that acknowledges what it is sent and answers with `respond`'s patch. */
function serve(
  respond: (
    body: SentBody
  ) => Partial<SyncResponse> | Promise<Partial<SyncResponse>>,
  statusCode = 200
) {
  globalThis.fetch = mock(
    async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as SentBody;
      requests.push(body);
      if (statusCode !== 200) {
        return Response.json({ error: "no" }, { status: statusCode });
      }
      const answer = await respond(body);
      return Response.json({
        learner,
        acknowledged: body.operations.map((operation) => operation.id),
        cursor: 1,
        reset: body.cursor === null,
        patch: emptyPatch,
        ...answer,
      } satisfies SyncResponse);
    }
  ) as unknown as typeof fetch;
}

const cardIds = (state: LearnerState) => Object.keys(state.cards).toSorted();
const serverCard = serverCardShape();
function serverCardShape() {
  return {
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
}

beforeEach(async () => {
  requests.length = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  await clearProgress();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  for (const [key, original] of [
    ["window", originalWindow],
    ["navigator", originalNavigator],
  ] as const) {
    if (original) {
      Object.defineProperty(globalThis, key, original);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("progress and unsent saves from before accounts carry over", () => {
  expect(cardIds(migrated.state)).toEqual(["sentence:s01", "sentence:s02"]);
  expect(migrated.state.livingLinks[5]).toBe("we stand together");
  // The old save keeps its id, so the server applies it once even if it was half sent.
  expect(migratedQueue.operations).toEqual([
    {
      id: "old-review-1",
      at: "2026-10-01T08:00:00.000Z",
      kind: "review",
      data: {
        itemType: "sentence",
        itemId: "s01",
        rating: 3,
        durationMs: 0,
        reviewedAt: "2026-10-01T08:00:00.000Z",
      },
    },
  ]);
  expect(migratedQueue.cursor).toBeNull();
});

test("a device that has never been online saves and shows progress", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });
  const saved = await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  expect(cardIds(saved.state)).toEqual(["sentence:s01"]);
  expect(cardIds((await readLearner()).state)).toEqual(["sentence:s01"]);
  expect(await countPending()).toBe(1);
  expect(await syncNow()).toBe(false);
  expect(getSyncStatus().phase).toBe("offline");
});

test("signing in sends the device's progress and adopts the account's", async () => {
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  serve(() => ({
    // The account already had a card from another device.
    patch: { ...emptyPatch, cards: { "sentence:s02": serverCard } },
  }));
  expect(await syncNow()).toBe(true);
  expect(requests[0]?.cursor).toBeNull();
  expect(requests[0]?.operations.map((operation) => operation.kind)).toEqual([
    "enroll",
  ]);
  // The server's answer is the whole account, which already includes what was sent.
  expect(cardIds((await readLearner()).state)).toEqual(["sentence:s02"]);
  expect(await countPending()).toBe(0);
  expect(getSyncStatus()).toMatchObject({ signedIn: true, learner });
});

test("a save made while a sync is on its way survives the answer", async () => {
  const answer = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  serve(async () => {
    arrived.resolve();
    await answer.promise;
    return { patch: { ...emptyPatch, cards: { "sentence:s02": serverCard } } };
  });
  const sync = syncNow();
  await arrived.promise;
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  answer.resolve();
  await sync;

  const { state } = await readLearner();
  expect(cardIds(state)).toEqual(["sentence:s01", "sentence:s02"]);
  expect(await countPending()).toBe(1);
});

test("a review saved during a sync applies on top of the server's newer card", async () => {
  serve(() => ({
    cursor: 5,
    patch: { ...emptyPatch, cards: { "sentence:s02": serverCard } },
  }));
  await syncNow();

  // Another device reviewed the card; this device reviews it while its next sync is out.
  const newer = {
    ...serverCard,
    reps: 9,
    lastReview: "2026-09-30T00:00:00.000Z",
  };
  const answer = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  serve(async () => {
    arrived.resolve();
    await answer.promise;
    return {
      cursor: 7,
      patch: { ...emptyPatch, cards: { "sentence:s02": newer } },
    };
  });
  const sync = syncNow();
  await arrived.promise;
  await saveReview({
    itemType: "sentence",
    itemId: "s02",
    rating: 3,
    durationMs: 100,
  });
  answer.resolve();
  await sync;

  expect(requests.at(-1)?.cursor).toBe(5);
  expect((await readLearner()).state.cards["sentence:s02"]?.reps).toBe(10);
  expect(await countPending()).toBe(1);
});

test("a full queue goes out in batches", async () => {
  for (let index = 0; index < 205; index += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: saves queue in the order they are made.
    await saveEnrollment({ itemType: "sentence", itemId: `s${index}` });
  }
  serve(() => ({}));
  expect(await syncNow()).toBe(true);
  expect(requests.map((request) => request.operations.length)).toEqual([
    200, 5,
  ]);
  expect(await countPending()).toBe(0);
});

test("a signed-out device keeps its progress until it signs in again", async () => {
  await saveEnrollment({ itemType: "sentence", itemId: "s01" });
  serve(() => ({}), 401);
  expect(await syncNow()).toBe(false);
  expect(getSyncStatus().signedIn).toBe(false);
  expect(await countPending()).toBe(1);
  expect(cardIds((await readLearner()).state)).toEqual(["sentence:s01"]);
});

test("progress from another account is replaced by this account's", async () => {
  serve(() => ({
    patch: { ...emptyPatch, cards: { "sentence:s09": serverCard } },
  }));
  await syncNow();
  let calls = 0;
  globalThis.fetch = mock(
    (_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body)) as SentBody;
      requests.push(body);
      if (calls === 1) {
        return Promise.resolve(
          Response.json({ error: "another account" }, { status: 409 })
        );
      }
      return Promise.resolve(
        Response.json({
          learner: { ...learner, id: "user-2" },
          acknowledged: [],
          cursor: 3,
          reset: true,
          patch: { ...emptyPatch, cards: { "sentence:s01": serverCard } },
        } satisfies SyncResponse)
      );
    }
  ) as unknown as typeof fetch;
  expect(await syncNow()).toBe(true);
  expect(requests.at(-1)).toMatchObject({ cursor: null, learner: null });
  expect(cardIds((await readLearner()).state)).toEqual(["sentence:s01"]);
});
