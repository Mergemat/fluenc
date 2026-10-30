// The learner's progress as TanStack DB collections. Each collection's synced rows are the
// device's saved rows (see store.ts): a save shows at once as an optimistic change and becomes the
// synced row once it is written, so the screen never waits on the device database or the network.
import { createCollection, type SyncConfig } from "@tanstack/react-db";

import type { UndoInput } from "../server/sync.contract";
import {
  keyOf,
  type RowChange,
  type RowKey,
  type Rows,
  type Table,
  tables,
} from "./rows";
import {
  isBrowser,
  type Memory,
  readDeviceMemory,
  readRows,
  readTable,
  type Saved,
} from "./store";

/** What this device remembers about its own reviews, as the `device` collection's one row. */
export interface DeviceRow {
  id: "device";
  reviewed: UndoInput[];
  takenBack: string[];
}

export const DEVICE = "device";

type Run<T extends object> = Parameters<SyncConfig<T, string>["sync"]>[0] & {
  /** Changes published before the first rows were read, applied once they are. */
  early: { key: string; row: T | null }[] | null;
};

/**
 * A collection whose synced rows come from the device database. `read` loads them when sync
 * starts; `publish` writes rows that were saved since.
 */
function deviceCollection<T extends object>(
  id: string,
  getKey: (row: T) => string,
  read: () => Promise<T[]>
) {
  let current: Run<T> | null = null;
  const collection = createCollection<T, string>({
    id: `progress:${id}`,
    getKey,
    startSync: true,
    // Progress is read on every screen; it stays loaded for as long as the app is open.
    gcTime: Number.POSITIVE_INFINITY,
    sync: {
      rowUpdateMode: "full",
      sync: (params) => {
        const run: Run<T> = { ...params, early: [] };
        current = run;
        // The server renders no progress; the device fills it in.
        if (!isBrowser()) {
          params.markReady();
          return () => undefined;
        }
        read().then(
          (rows) => {
            if (current !== run) {
              return;
            }
            params.begin({ snapshot: true });
            for (const value of rows) {
              params.write({ type: "insert", value });
            }
            params.commit();
            params.markReady();
            const early = run.early ?? [];
            run.early = null;
            if (early.length) {
              write(run, early);
            }
          },
          (error: unknown) => {
            if (current === run) {
              params.fail(error);
            }
          }
        );
        return () => {
          if (current === run) {
            current = null;
          }
        };
      },
    },
  });

  function write(run: Run<T>, changes: { key: string; row: T | null }[]) {
    run.begin();
    for (const { key, row } of changes) {
      // An update writes a row whether or not it is there yet.
      run.write(row ? { type: "update", value: row } : { type: "delete", key });
    }
    run.commit();
  }

  return {
    collection,
    /** Show rows that are now saved. A reset replaces every row with these. */
    publish(changes: { key: string; row: T | null }[], reset = false) {
      const run = current;
      if (!run) {
        // Sync has not started, so the rows will be read when it does.
        return;
      }
      if (run.early) {
        if (reset) {
          run.early.length = 0;
        }
        run.early.push(...changes);
        return;
      }
      if (reset) {
        run.begin();
        run.truncate();
        for (const { row } of changes) {
          if (row) {
            run.write({ type: "update", value: row });
          }
        }
        run.commit();
        return;
      }
      if (changes.length) {
        write(run, changes);
      }
    },
  };
}

const deviceRow = (memory: Memory): DeviceRow => ({ id: DEVICE, ...memory });

const tableSource = <T extends Table>(table: T) =>
  deviceCollection<Rows[T]>(table, keyOf[table], () => readTable(table));

const sources = {
  cards: tableSource("cards"),
  names: tableSource("names"),
  livingLinks: tableSource("livingLinks"),
  focus: tableSource("focus"),
};
const deviceSource = deviceCollection(
  DEVICE,
  (row: DeviceRow) => row.id,
  async () => [deviceRow(await readDeviceMemory())]
);

export const cards = sources.cards.collection;
export const names = sources.names.collection;
export const livingLinks = sources.livingLinks.collection;
export const focus = sources.focus.collection;
export const device = deviceSource.collection;

export const tableCollections = {
  cards,
  names,
  livingLinks,
  focus,
} as const;

/** Resolves once every collection holds the device's rows. */
export function progressReady() {
  return Promise.all([
    cards.preload(),
    names.preload(),
    livingLinks.preload(),
    focus.preload(),
    device.preload(),
  ]);
}

/** Show what a save or sync wrote to the device. */
export function publish(saved: Saved) {
  for (const table of tables) {
    const changes = saved.changes.filter(
      (change): change is Extract<RowChange, { table: typeof table }> =>
        change.table === table
    );
    (
      sources[table] as {
        publish: (changes: RowChange[], reset?: boolean) => void;
      }
    ).publish(changes, saved.reset);
  }
  deviceSource.publish([{ key: DEVICE, row: deviceRow(saved.memory) }]);
}

const CHANNEL = "fluenc-progress";
type Message = { reset: true } | { keys: RowKey[]; reset?: false };
let channel: BroadcastChannel | null = null;

/** Another tab saved or synced: show what it wrote, read back from the device database. */
async function receive(message: Message) {
  if (message.reset) {
    const rows = await Promise.all(
      tables.map(async (table) =>
        (await readTable(table)).map(
          (row) =>
            ({
              table,
              key: (keyOf[table] as (row: Rows[Table]) => string)(row),
              row,
            }) as RowChange
        )
      )
    );
    publish({
      changes: rows.flat(),
      memory: await readDeviceMemory(),
      reset: true,
    });
    return;
  }
  const [changes, memory] = await Promise.all([
    readRows(message.keys),
    readDeviceMemory(),
  ]);
  publish({ changes, memory });
}

const changeListeners = new Set<() => void>();

if (typeof BroadcastChannel !== "undefined" && isBrowser()) {
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<Message>) => {
    receive(event.data)
      .catch(() => undefined)
      .finally(() => {
        for (const listener of changeListeners) {
          listener();
        }
      });
  };
}

/** Tell other tabs what this one saved. */
export function announce(saved: Saved) {
  channel?.postMessage(
    saved.reset
      ? ({ reset: true } satisfies Message)
      : ({
          keys: saved.changes.map(({ table, key }) => ({ table, key })),
        } satisfies Message)
  );
}

/** Hear about saves and syncs made in other tabs. */
export function onOtherTab(listener: () => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}
