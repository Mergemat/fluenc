// Progress lives on the device, as rows. `state` is what the learner sees: the server's rows
// (`base`) with the changes still queued for it applied on top. Each save and each sync answer is
// one transaction over just the rows it touches, so a save made during a sync is never lost.
import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerPatch,
  type LearnerState,
  type ProgressOperation,
} from "../lib/learner-state";
import {
  learnerStateFromLegacy,
  legacyCacheKeys,
} from "../offline/legacy-cache";
import type { Learner, SyncResponse, UndoInput } from "../server/sync.contract";
import {
  allRows,
  byTable,
  changedRows,
  type RowChange,
  type RowKey,
  type Rows,
  stateOf,
  type Table,
  touchedRows,
} from "./rows";

export type PendingOperation = Exclude<ProgressOperation, { kind: "focus" }>;
type StoredOperation = PendingOperation & { sequence?: number };
type RowId = [Table, string];

/** What only this device knows: its reviews that can be taken back, and the cards taken back. */
export interface Memory {
  /** This device's reviews that can be taken back, oldest first. */
  reviewed: UndoInput[];
  /** Cards taken back and not answered again, by `cardKey`, oldest first. */
  takenBack: string[];
}

interface FluencDatabase extends DBSchema {
  /** The server's rows as of `cursor`, without the queue. */
  base: { key: RowId; value: Rows[Table] };
  /** cursor, learner, reviewed, takenBack. */
  meta: { key: string; value: unknown };
  queue: { key: number; value: StoredOperation };
  /** `base` with the queue applied: what the learner sees. */
  state: { key: RowId; value: Rows[Table] };
}

/** A change to make, worked out from what the device remembers so every tab agrees on it. */
export interface Intent {
  /** The change; null when there is nothing to do. */
  operation: (memory: Memory) => PendingOperation | null;
  /** What the device remembers after it. */
  remember?: (
    memory: Memory,
    before: LearnerState,
    operation: PendingOperation
  ) => Memory;
}

/** Rows that changed, and the device's memory after the change. */
export interface Saved {
  changes: RowChange[];
  memory: Memory;
  /** Every row is in `changes`; anything else is gone. */
  reset?: boolean;
}

/** An intent applied to the rows it touches. Saves and the screen use the same rule. */
export function applyIntent(
  intent: Intent,
  operation: PendingOperation,
  before: LearnerState,
  memory: Memory
): Saved {
  return {
    changes: changedRows(before, applyOperation(before, operation)),
    memory: intent.remember?.(memory, before, operation) ?? memory,
  };
}

const DATABASE = "fluenc";
const LEGACY_DATABASE = "fluenc-offline";
const noMemory: Memory = { reviewed: [], takenBack: [] };

let databasePromise: Promise<IDBPDatabase<FluencDatabase>> | null = null;

export function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

const rowId = ({ table, key }: RowKey): RowId => [table, key];
// Arrays sort after strings, so this covers every key in a table.
const tableRange = (table: Table) => IDBKeyRange.bound([table], [table, []]);

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
    const transaction = database.transaction(
      ["base", "state", "queue"],
      "readwrite"
    );
    const rows = allRows(legacy.state);
    await Promise.all([
      ...rows.flatMap(({ table, key, row }) => [
        transaction.objectStore("base").put(row as Rows[Table], [table, key]),
        transaction.objectStore("state").put(row as Rows[Table], [table, key]),
      ]),
      ...legacy.queue.map((operation) =>
        transaction.objectStore("queue").add(operation)
      ),
    ]);
    await transaction.done;
  }
  await deleteDB(LEGACY_DATABASE).catch(() => undefined);
}

function getDatabase() {
  databasePromise ??= (async () => {
    let created = false;
    const database = await openDB<FluencDatabase>(DATABASE, 2, {
      async upgrade(next, oldVersion, _version, transaction) {
        if (oldVersion < 1) {
          created = true;
          next.createObjectStore("meta");
          next.createObjectStore("queue", {
            keyPath: "sequence",
            autoIncrement: true,
          });
        }
        next.createObjectStore("base");
        next.createObjectStore("state");
        if (oldVersion !== 1) {
          return;
        }
        // Version 1 kept each copy of the state as one value.
        const meta = transaction.objectStore("meta");
        const [state, base] = (await Promise.all([
          meta.get("state"),
          meta.get("base"),
        ])) as (LearnerState | undefined)[];
        const write = (store: "base" | "state", value?: LearnerState) =>
          value
            ? allRows({ ...emptyLearnerState, ...value }).map(
                ({ table, key, row }) =>
                  transaction
                    .objectStore(store)
                    .put(row as Rows[Table], [table, key])
              )
            : [];
        await Promise.all([
          ...write("state", state),
          ...write("base", base ?? state),
          meta.delete("state"),
          meta.delete("base"),
        ]);
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

interface RowStore {
  get: (key: RowId) => Promise<Rows[Table] | undefined>;
  getAll: (range: IDBKeyRange) => Promise<Rows[Table][]>;
}
interface MetaStore {
  get: (key: string) => Promise<unknown>;
}

async function readMemory(meta: MetaStore): Promise<Memory> {
  const [reviewed, takenBack] = (await Promise.all([
    meta.get("reviewed"),
    meta.get("takenBack"),
  ])) as [UndoInput[] | undefined, string[] | undefined];
  return {
    reviewed: reviewed ?? noMemory.reviewed,
    takenBack: takenBack ?? noMemory.takenBack,
  };
}

/** The given rows and every focus entry, as learner state. */
async function readSlice(store: RowStore, keys: RowKey[]) {
  const [rows, focus] = await Promise.all([
    Promise.all(
      keys
        .filter((key) => key.table !== "focus")
        .map(async (key) => ({
          ...key,
          row: (await store.get(rowId(key))) ?? null,
        }))
    ),
    store.getAll(tableRange("focus")),
  ]);
  return stateOf({
    ...byTable(rows as RowChange[]),
    focus: focus as Rows["focus"][],
  });
}

interface WritableRows {
  delete: (key: RowId) => Promise<void>;
  put: (value: Rows[Table], key: RowId) => Promise<unknown>;
}

const writeRows = (store: WritableRows, changes: RowChange[]) =>
  changes.map((change) =>
    change.row
      ? store.put(change.row, rowId(change))
      : store.delete(rowId(change))
  );

/** One table's rows, as the learner sees them. */
export async function readTable<T extends Table>(table: T): Promise<Rows[T][]> {
  if (!isBrowser()) {
    return [];
  }
  return (await (
    await getDatabase()
  ).getAll("state", tableRange(table))) as Rows[T][];
}

/** These rows as they are now; missing ones come back as `row: null`. */
export async function readRows(keys: RowKey[]): Promise<RowChange[]> {
  const database = await getDatabase();
  const transaction = database.transaction("state", "readonly");
  const rows = await Promise.all(
    keys.map((key) => transaction.store.get(rowId(key)))
  );
  await transaction.done;
  return keys.map(
    (key, index) => ({ ...key, row: rows[index] ?? null }) as RowChange
  );
}

export async function readDeviceMemory(): Promise<Memory> {
  if (!isBrowser()) {
    return noMemory;
  }
  const transaction = (await getDatabase()).transaction("meta", "readonly");
  const memory = await readMemory(transaction.store);
  await transaction.done;
  return memory;
}

/** Make a change here and queue it for the server. Null when there was nothing to do. */
export async function record(intent: Intent): Promise<Saved | null> {
  const database = await getDatabase();
  const transaction = database.transaction(
    ["meta", "queue", "state"],
    "readwrite"
  );
  const meta = transaction.objectStore("meta");
  const memory = await readMemory(meta);
  const operation = intent.operation(memory);
  if (!operation) {
    await transaction.done;
    return null;
  }
  const before = await readSlice(
    transaction.objectStore("state"),
    touchedRows(operation)
  );
  const saved = applyIntent(intent, operation, before, memory);
  await Promise.all([
    ...writeRows(transaction.objectStore("state"), saved.changes),
    meta.put(saved.memory.reviewed, "reviewed"),
    meta.put(saved.memory.takenBack, "takenBack"),
    transaction.objectStore("queue").add(operation),
  ]);
  await transaction.done;
  return saved;
}

/** The server's rows in a patch; removed focus entries come back as `row: null`. */
function patchRows(patch: LearnerPatch): RowChange[] {
  const changes = allRows({
    ...emptyLearnerState,
    cards: patch.cards,
    actors: patch.actors,
    sets: patch.sets,
    rooms: patch.rooms,
    props: patch.props,
    livingLinks: patch.livingLinks,
    focus: patch.focus,
  });
  for (const key of patch.removedFocus) {
    changes.push({ table: "focus", key, row: null });
  }
  return changes;
}

const idOf = ({ table, key }: RowKey) => `${table}\u0000${key}`;

/**
 * Take in the server's answer: drop the changes it received, bring the server's rows up to date,
 * and apply what is still queued on top of the rows it changed.
 */
export async function acceptSync(response: SyncResponse): Promise<Saved> {
  const database = await getDatabase();
  const transaction = database.transaction(
    ["meta", "queue", "base", "state"],
    "readwrite"
  );
  const meta = transaction.objectStore("meta");
  const queue = transaction.objectStore("queue");
  const base = transaction.objectStore("base");
  const state = transaction.objectStore("state");
  const acknowledged = new Set(response.acknowledged);
  const [queued, memory] = await Promise.all([
    queue.getAll(),
    readMemory(meta),
  ]);
  const remaining = queued.filter(
    (operation) => !acknowledged.has(operation.id)
  );
  const patch = patchRows(response.patch);
  const writes: Promise<unknown>[] = [
    ...queued.flatMap((operation) =>
      acknowledged.has(operation.id) && operation.sequence !== undefined
        ? [queue.delete(operation.sequence)]
        : []
    ),
    meta.put(response.cursor, "cursor"),
    meta.put(response.learner, "learner"),
  ];

  let saved: Saved;
  if (response.reset) {
    // The patch is the whole account.
    const visible = remaining.reduce<LearnerState>(
      (next, operation) => applyOperation(next, operation),
      stateOf(byTable(patch))
    );
    await Promise.all([base.clear(), state.clear()]);
    saved = { changes: allRows(visible), memory, reset: true };
    writes.push(...writeRows(base, patch), ...writeRows(state, saved.changes));
  } else {
    await Promise.all(writeRows(base, patch));
    // Queued changes are applied again only to the rows the server changed under them.
    const affected = new Map(patch.map((change) => [idOf(change), change]));
    const focusChanged = patch.some((change) => change.table === "focus");
    const replay = remaining.filter(
      (operation) =>
        (focusChanged && operation.kind === "enroll") ||
        touchedRows(operation).some((key) => affected.has(idOf(key)))
    );
    const keys = new Map<string, RowKey>(
      [...patch, ...replay.flatMap(touchedRows)].map((key) => [
        idOf(key),
        { table: key.table, key: key.key },
      ])
    );
    const touched = [...keys.values()];
    const [from, before] = await Promise.all([
      readSlice(base, touched),
      readSlice(state, touched),
    ]);
    const after = replay.reduce<LearnerState>(
      (next, operation) => applyOperation(next, operation),
      from
    );
    saved = { changes: changedRows(before, after), memory };
    writes.push(...writeRows(state, saved.changes));
  }
  await Promise.all(writes);
  await transaction.done;
  return saved;
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

/** Forget everything on this device, such as when its learner signs out. */
export async function clearProgress(): Promise<Saved> {
  const database = await getDatabase();
  const transaction = database.transaction(
    ["meta", "queue", "base", "state"],
    "readwrite"
  );
  await Promise.all([
    transaction.objectStore("meta").clear(),
    transaction.objectStore("queue").clear(),
    transaction.objectStore("base").clear(),
    transaction.objectStore("state").clear(),
  ]);
  await transaction.done;
  return { changes: [], memory: noMemory, reset: true };
}

export async function countPending() {
  return isBrowser() ? (await getDatabase()).count("queue") : 0;
}

export async function readLearnerAccount() {
  return isBrowser()
    ? (((await (await getDatabase()).get("meta", "learner")) as
        | Learner
        | undefined) ?? null)
    : null;
}
