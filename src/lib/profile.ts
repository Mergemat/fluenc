import { State } from "ts-fsrs";

import { type Catalog, catalogFor } from "./catalog";
import { characterIsWord } from "./character-words";
import { cardKey, type LearnerState, parseCardKey } from "./learner-state";
import { deriveLibrary, derivePalace } from "./learner-views";
import { buildPalaceBoard } from "./palace-board";

export type TrackId = "code" | "props" | "characters" | "words" | "sentences";
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
  /** In review for study material; named for palace clues. */
  learned: number;
  /** Introduced but still in learning steps. Palace clues have no learning stage. */
  learning: number;
  milestones: Milestone[];
  total: number;
}

const roundNumbers = [10, 50, 100, 250, 500, 1000];

/**
 * Round-number milestones below the total, then the whole track. `count` items are done, `dates`
 * holds the ones with a recorded date; undated ones came first, before dates were recorded.
 */
function countMilestones(
  track: TrackId,
  total: number,
  count: number,
  dates: readonly string[] = []
): Milestone[] {
  const sorted = dates.toSorted();
  const undated = count - sorted.length;
  return [...roundNumbers.filter((target) => target < total), total].map(
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

/** Done once every clue of a kind has a name. */
function namedMilestone(unit: string, items: { name: string }[]): Milestone {
  const named = items.filter((item) => item.name).length;
  return {
    key: `code:${unit}`,
    track: "code",
    unit,
    target: items.length,
    all: true,
    progress: named,
    reached: items.length > 0 && named === items.length,
    reachedAt: null,
  };
}

function split(statuses: Status[]) {
  return {
    learned: statuses.filter((status) => status === "review").length,
    learning: statuses.filter((status) => status === "learning").length,
    total: statuses.length,
  };
}

const named = (items: { name: string }[]) => ({
  named: items.filter((item) => item.name).length,
  total: items.length,
});

/**
 * The course divided into the method's stages, each as learned, learning and still to come, with
 * the milestones along the way. Study milestones count introduced items and carry the date the
 * deciding item was introduced; palace names are not dated.
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
  const code = [...board.actors, ...board.sets];
  const props = named(board.props);

  const tracks: ProgressTrack[] = [
    {
      id: "code",
      label: "pronunciation code",
      learned: named(code).named,
      learning: 0,
      total: code.length,
      milestones: [
        namedMilestone("sets", board.sets),
        namedMilestone("actors", board.actors),
      ],
    },
    {
      id: "props",
      label: "props",
      learned: props.named,
      learning: 0,
      total: props.total,
      milestones: countMilestones("props", props.total, props.named),
    },
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

  return {
    tracks,
    /** When the learner met their first item, if it was recorded. */
    since: [...introducedAt.values()].toSorted()[0] ?? null,
    palace: {
      cast: named(board.actors),
      sets: named(board.sets),
      areas: named(board.rooms),
      props,
    },
  };
}

export type ProfileData = ReturnType<typeof deriveProfile>;
