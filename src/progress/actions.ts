// Saves. Each one is an intent, applied to the rows on screen at once and then to the device's
// rows in one transaction; the second becomes the synced rows, so the first can be dropped.
import { createOptimisticAction, safeRandomUUID } from "@tanstack/react-db";
import { useCallback, useRef, useState } from "react";

import { studyIdentity } from "../lib/character-words";
import { cardKey, type LearnerState } from "../lib/learner-state";
import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
} from "../server/sync.contract";
import {
  announce,
  DEVICE,
  type DeviceRow,
  device,
  focus,
  publish,
  tableCollections,
} from "./collections";
import {
  byTable,
  type RowChange,
  type RowKey,
  stateOf,
  touchedRows,
} from "./rows";
import { trackSave } from "./saves";
import {
  applyIntent,
  type Intent,
  type Memory,
  type PendingOperation,
  record,
} from "./store";

/** Enough to go back through a review session; older reviews stay as they are. */
const MAX_REVIEWED = 100;

/** Rows as the screen shows them. */
function visibleSlice(keys: RowKey[]): LearnerState {
  const rows = keys.map(
    ({ table, key }) =>
      ({
        table,
        key,
        row: tableCollections[table].get(key) ?? null,
      }) as RowChange
  );
  return stateOf({ ...byTable(rows), focus: focus.toArray });
}

function visibleMemory(): Memory {
  const row = device.get(DEVICE);
  return { reviewed: row?.reviewed ?? [], takenBack: row?.takenBack ?? [] };
}

/** Write a row over a draft, so the draft ends up as exactly that row. */
function replace(draft: Record<string, unknown>, row: object) {
  for (const field of Object.keys(draft)) {
    if (!(field in row || field.startsWith("$"))) {
      Reflect.deleteProperty(draft, field);
    }
  }
  Object.assign(draft, row);
}

function showOptimistic({
  changes,
  memory,
}: {
  changes: RowChange[];
  memory: Memory;
}) {
  for (const { table, key, row } of changes) {
    const collection = tableCollections[table] as unknown as {
      delete: (key: string) => void;
      has: (key: string) => boolean;
      insert: (row: object) => void;
      update: (
        key: string,
        change: (draft: Record<string, unknown>) => void
      ) => void;
    };
    if (!row) {
      if (collection.has(key)) {
        collection.delete(key);
      }
    } else if (collection.has(key)) {
      collection.update(key, (draft) => replace(draft, row));
    } else {
      collection.insert(row);
    }
  }
  const row: DeviceRow = { id: DEVICE, ...memory };
  if (device.has(DEVICE)) {
    device.update(DEVICE, (draft) =>
      replace(draft as unknown as Record<string, unknown>, row)
    );
  } else {
    device.insert(row);
  }
}

/** Write an intent to the device and show the rows it wrote. */
async function persist(intent: Intent) {
  const saved = await record(intent);
  if (!saved) {
    return;
  }
  // The rows are saved now; nothing after this may undo what the screen shows.
  try {
    publish(saved);
    announce(saved);
  } catch (error) {
    console.error(error);
  }
}

const save = createOptimisticAction<Intent>({
  onMutate: (intent) => {
    const memory = visibleMemory();
    const operation = intent.operation(memory);
    if (operation) {
      showOptimistic(
        applyIntent(
          intent,
          operation,
          visibleSlice(touchedRows(operation)),
          memory
        )
      );
    }
  },
  mutationFn: persist,
});

/** Save an intent. Resolves once it is on the device; rejects, and undoes it, if it cannot be. */
function run(intent: Intent) {
  let saving: Promise<void>;
  try {
    const transaction = save(intent);
    // A transaction that changed nothing on screen ends without running its handler, but the
    // intent is still saved and sent: the device's rows may differ from the screen's.
    saving = transaction.mutations.length
      ? transaction.when("settled").then(() => undefined)
      : persist(intent);
  } catch (error) {
    // Callers hear about every failure the same way: the save rejects.
    saving = Promise.reject(error);
  }
  return trackSave(saving);
}

const change = () => ({
  id: safeRandomUUID(),
  at: new Date().toISOString(),
});

const once = (operation: PendingOperation): Intent => ({
  operation: () => operation,
});

export function saveEnrollment(data: Omit<EnrollInput, "enrolledAt">) {
  const made = change();
  return run(
    once({ ...made, kind: "enroll", data: { ...data, enrolledAt: made.at } })
  );
}

export function saveLivingLink(data: LivingLinkInput) {
  return run(once({ ...change(), kind: "livingLink", data }));
}

export function saveMovie(data: MovieInput) {
  return run(once({ ...change(), kind: "movie", data }));
}

/** Save a review, remembering its card as it was so the review can be taken back. */
export function saveReview(data: Omit<ReviewInput, "reviewedAt">) {
  const made = change();
  const { itemType, itemId } = studyIdentity(data.itemType, data.itemId);
  const key = cardKey(itemType, itemId);
  return run({
    operation: () => ({
      ...made,
      kind: "review",
      data: { ...data, reviewedAt: made.at },
    }),
    remember: ({ reviewed, takenBack }, before) => {
      const card = before.cards[key];
      return {
        reviewed: card
          ? [...reviewed, { reviewId: made.id, itemType, itemId, card }].slice(
              -MAX_REVIEWED
            )
          : reviewed,
        takenBack: takenBack.filter((taken) => taken !== key),
      };
    },
  });
}

/** Take back the last review saved on this device: its card returns as it was, to be answered again. */
export function takeBackReview() {
  const made = change();
  return run({
    operation: ({ reviewed }) => {
      const last = reviewed.at(-1);
      return last ? { ...made, kind: "undo", data: last } : null;
    },
    remember: ({ reviewed, takenBack }, _before, operation) => {
      if (operation.kind !== "undo") {
        return { reviewed, takenBack };
      }
      const key = cardKey(operation.data.itemType, operation.data.itemId);
      return {
        reviewed: reviewed.slice(0, -1),
        takenBack: [...takenBack.filter((taken) => taken !== key), key],
      };
    },
  });
}

interface SaveCallbacks {
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}

/** A save with its state for the screen: whether it is under way, and whether the last one failed. */
export function useSave<T = void>(saveWith: (input: T) => Promise<void>) {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  // Callers pass a new function each render; the latest one runs, and `mutate` stays the same.
  const latest = useRef(saveWith);
  latest.current = saveWith;
  const mutateAsync = useCallback(async (input: T) => {
    setState("pending");
    try {
      await latest.current(input);
      setState("idle");
    } catch (error) {
      setState("error");
      throw error;
    }
  }, []);
  const mutate = useCallback(
    (input: T, callbacks: SaveCallbacks = {}) => {
      mutateAsync(input).then(callbacks.onSuccess, (error: unknown) =>
        callbacks.onError?.(error)
      );
    },
    [mutateAsync]
  );
  return {
    mutate,
    mutateAsync,
    isPending: state === "pending",
    isError: state === "error",
  };
}
