// What screens read. The collections are mirrored into one learner state that changes only the
// part a save touched, and each view is derived from the parts it uses, once, however many
// components read it. The views are course logic over the whole catalog, not queries.
import { createLiveQueryCollection, useLiveQuery } from "@tanstack/react-db";
import { useSyncExternalStore } from "react";

import type { CardSnapshot, LearnerState } from "../lib/learner-state";
import {
  type DashboardData,
  deriveDashboard,
  deriveLibrary,
  derivePalace,
  type LibraryData,
  type PalaceData,
} from "../lib/learner-views";
import { deriveProfile, type ProfileData } from "../lib/profile";
import {
  cards,
  DEVICE,
  device,
  focus,
  livingLinks,
  names,
  progressReady,
} from "./collections";
import { cardOf, type FocusRow, type NameRow, stateOf } from "./rows";

/** Learner state and the moment its due queues were read; a newer moment moves due cards into review. */
export interface LearnerSnapshot {
  at: number;
  state: LearnerState;
}

let snapshot: LearnerSnapshot = { state: stateOf({}), at: Date.now() };
const listeners = new Set<() => void>();

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Rows without the fields collections add to each. */
function plain<T extends object>(row: T): T {
  const copy = { ...row };
  for (const field of Object.keys(copy)) {
    if (field.startsWith("$")) {
      Reflect.deleteProperty(copy, field);
    }
  }
  return copy;
}

interface Change<T> {
  key: string;
  type: "insert" | "update" | "delete";
  value: T;
}

/** A record with the changes applied, or the same record when none changed anything. */
function applied<T, V>(
  record: Record<string, V>,
  changes: Change<T>[],
  entry: (row: T) => [string, V]
) {
  let next: Record<string, V> | null = null;
  for (const change of changes) {
    if (change.type === "delete") {
      const [slot] = entry(change.value);
      if (slot in (next ?? record)) {
        next ??= { ...record };
        Reflect.deleteProperty(next, slot);
      }
      continue;
    }
    const [slot, value] = entry(plain(change.value as object) as T);
    // A save is shown once as it is made and again once it is written; the second changes nothing.
    if (!same((next ?? record)[slot], value)) {
      next ??= { ...record };
      next[slot] = value;
    }
  }
  return next ?? record;
}

function update(next: Partial<LearnerState>) {
  const state = { ...snapshot.state, ...next };
  const changed = (Object.keys(next) as (keyof LearnerState)[]).some(
    (field) => state[field] !== snapshot.state[field]
  );
  if (changed) {
    show({ state, at: Date.now() });
  }
}

let clock: ReturnType<typeof setTimeout> | undefined;

function show(next: LearnerSnapshot) {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
  // Read again when the next card falls due, so it moves into review.
  clearTimeout(clock);
  const { nextReviewAt } = selectDashboard(next);
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

function mirror() {
  cards.subscribeChanges(
    (changes) =>
      update({
        cards: applied<(typeof changes)[number]["value"], CardSnapshot>(
          snapshot.state.cards,
          changes,
          (row) => [row.key, cardOf(row)]
        ),
      }),
    { includeInitialState: true }
  );
  names.subscribeChanges(
    (changes) => {
      const next: Partial<LearnerState> = {};
      for (const kind of ["actors", "sets", "rooms", "props"] as const) {
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
    () =>
      update({
        focus: stateOf({ focus: focus.toArray.map(plain) as FocusRow[] }).focus,
      }),
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
const current = () => snapshot;

export const getLearner = current;

export function useLearner() {
  return useSyncExternalStore(subscribe, current, current);
}

/** Remembers the last result, recomputing when any input changes. */
function lastOf<A extends unknown[], R>(derive: (...inputs: A) => R) {
  let inputs: A | null = null;
  let result: R;
  return (...next: A) => {
    if (!inputs || next.some((input, index) => input !== inputs?.[index])) {
      inputs = next;
      result = derive(...next);
    }
    return result;
  };
}

const dashboardOf = lastOf(
  (state: LearnerState, at: number): DashboardData =>
    deriveDashboard(state, new Date(at))
);
// Each view depends on part of the state, so a change elsewhere keeps it as it was.
const libraryOf = lastOf(
  (
    cardsByKey: LearnerState["cards"],
    links: LearnerState["livingLinks"],
    entries: LearnerState["focus"]
  ): LibraryData =>
    deriveLibrary({
      ...stateOf({}),
      cards: cardsByKey,
      livingLinks: links,
      focus: entries,
    })
);
const palaceOf = lastOf(
  (
    actors: LearnerState["actors"],
    sets: LearnerState["sets"],
    rooms: LearnerState["rooms"],
    props: LearnerState["props"]
  ): PalaceData => derivePalace({ ...stateOf({}), actors, sets, rooms, props })
);
const profileOf = lastOf(
  (
    cardsByKey: LearnerState["cards"],
    entries: LearnerState["focus"],
    library: LibraryData,
    palace: PalaceData
  ): ProfileData =>
    deriveProfile(
      { ...stateOf({}), cards: cardsByKey, focus: entries },
      undefined,
      library,
      palace
    )
);

export const selectDashboard = ({ state, at }: LearnerSnapshot) =>
  dashboardOf(state, at);
export const selectLibrary = ({ state }: LearnerSnapshot) =>
  libraryOf(state.cards, state.livingLinks, state.focus);
export const selectPalace = ({ state }: LearnerSnapshot) =>
  palaceOf(state.actors, state.sets, state.rooms, state.props);
const selectProfile = (learner: LearnerSnapshot) =>
  profileOf(
    learner.state.cards,
    learner.state.focus,
    selectLibrary(learner),
    selectPalace(learner)
  );

export const useDashboard = () => selectDashboard(useLearner());
export const useLibrary = () => selectLibrary(useLearner());
export const usePalace = () => selectPalace(useLearner());
export const useProfile = () => selectProfile(useLearner());

// One query for every reader, kept for as long as the app is open.
const deviceQuery = createLiveQueryCollection({
  query: (q) => q.from({ row: device }).findOne(),
  gcTime: 0,
});

/** Whether review can go back a card, and the cards taken back, which return to the top. */
export function useReviewBack() {
  const { data } = useLiveQuery(deviceQuery);
  const row = data?.id === DEVICE ? data : undefined;
  return {
    canTakeBack: (row?.reviewed.length ?? 0) > 0,
    takenBack: row?.takenBack ?? noneTakenBack,
  };
}
const noneTakenBack: string[] = [];
