// Learner state as rows: what the device stores and what each collection holds. A change touches
// a few rows, so it is saved and shown by writing those rows rather than the whole state.
import type { FocusEntry, studyItemTypes } from "../data/types";
import { studyIdentity } from "../lib/character-words";
import {
  type CardSnapshot,
  cardKey,
  focusKey,
  type LearnerState,
  type ProgressOperation,
  parseCardKey,
} from "../lib/learner-state";

export type CardRow = CardSnapshot & {
  id: string;
  key: string;
  type: (typeof studyItemTypes)[number];
};

export const nameKinds = ["actors", "sets", "rooms", "props"] as const;
export type NameKind = (typeof nameKinds)[number];

/** An actor, set, tone room or prop the learner named; `slot` is its key in that kind. */
export interface NameRow {
  key: string;
  kind: NameKind;
  name: string;
  slot: string;
}

export interface LinkRow {
  story: string;
  wordId: string;
}

export type FocusRow = FocusEntry & { key: string };

export interface Rows {
  cards: CardRow;
  focus: FocusRow;
  livingLinks: LinkRow;
  names: NameRow;
}

export type Table = keyof Rows;
export const tables: Table[] = ["cards", "names", "livingLinks", "focus"];

/** One row as it is now; `row: null` means it is gone. */
export type RowChange = {
  [T in Table]: { key: string; row: Rows[T] | null; table: T };
}[Table];

export const nameKey = (kind: NameKind, slot: string) => `${kind}:${slot}`;

/** The key each table stores a row under. */
export const keyOf: { [T in Table]: (row: Rows[T]) => string } = {
  cards: (row) => row.key,
  names: (row) => row.key,
  livingLinks: (row) => row.wordId,
  focus: (row) => row.key,
};

export function cardRow(key: string, card: CardSnapshot): CardRow | null {
  const target = parseCardKey(key);
  return target ? { ...card, key, type: target.type, id: target.id } : null;
}

/** The card a row holds, without the fields that only exist to find it. */
export function cardOf(row: CardRow): CardSnapshot {
  const card: CardSnapshot = {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview,
  };
  if (row.introducedAt !== undefined) {
    card.introducedAt = row.introducedAt;
  }
  return card;
}

export function focusOf(row: FocusRow): FocusEntry {
  const { key: _key, ...entry } = row;
  // Collections publish their own `$` fields on rows; they are not part of an entry.
  for (const field of Object.keys(entry)) {
    if (field.startsWith("$")) {
      Reflect.deleteProperty(entry, field);
    }
  }
  return entry;
}

const byAddedAt = (left: FocusEntry, right: FocusEntry) =>
  left.addedAt < right.addedAt ? -1 : Number(left.addedAt > right.addedAt);

/** The rows in a set of changes, by table, leaving out the removed ones. */
export function byTable(changes: RowChange[]) {
  const rows: { [T in Table]: Rows[T][] } = {
    cards: [],
    names: [],
    livingLinks: [],
    focus: [],
  };
  for (const change of changes) {
    if (change.row) {
      (rows[change.table] as Rows[Table][]).push(change.row);
    }
  }
  return rows;
}

// The catalog is rebuilt for each new focus list, so an unchanged list keeps its array.
let lastFocus: FocusEntry[] = [];
function stableFocus(focus: FocusEntry[]) {
  if (JSON.stringify(focus) !== JSON.stringify(lastFocus)) {
    lastFocus = focus;
  }
  return lastFocus;
}

/** Learner state from rows; missing tables count as empty. */
export function stateOf(
  rows: {
    [T in Table]?: Iterable<Rows[T]>;
  }
): LearnerState {
  const state: LearnerState = {
    cards: {},
    focus: [],
    actors: {},
    sets: {},
    rooms: {},
    props: {},
    livingLinks: {},
  };
  for (const row of rows.cards ?? []) {
    state.cards[row.key] = cardOf(row);
  }
  for (const row of rows.names ?? []) {
    state[row.kind][row.slot] = row.name;
  }
  for (const row of rows.livingLinks ?? []) {
    state.livingLinks[row.wordId] = row.story;
  }
  state.focus = stableFocus(
    [...(rows.focus ?? [])].map(focusOf).sort(byAddedAt)
  );
  return state;
}

/** Every row a state holds, by table and key. */
function rowsIn(state: LearnerState) {
  const rows = new Map<string, RowChange>();
  const add = (change: RowChange) =>
    rows.set(`${change.table}\u0000${change.key}`, change);
  for (const [key, card] of Object.entries(state.cards)) {
    const row = cardRow(key, card);
    if (row) {
      add({ table: "cards", key, row });
    }
  }
  for (const kind of nameKinds) {
    for (const [slot, name] of Object.entries(state[kind])) {
      const key = nameKey(kind, slot);
      add({ table: "names", key, row: { key, kind, slot, name } });
    }
  }
  for (const [wordId, story] of Object.entries(state.livingLinks)) {
    add({ table: "livingLinks", key: wordId, row: { wordId, story } });
  }
  for (const entry of state.focus) {
    const key = focusKey(entry);
    add({ table: "focus", key, row: { ...entry, key } });
  }
  return rows;
}

export const allRows = (state: LearnerState) => [...rowsIn(state).values()];

const sameRow = (left: unknown, right: unknown) =>
  left === right || JSON.stringify(left) === JSON.stringify(right);

/** The rows that differ between two states: changed, added and removed. */
export function changedRows(
  before: LearnerState,
  after: LearnerState
): RowChange[] {
  const was = rowsIn(before);
  const changes: RowChange[] = [];
  for (const [id, change] of rowsIn(after)) {
    if (!sameRow(was.get(id)?.row, change.row)) {
      changes.push(change);
    }
    was.delete(id);
  }
  for (const { table, key } of was.values()) {
    changes.push({ table, key, row: null } as RowChange);
  }
  return changes;
}

export interface RowKey {
  key: string;
  table: Table;
}

/**
 * The rows a change reads or writes, besides focus, which every change may use: it adds to the
 * catalog that decides what an enroll may introduce.
 */
export function touchedRows(operation: ProgressOperation): RowKey[] {
  switch (operation.kind) {
    case "enroll":
    case "review":
    case "undo": {
      const target = studyIdentity(
        operation.data.itemType,
        operation.data.itemId
      );
      return [{ table: "cards", key: cardKey(target.itemType, target.itemId) }];
    }
    case "movie": {
      const { actorKey, finalKey, tone, props } = operation.data;
      return [
        { table: "names", key: nameKey("actors", actorKey) },
        { table: "names", key: nameKey("sets", finalKey) },
        { table: "names", key: nameKey("rooms", String(tone)) },
        ...props.map(({ component }) => ({
          table: "names" as const,
          key: nameKey("props", component),
        })),
      ];
    }
    case "livingLink":
      return [{ table: "livingLinks", key: operation.data.wordId }];
    default:
      return [];
  }
}
