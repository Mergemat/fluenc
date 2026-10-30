import { type Card, createEmptyCard, type Grade } from "ts-fsrs";

import {
  type FocusEntry,
  isStudyItemType,
  type studyItemTypes,
} from "../data/types";
import type {
  EnrollInput,
  FocusInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
  UndoInput,
} from "../server/sync.contract";
import { type Catalog, catalogFor } from "./catalog";
import { studyIdentity } from "./character-words";
import { scheduleReview } from "./review-schedule";

type StudyItemType = (typeof studyItemTypes)[number];

export interface CardSnapshot {
  difficulty: number;
  due: string;
  elapsedDays: number;
  /** When the learner first met the item; absent in progress saved before it was recorded. */
  introducedAt?: string;
  lapses: number;
  lastReview: string | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: number;
}

/**
 * Everything stored for a learner. The dashboard, library and palace are derived from this and
 * the catalog, on the server and on the device alike.
 */
export interface LearnerState {
  /** Names keyed by actor initial, set final, tone and component. */
  actors: Record<string, string>;
  /** Introduced material keyed by `cardKey`, in the order it was introduced. */
  cards: Record<string, CardSnapshot>;
  /** What the learner wants taught next, oldest first. Saved outside the app, such as by a script. */
  focus: FocusEntry[];
  /** Living Link stories keyed by word id. */
  livingLinks: Record<string, string>;
  props: Record<string, string>;
  rooms: Record<string, string>;
  sets: Record<string, string>;
}

export const emptyLearnerState: LearnerState = {
  cards: {},
  focus: [],
  actors: {},
  sets: {},
  rooms: {},
  props: {},
  livingLinks: {},
};

/** One change to a learner's progress. */
export type ProgressChange =
  | { kind: "enroll"; data: EnrollInput }
  | { kind: "focus"; data: FocusInput }
  | { kind: "livingLink"; data: LivingLinkInput }
  | { kind: "movie"; data: MovieInput }
  | { kind: "review"; data: ReviewInput }
  | { kind: "undo"; data: UndoInput };

/** A change as it is stored and sent. */
export type ProgressOperation = {
  /** When the change was made. */
  at: string;
  /** Chosen where the change was made; the server applies each id once. */
  id: string;
} & ProgressChange;

/**
 * What changed on the server since a device's cursor: rows to write over the device's copy, and
 * focus entries that were removed, by `focusKey`.
 */
export interface LearnerPatch {
  actors: Record<string, string>;
  cards: Record<string, CardSnapshot>;
  focus: FocusEntry[];
  livingLinks: Record<string, string>;
  props: Record<string, string>;
  removedFocus: string[];
  rooms: Record<string, string>;
  sets: Record<string, string>;
}

export const focusKey = (entry: Pick<FocusEntry, "kind" | "hanzi">) =>
  `${entry.kind}:${entry.hanzi}`;

const byAddedAt = (left: FocusEntry, right: FocusEntry) =>
  left.addedAt < right.addedAt ? -1 : Number(left.addedAt > right.addedAt);

function mergeFocus(
  focus: FocusEntry[],
  changed: readonly FocusEntry[],
  removed: readonly string[]
) {
  if (!(changed.length || removed.length)) {
    return focus;
  }
  const replaced = new Set([...removed, ...changed.map(focusKey)]);
  return [
    ...focus.filter((entry) => !replaced.has(focusKey(entry))),
    ...changed,
  ].sort(byAddedAt);
}

/** The server's state after a patch. `reset` starts from nothing, for a device's first sync. */
export function applyPatch(
  base: LearnerState,
  patch: LearnerPatch,
  reset = false
): LearnerState {
  const from = reset ? emptyLearnerState : base;
  return {
    cards: { ...from.cards, ...patch.cards },
    // A focus list that did not change stays the same array, so its catalog is reused.
    focus: mergeFocus(from.focus, patch.focus, patch.removedFocus),
    actors: { ...from.actors, ...patch.actors },
    sets: { ...from.sets, ...patch.sets },
    rooms: { ...from.rooms, ...patch.rooms },
    props: { ...from.props, ...patch.props },
    livingLinks: { ...from.livingLinks, ...patch.livingLinks },
  };
}

export const cardKey = (type: StudyItemType, id: string) => `${type}:${id}`;

export function parseCardKey(key: string) {
  const separator = key.indexOf(":");
  const type = key.slice(0, separator);
  return isStudyItemType(type) ? { type, id: key.slice(separator + 1) } : null;
}

export function toCard(snapshot: CardSnapshot): Card {
  return {
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningSteps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: snapshot.state,
    last_review: snapshot.lastReview
      ? new Date(snapshot.lastReview)
      : undefined,
  };
}

export function toSnapshot(card: Card): CardSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString() ?? null,
  };
}

/** A review never lands at or before the card's last one, so retried and offline events stay ordered. */
export function reviewTime(lastReview: Date | null, requested: Date) {
  return lastReview && requested <= lastReview
    ? new Date(lastReview.getTime() + 1)
    : requested;
}

function isInCatalog(type: StudyItemType, id: string, catalog: Catalog) {
  if (type === "character") {
    return catalog.charactersById.has(id);
  }
  if (type === "word") {
    return catalog.wordsById.has(id);
  }
  return catalog.sentencesById.has(id);
}

function applyFocus(state: LearnerState, data: FocusInput): LearnerState {
  if ("remove" in data) {
    const removed = new Set(data.remove);
    const focus = state.focus.filter((entry) => !removed.has(entry.hanzi));
    return focus.length === state.focus.length ? state : { ...state, focus };
  }
  // An entry already in focus keeps its place and label.
  const present = new Set(state.focus.map(focusKey));
  const added = data.add.filter((entry) => {
    const key = focusKey(entry);
    if (present.has(key)) {
      return false;
    }
    present.add(key);
    return true;
  });
  return added.length
    ? { ...state, focus: mergeFocus(state.focus, added, []) }
    : state;
}

function applyEnroll(
  state: LearnerState,
  data: EnrollInput,
  catalog: Catalog
): LearnerState {
  const target = studyIdentity(data.itemType, data.itemId);
  const key = cardKey(target.itemType, target.itemId);
  if (
    state.cards[key] ||
    !isInCatalog(target.itemType, target.itemId, catalog)
  ) {
    return state;
  }
  return {
    ...state,
    cards: {
      ...state.cards,
      [key]: {
        ...toSnapshot(createEmptyCard(new Date(data.enrolledAt))),
        introducedAt: data.enrolledAt,
      },
    },
  };
}

function applyReview(state: LearnerState, data: ReviewInput): LearnerState {
  const target = studyIdentity(data.itemType, data.itemId);
  const key = cardKey(target.itemType, target.itemId);
  const card = state.cards[key];
  if (!card) {
    return state;
  }
  const reviewedAt = reviewTime(
    card.lastReview ? new Date(card.lastReview) : null,
    new Date(data.reviewedAt)
  );
  const next = scheduleReview(toCard(card), reviewedAt, data.rating as Grade);
  const snapshot = card.introducedAt
    ? { ...toSnapshot(next), introducedAt: card.introducedAt }
    : toSnapshot(next);
  return { ...state, cards: { ...state.cards, [key]: snapshot } };
}

function applyUndo(state: LearnerState, data: UndoInput): LearnerState {
  const target = studyIdentity(data.itemType, data.itemId);
  const key = cardKey(target.itemType, target.itemId);
  if (!state.cards[key]) {
    return state;
  }
  return { ...state, cards: { ...state.cards, [key]: data.card } };
}

function applyMovie(state: LearnerState, data: MovieInput): LearnerState {
  const { actorKey, actorName, finalKey, setName, tone, roomName, props } =
    data;
  return {
    ...state,
    actors: actorName
      ? { ...state.actors, [actorKey]: actorName }
      : state.actors,
    sets: setName ? { ...state.sets, [finalKey]: setName } : state.sets,
    rooms: roomName ? { ...state.rooms, [tone]: roomName } : state.rooms,
    props: props.length
      ? {
          ...state.props,
          ...Object.fromEntries(
            props.map((prop) => [prop.component, prop.propName])
          ),
        }
      : state.props,
  };
}

/** Apply one change. Devices and the server both record progress with this. */
export function applyOperation(
  state: LearnerState,
  operation: ProgressChange,
  catalog: Catalog = catalogFor(state)
): LearnerState {
  switch (operation.kind) {
    case "focus":
      return applyFocus(state, operation.data);
    case "enroll":
      return applyEnroll(state, operation.data, catalog);
    case "review":
      return applyReview(state, operation.data);
    case "undo":
      return applyUndo(state, operation.data);
    case "movie":
      return applyMovie(state, operation.data);
    default:
      return {
        ...state,
        livingLinks: {
          ...state.livingLinks,
          [operation.data.wordId]: operation.data.story,
        },
      };
  }
}
