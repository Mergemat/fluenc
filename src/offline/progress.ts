// Progress lives on the device. Every save is applied here first and queued; sync sends the queue
// and brings back what changed on the server. Nothing waits on the network.
import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb";

import {
  applyOperation,
  applyPatch,
  emptyLearnerState,
  type LearnerState,
  type ProgressOperation,
} from "../lib/learner-state";
import type {
  EnrollInput,
  Learner,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
  SyncResponse,
} from "../server/sync.contract";
import { learnerStateFromLegacy, legacyCacheKeys } from "./legacy-cache";

type PendingOperation = Exclude<ProgressOperation, { kind: "focus" }>;
type StoredOperation = PendingOperation & { sequence?: number };

interface Stored {
  /** The server's state as of `cursor`, without the queue. */
  base: LearnerState;
  /** The highest server change in `base`; null until the first sync. */
  cursor: number | null;
  /** The account `base` came from; null for progress only on this device. */
  learner: Learner | null;
  /** `base` with the queue applied: what the learner sees. */
  state: LearnerState;
}

interface FluencDatabase extends DBSchema {
  meta: { key: keyof Stored; value: Stored[keyof Stored] };
  queue: { key: number; value: StoredOperation };
}

/** Learner state and the moment its due queues were read; a newer moment moves due cards into review. */
export interface LearnerSnapshot {
  at: number;
  state: LearnerState;
}

const snapshotOf = (state: LearnerState): LearnerSnapshot => ({
  state,
  at: Date.now(),
});

const DATABASE = "fluenc";
const LEGACY_DATABASE = "fluenc-offline";
const CHANNEL = "fluenc-progress";

let databasePromise: Promise<IDBPDatabase<FluencDatabase>> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/** Another tab, or sync, changed progress. */
export function onProgressChange(listener: () => void) {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      for (const notify of listeners) {
        notify();
      }
    };
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const announce = () => channel?.postMessage("changed");

interface LegacyOutboxEntry {
  data: Record<string, unknown> & { eventId?: string };
  kind: PendingOperation["kind"];
}

/** When an old queued save was made, from the time it carries. */
function legacyTime(entry: LegacyOutboxEntry) {
  const { reviewedAt, enrolledAt } = entry.data;
  const at = typeof reviewedAt === "string" ? reviewedAt : enrolledAt;
  return typeof at === "string" ? at : new Date().toISOString();
}

/**
 * Progress from before accounts: the device's copy of the one shared learner, and saves not yet
 * sent. They become this device's progress and queue, sent once the learner signs in.
 */
async function readLegacyDatabase() {
  const legacy = await openDB(LEGACY_DATABASE);
  try {
    if (!legacy.objectStoreNames.contains("cache")) {
      return null;
    }
    const cache = await legacy.getAll("cache");
    const byKey = new Map(
      cache.map((entry: { key: string; value: unknown }) => [
        entry.key,
        entry.value,
      ])
    );
    const outbox: LegacyOutboxEntry[] = legacy.objectStoreNames.contains(
      "outbox"
    )
      ? await legacy.getAll("outbox")
      : [];
    let state = byKey.get("learner-v1") as LearnerState | undefined;
    const [dashboard, library, palace] = legacyCacheKeys.map((key) =>
      byKey.get(key)
    );
    if (!state && dashboard) {
      state = learnerStateFromLegacy(
        dashboard as Parameters<typeof learnerStateFromLegacy>[0],
        library as Parameters<typeof learnerStateFromLegacy>[1],
        palace as Parameters<typeof learnerStateFromLegacy>[2]
      );
    }
    if (!state) {
      return null;
    }
    const queue = outbox.map(
      ({ kind, data: { eventId, ...data } }) =>
        ({
          id: eventId ?? crypto.randomUUID(),
          at: legacyTime({ kind, data }),
          kind,
          data,
        }) as PendingOperation
    );
    return { state: { ...emptyLearnerState, ...state }, queue };
  } finally {
    legacy.close();
  }
}

async function migrateLegacyDatabase(database: IDBPDatabase<FluencDatabase>) {
  const legacy = await readLegacyDatabase().catch(() => null);
  if (legacy) {
    const transaction = database.transaction(["meta", "queue"], "readwrite");
    const meta = transaction.objectStore("meta");
    if (!(await meta.get("state"))) {
      await Promise.all([
        meta.put(legacy.state, "state"),
        meta.put(legacy.state, "base"),
        ...legacy.queue.map((operation) =>
          transaction.objectStore("queue").add(operation)
        ),
      ]);
    }
    await transaction.done;
  }
  await deleteDB(LEGACY_DATABASE).catch(() => undefined);
}

function getDatabase() {
  databasePromise ??= (async () => {
    let created = false;
    const database = await openDB<FluencDatabase>(DATABASE, 1, {
      upgrade(next) {
        created = true;
        next.createObjectStore("meta");
        next.createObjectStore("queue", {
          keyPath: "sequence",
          autoIncrement: true,
        });
      },
    });
    if (created) {
      await migrateLegacyDatabase(database);
    }
    return database;
  })().catch((error: unknown) => {
    // A failed open is not kept, so the next save tries again.
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

async function readMeta<K extends keyof Stored>(
  key: K
): Promise<Stored[K] | undefined> {
  return (await (await getDatabase()).get("meta", key)) as
    | Stored[K]
    | undefined;
}

/** What the learner sees. A device that has never saved anything starts empty. */
export async function readLearner(): Promise<LearnerSnapshot> {
  if (!isBrowser()) {
    return snapshotOf(emptyLearnerState);
  }
  return snapshotOf((await readMeta("state")) ?? emptyLearnerState);
}

/** Apply a change here and queue it for the server. */
async function save(operation: PendingOperation): Promise<LearnerSnapshot> {
  const database = await getDatabase();
  const transaction = database.transaction(["meta", "queue"], "readwrite");
  const meta = transaction.objectStore("meta");
  const current =
    ((await meta.get("state")) as LearnerState | undefined) ??
    emptyLearnerState;
  const state = applyOperation(current, operation);
  await Promise.all([
    meta.put(state, "state"),
    transaction.objectStore("queue").add(operation),
  ]);
  await transaction.done;
  announce();
  return snapshotOf(state);
}

const change = () => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
});

export function saveEnrollment(data: Omit<EnrollInput, "enrolledAt">) {
  const made = change();
  return save({
    ...made,
    kind: "enroll",
    data: { ...data, enrolledAt: made.at },
  });
}

export function saveLivingLinkOffline(data: LivingLinkInput) {
  return save({ ...change(), kind: "livingLink", data });
}

export function saveMovieOffline(data: MovieInput) {
  return save({ ...change(), kind: "movie", data });
}

export function saveReview(data: Omit<ReviewInput, "reviewedAt">) {
  const made = change();
  return save({
    ...made,
    kind: "review",
    data: { ...data, reviewedAt: made.at },
  });
}

/** Where this device is in the server's history, and the oldest changes still to send. */
export async function readOutgoing(limit: number) {
  const database = await getDatabase();
  const transaction = database.transaction(["meta", "queue"], "readonly");
  const meta = transaction.objectStore("meta");
  const [cursor, learner, queued] = await Promise.all([
    meta.get("cursor") as Promise<number | null | undefined>,
    meta.get("learner") as Promise<Learner | null | undefined>,
    transaction.objectStore("queue").getAll(undefined, limit),
  ]);
  await transaction.done;
  return {
    cursor: cursor ?? null,
    learner: learner ?? null,
    operations: queued.map(
      ({ sequence: _sequence, ...operation }) => operation
    ),
  };
}

/**
 * Take in the server's answer: drop the changes it received, bring the server's copy up to date,
 * and apply what is still queued on top. One transaction, so a save made meanwhile is kept.
 */
export async function acceptSync(
  response: SyncResponse
): Promise<LearnerSnapshot> {
  const database = await getDatabase();
  const transaction = database.transaction(["meta", "queue"], "readwrite");
  const meta = transaction.objectStore("meta");
  const queue = transaction.objectStore("queue");
  const acknowledged = new Set(response.acknowledged);
  const queued = await queue.getAll();
  const base = applyPatch(
    ((await meta.get("base")) as LearnerState | undefined) ?? emptyLearnerState,
    response.patch,
    response.reset
  );
  const remaining = queued.filter(
    (operation) => !acknowledged.has(operation.id)
  );
  const state = remaining.reduce(
    (next, operation) => applyOperation(next, operation),
    base
  );
  await Promise.all([
    ...queued.flatMap((operation) =>
      acknowledged.has(operation.id) && operation.sequence !== undefined
        ? [queue.delete(operation.sequence)]
        : []
    ),
    meta.put(base, "base"),
    meta.put(state, "state"),
    meta.put(response.cursor, "cursor"),
    meta.put(response.learner, "learner"),
  ]);
  await transaction.done;
  announce();
  return snapshotOf(state);
}

/** Forget everything on this device, such as when its learner signs out. */
export async function clearProgress(): Promise<LearnerSnapshot> {
  const database = await getDatabase();
  const transaction = database.transaction(["meta", "queue"], "readwrite");
  await Promise.all([
    transaction.objectStore("meta").clear(),
    transaction.objectStore("queue").clear(),
  ]);
  await transaction.done;
  announce();
  return snapshotOf(emptyLearnerState);
}

export async function countPending() {
  return isBrowser() ? (await getDatabase()).count("queue") : 0;
}

export async function readLearnerAccount() {
  return isBrowser() ? ((await readMeta("learner")) ?? null) : null;
}
