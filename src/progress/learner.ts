// The learner's progress as one state, mirrored from the collections. A save replaces only the
// part it touched, so whatever reads an untouched part keeps the same value and does not render.
import { useSyncExternalStore } from "react";

import type { FocusEntry } from "../data/types";
import type { CardSnapshot, LearnerState } from "../lib/learner-state";
import { deriveDashboard } from "../lib/learner-views";
import {
  cards,
  device,
  focus,
  livingLinks,
  names,
  progressReady,
} from "./collections";
import { cardOf, type NameRow, nameKinds, stateOf } from "./rows";

/** Learner state and the moment its due queues were read; a newer moment moves due cards into review. */
export interface LearnerSnapshot {
  at: number;
  state: LearnerState;
}

let snapshot: LearnerSnapshot = { state: stateOf({}), at: Date.now() };
const listeners = new Set<() => void>();

function sameCard(left: CardSnapshot | undefined, right: CardSnapshot) {
  if (!left) {
    return false;
  }
  for (const field of Object.keys(right) as (keyof CardSnapshot)[]) {
    if (left[field] !== right[field]) {
      return false;
    }
  }
  return Object.keys(left).length === Object.keys(right).length;
}

interface Change<T> {
  type: "insert" | "update" | "delete";
  value: T;
}

/**
 * A record with the changes applied, or the same record when none changed anything: a save is
 * shown once as it is made and again once it is written, and the second changes nothing.
 */
function applied<T, V>(
  record: Record<string, V>,
  changes: Change<T>[],
  entry: (row: T) => [string, V],
  same: (left: V | undefined, right: V) => boolean = Object.is
) {
  let next: Record<string, V> | null = null;
  for (const change of changes) {
    const [slot, value] = entry(change.value);
    const current = (next ?? record)[slot];
    if (change.type === "delete") {
      if (current !== undefined) {
        next ??= { ...record };
        Reflect.deleteProperty(next, slot);
      }
    } else if (!same(current, value)) {
      next ??= { ...record };
      next[slot] = value;
    }
  }
  return next ?? record;
}

let clock: ReturnType<typeof setTimeout> | undefined;

function show(next: LearnerSnapshot) {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
  // Read again when the next card falls due, so it moves into review.
  clearTimeout(clock);
  const { nextReviewAt } = deriveDashboardOnce(next);
  if (nextReviewAt) {
    clock = setTimeout(
      () => show({ ...snapshot, at: Date.now() }),
      Math.max(
        1000,
        Math.min(Date.parse(nextReviewAt) - Date.now(), 2_147_000_000)
      )
    );
  }
}

function update(next: Partial<LearnerState>) {
  const changed = (Object.keys(next) as (keyof LearnerState)[]).some(
    (field) => next[field] !== snapshot.state[field]
  );
  if (changed) {
    show({ state: { ...snapshot.state, ...next }, at: Date.now() });
  }
}

// A handful of entries, compared whole.
const sameFocus = (left: FocusEntry[], right: FocusEntry[]) =>
  JSON.stringify(left) === JSON.stringify(right);

function mirror() {
  cards.subscribeChanges(
    (changes) =>
      update({
        cards: applied(
          snapshot.state.cards,
          changes,
          (row) => [row.key, cardOf(row)],
          sameCard
        ),
      }),
    { includeInitialState: true }
  );
  names.subscribeChanges(
    (changes) => {
      const next: Partial<LearnerState> = {};
      for (const kind of nameKinds) {
        next[kind] = applied<NameRow, string>(
          snapshot.state[kind],
          changes.filter((change) => change.value.kind === kind),
          (row) => [row.slot, row.name]
        );
      }
      update(next);
    },
    { includeInitialState: true }
  );
  livingLinks.subscribeChanges(
    (changes) =>
      update({
        livingLinks: applied(snapshot.state.livingLinks, changes, (row) => [
          row.wordId,
          row.story,
        ]),
      }),
    { includeInitialState: true }
  );
  focus.subscribeChanges(
    () => {
      // A focus list that did not change keeps its array, and with it its catalog.
      const next = stateOf({ focus: focus.toArray }).focus;
      if (!sameFocus(next, snapshot.state.focus)) {
        update({ focus: next });
      }
    },
    { includeInitialState: true }
  );
}

let opening: Promise<LearnerSnapshot> | null = null;

/** Open the device's progress; the app waits for this before it shows anything. */
export function loadLearner(): Promise<LearnerSnapshot> {
  opening ??= progressReady().then(
    () => {
      mirror();
      return snapshot;
    },
    (error: unknown) => {
      // The next attempt opens the device database again.
      opening = null;
      for (const collection of [cards, names, livingLinks, focus, device]) {
        if (collection.status === "error") {
          collection.reload();
        }
      }
      throw error;
    }
  );
  return opening;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLearner = () => snapshot;

/**
 * Read part of the learner state. The component renders again only when `select` returns
 * something new, so `select` must return the same value for the same input: a memoized view or
 * a plain value.
 */
export function useLearner<T>(select: (learner: LearnerSnapshot) => T): T {
  const read = () => select(snapshot);
  return useSyncExternalStore(subscribe, read, read);
}

/** The dashboard for a snapshot, worked out once however many readers ask for it. */
let dashboardFor: LearnerSnapshot | null = null;
let dashboard: ReturnType<typeof deriveDashboard> | null = null;
export function deriveDashboardOnce(learner: LearnerSnapshot) {
  if (learner !== dashboardFor || !dashboard) {
    dashboardFor = learner;
    dashboard = deriveDashboard(learner.state, new Date(learner.at));
  }
  return dashboard;
}
