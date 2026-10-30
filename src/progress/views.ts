// What screens read. Each view is derived from the parts of the learner state it uses, once,
// however many components read it, and each hook hands a component only what it shows. The views
// are course logic over the whole catalog, not queries.
import { useSyncExternalStore } from "react";

import {
  deriveLibrary,
  derivePalace,
  type LibraryData,
  type PalaceData,
} from "../lib/learner-views";
import { buildPalaceBoard } from "../lib/palace-board";
import { deriveProfile, introductionsOf } from "../lib/profile";
import { DEVICE, device } from "./collections";
import {
  deriveDashboardOnce,
  type LearnerSnapshot,
  useLearner,
} from "./learner";
import { stateOf } from "./rows";

// biome-ignore lint/performance/noBarrelFile: screens and routes read progress from one place.
export { getLearner, type LearnerSnapshot, loadLearner } from "./learner";

const empty = stateOf({});

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

type State = LearnerSnapshot["state"];

// Each view depends on part of the state, so a change elsewhere keeps it as it was.
const libraryOf = lastOf(
  (
    cards: State["cards"],
    livingLinks: State["livingLinks"],
    focus: State["focus"]
  ): LibraryData => deriveLibrary({ ...empty, cards, livingLinks, focus })
);
const palaceOf = lastOf(
  (
    actors: State["actors"],
    sets: State["sets"],
    rooms: State["rooms"],
    props: State["props"]
  ): PalaceData => derivePalace({ ...empty, actors, sets, rooms, props })
);
const boardOf = lastOf(buildPalaceBoard);
const profileOf = lastOf(
  (
    cards: State["cards"],
    focus: State["focus"],
    library: LibraryData,
    board: ReturnType<typeof buildPalaceBoard>
  ) => deriveProfile({ ...empty, cards, focus }, undefined, library, board)
);
const introductionsFor = lastOf(introductionsOf);

export const selectDashboard = deriveDashboardOnce;
export const selectLibrary = ({ state }: LearnerSnapshot) =>
  libraryOf(state.cards, state.livingLinks, state.focus);
export const selectPalace = ({ state }: LearnerSnapshot) =>
  palaceOf(state.actors, state.sets, state.rooms, state.props);
const selectBoard = (learner: LearnerSnapshot) =>
  boardOf(selectLibrary(learner), selectPalace(learner));
const selectProfile = (learner: LearnerSnapshot) =>
  profileOf(
    learner.state.cards,
    learner.state.focus,
    selectLibrary(learner),
    selectBoard(learner)
  );
const selectDue = (learner: LearnerSnapshot) =>
  selectDashboard(learner).reviewQueue.length;
const selectIntroductions = ({ state }: LearnerSnapshot) =>
  introductionsFor(state.cards);

export const useDashboard = () => useLearner(selectDashboard);
export const useLibrary = () => useLearner(selectLibrary);
export const usePalace = () => useLearner(selectPalace);
export const usePalaceBoard = () => useLearner(selectBoard);
export const useProfile = () => useLearner(selectProfile);
/** How many cards are due now. */
export const useDueCount = () => useLearner(selectDue);
/** When each introduced item was met, for the activity graph. */
export const useIntroductions = () => useLearner(selectIntroductions);

const noneTakenBack: string[] = [];

interface ReviewBack {
  /** Whether a review on this device can be taken back. */
  canTakeBack: boolean;
  /** Cards taken back and not answered again, which return to the top. */
  takenBack: string[];
}

// Kept as one value, so a reader renders only when what it shows changes.
let back: ReviewBack = { canTakeBack: false, takenBack: noneTakenBack };
const backReaders = new Set<() => void>();
let watching = false;

function readBack() {
  const row = device.get(DEVICE);
  const next: ReviewBack = {
    canTakeBack: (row?.reviewed.length ?? 0) > 0,
    takenBack: row?.takenBack ?? noneTakenBack,
  };
  if (
    next.canTakeBack !== back.canTakeBack ||
    JSON.stringify(next.takenBack) !== JSON.stringify(back.takenBack)
  ) {
    back = next;
    for (const reader of backReaders) {
      reader();
    }
  }
}

const subscribeBack = (reader: () => void) => {
  if (!watching) {
    watching = true;
    device.subscribeChanges(readBack, { includeInitialState: true });
  }
  backReaders.add(reader);
  return () => {
    backReaders.delete(reader);
  };
};
const currentBack = () => back;

/** Whether review can go back a card, and the cards taken back, which return to the top. */
export function useReviewBack() {
  return useSyncExternalStore(subscribeBack, currentBack, currentBack);
}
