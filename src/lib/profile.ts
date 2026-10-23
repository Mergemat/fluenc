import { State } from "ts-fsrs";

import { type Catalog, catalogFor } from "./catalog";
import { characterIsWord } from "./character-words";
import { cardKey, type LearnerState, parseCardKey } from "./learner-state";
import { deriveLibrary, derivePalace } from "./learner-views";
import { buildPalaceBoard } from "./palace-board";

export type TrackId = "characters" | "words" | "sentences";
type Status = "new" | "learning" | "review";

export interface ProgressTrack {
  id: TrackId;
  /** When each introduced item was met; items saved before dates were recorded have none. */
  introducedAt: string[];
  label: string;
  /** In review. */
  learned: number;
  /** Introduced but still in learning steps. */
  learning: number;
  total: number;
}

function split(statuses: Status[]) {
  return {
    learned: statuses.filter((status) => status === "review").length,
    learning: statuses.filter((status) => status === "learning").length,
    total: statuses.length,
  };
}

/**
 * Characters, words and sentences, each as learned, learning and still to come, with when each
 * was met; every introduction, for the activity graph; and how many palace clues have a name.
 * A single-character word counts as a word from the moment its character was met.
 */
export function deriveProfile(
  state: LearnerState,
  catalog: Catalog = catalogFor(state)
) {
  const library = deriveLibrary(state, catalog);
  const board = buildPalaceBoard(library, derivePalace(state));

  const characterDates: string[] = [];
  const sentenceDates: string[] = [];
  const wordIntroducedAt = new Map<string, string>();
  const introductions: string[] = [];
  for (const [key, card] of Object.entries(state.cards)) {
    const target = parseCardKey(key);
    if (!(target && card.introducedAt)) {
      continue;
    }
    introductions.push(card.introducedAt);
    let hanzi: string | undefined;
    if (target.type === "character") {
      characterDates.push(card.introducedAt);
      hanzi = characterIsWord(target.id) ? target.id : undefined;
    } else if (target.type === "word") {
      hanzi = catalog.wordsById.get(target.id)?.hanzi;
    } else {
      sentenceDates.push(card.introducedAt);
    }
    const earlier = hanzi && wordIntroducedAt.get(hanzi);
    if (hanzi && !(earlier && earlier <= card.introducedAt)) {
      wordIntroducedAt.set(hanzi, card.introducedAt);
    }
  }
  const knownWords = new Set(
    library.words
      .filter((item) => item.status !== "new")
      .map((item) => item.hanzi)
  );

  const sentenceStatus = (id: string): Status => {
    const card = state.cards[cardKey("sentence", id)];
    if (!card) {
      return "new";
    }
    return card.state === State.Review ? "review" : "learning";
  };
  const tracks: ProgressTrack[] = [
    {
      id: "characters",
      label: "characters",
      ...split(library.characters.map((item) => item.status)),
      introducedAt: characterDates,
    },
    {
      id: "words",
      label: "words",
      ...split(library.words.map((item) => item.status)),
      introducedAt: [...wordIntroducedAt]
        .filter(([hanzi]) => knownWords.has(hanzi))
        .map(([, at]) => at),
    },
    {
      id: "sentences",
      label: "sentences",
      ...split(catalog.sentences.map((item) => sentenceStatus(item.id))),
      introducedAt: sentenceDates,
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
    /** Every dated introduction: what the activity graph counts. */
    introductions,
    /** Clues with a learner's name, counted like the palace page. */
    palace: {
      named: clues.filter((clue) => clue.name).length,
      total: clues.length,
    },
  };
}

export type ProfileData = ReturnType<typeof deriveProfile>;
