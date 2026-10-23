import { State } from "ts-fsrs";

import { type Catalog, catalogFor } from "./catalog";
import { characterIsWord } from "./character-words";
import { cardKey, type LearnerState, parseCardKey } from "./learner-state";
import { deriveLibrary, derivePalace } from "./learner-views";
import { buildPalaceBoard } from "./palace-board";

export type TrackId = "characters" | "words" | "sentences";
type Status = "new" | "learning" | "review";

export interface Milestone {
  /** Every item on the track, rather than a round number. */
  all: boolean;
  key: string;
  /** How far along the learner is toward `target`. */
  progress: number;
  reached: boolean;
  /** When the learner met the item that reached it; null when not reached or not recorded. */
  reachedAt: string | null;
  target: number;
  track: TrackId;
  unit: string;
}

export interface ProgressTrack {
  id: TrackId;
  label: string;
  /** In review. */
  learned: number;
  /** Introduced but still in learning steps. */
  learning: number;
  milestones: Milestone[];
  total: number;
}

const roundNumbers = [10, 50, 100, 250, 500, 1000];

/**
 * Round-number milestones short of the total (one right before it says nothing new), then the
 * whole track. `count` items are done and `dates` holds the ones with a recorded date; undated
 * ones came first, before dates were recorded.
 */
function countMilestones(
  track: TrackId,
  total: number,
  count: number,
  dates: readonly string[] = []
): Milestone[] {
  const sorted = dates.toSorted();
  const undated = count - sorted.length;
  return [...roundNumbers.filter((target) => target < total * 0.9), total].map(
    (target) => {
      const reached = total > 0 && count >= target;
      return {
        key: `${track}:${target}`,
        track,
        unit: track,
        target,
        all: target === total,
        progress: Math.min(count, target),
        reached,
        reachedAt: (reached && sorted[target - 1 - undated]) || null,
      };
    }
  );
}

function split(statuses: Status[]) {
  return {
    learned: statuses.filter((status) => status === "review").length,
    learning: statuses.filter((status) => status === "learning").length,
    total: statuses.length,
  };
}

/**
 * Characters, words and sentences, each as learned, learning and still to come, with the
 * milestones along the way. Milestones count introduced items and carry the date the deciding
 * item was introduced. The palace is summed up as how many of its clues have a name.
 */
export function deriveProfile(
  state: LearnerState,
  catalog: Catalog = catalogFor(state)
) {
  const library = deriveLibrary(state, catalog);
  const board = buildPalaceBoard(library, derivePalace(state));

  // When each item was introduced, by card key, and when each word was first known by spelling
  // (a single-character word is known once its character is).
  const introducedAt = new Map<string, string>();
  const wordIntroducedAt = new Map<string, string>();
  for (const [key, card] of Object.entries(state.cards)) {
    const target = parseCardKey(key);
    if (!(target && card.introducedAt)) {
      continue;
    }
    introducedAt.set(key, card.introducedAt);
    let hanzi: string | undefined;
    if (target.type === "word") {
      hanzi = catalog.wordsById.get(target.id)?.hanzi;
    } else if (target.type === "character" && characterIsWord(target.id)) {
      hanzi = target.id;
    }
    const earlier = hanzi && wordIntroducedAt.get(hanzi);
    if (hanzi && !(earlier && earlier <= card.introducedAt)) {
      wordIntroducedAt.set(hanzi, card.introducedAt);
    }
  }
  const datesOf = (keys: string[], from: ReadonlyMap<string, string>) =>
    keys.flatMap((key) => from.get(key) ?? []);

  const sentenceStatus = (id: string): Status => {
    const card = state.cards[cardKey("sentence", id)];
    if (!card) {
      return "new";
    }
    return card.state === State.Review ? "review" : "learning";
  };
  const started = <T extends { status: Status }>(items: T[]) =>
    items.filter((item) => item.status !== "new");
  const startedCharacters = started(library.characters);
  const startedWords = started(library.words);
  const startedSentences = started(
    catalog.sentences.map((item) => ({
      id: item.id,
      status: sentenceStatus(item.id),
    }))
  );
  const characters = split(library.characters.map((item) => item.status));
  const words = split(library.words.map((item) => item.status));
  const sentences = split(
    catalog.sentences.map((item) => sentenceStatus(item.id))
  );
  const tracks: ProgressTrack[] = [
    {
      id: "characters",
      label: "characters",
      ...characters,
      milestones: countMilestones(
        "characters",
        characters.total,
        startedCharacters.length,
        datesOf(
          startedCharacters.map((item) => cardKey("character", item.id)),
          introducedAt
        )
      ),
    },
    {
      id: "words",
      label: "words",
      ...words,
      milestones: countMilestones(
        "words",
        words.total,
        startedWords.length,
        datesOf(
          startedWords.map((item) => item.hanzi),
          wordIntroducedAt
        )
      ),
    },
    {
      id: "sentences",
      label: "sentences",
      ...sentences,
      milestones: countMilestones(
        "sentences",
        sentences.total,
        startedSentences.length,
        datesOf(
          startedSentences.map((item) => cardKey("sentence", item.id)),
          introducedAt
        )
      ),
    },
  ];

  const clues = [
    ...board.actors,
    ...board.sets,
    ...board.rooms,
    ...board.props,
  ];
  return {
    tracks,
    /** When the learner met their first item, if it was recorded. */
    since: [...introducedAt.values()].toSorted()[0] ?? null,
    /** Clues with a learner's name, counted like the palace page. */
    palace: {
      named: clues.filter((clue) => clue.name).length,
      total: clues.length,
    },
  };
}

export type ProfileData = ReturnType<typeof deriveProfile>;
