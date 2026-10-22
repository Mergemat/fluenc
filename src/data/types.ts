export const studyItemTypes = ["character", "word", "sentence"] as const;

export function isStudyItemType(
  value: unknown
): value is (typeof studyItemTypes)[number] {
  return studyItemTypes.some((type) => type === value);
}

export interface Character {
  /** Authored glyph assembly guidance, never source review or replacement history. */
  componentNote: string | null;
  componentStructure: "atomic" | "compound";
  components: string[];
  dictionaryMeanings: string[];
  frequencyRank: number;
  hanzi: string;
  id: string;
  keyword: string;
  pinyin: string;
  unlocks: number;
}

export interface Word {
  characterIds: string[];
  dictionaryMeanings: string[];
  hanzi: string;
  /** A course word's number, or the spelling of a word the learner added. */
  id: number | string;
  meaning: string;
  pinyin: string;
  rank: number;
  /** One curriculum syllable per character, or null when the reading does not split cleanly. */
  syllables: string[] | null;
}

export interface Curriculum {
  characters: Character[];
  sources: {
    words: string;
    supplementaryWords: string;
    characters: string;
    decompositionReviews: string;
    componentNotes: string;
    keywordReviews: string;
    dictionary: string;
    wordReviews: string;
  };
  version: string;
  words: Word[];
}

/**
 * A word or sentence the learner wants taught next, usually from a class. Spellings that match the
 * course use the course entry; the rest become the learner's own entries, as long as every
 * character is in the course.
 */
export interface FocusEntry {
  /** ISO time it was added; earlier entries are taught first. */
  addedAt: string;
  hanzi: string;
  kind: "word" | "sentence";
  /** Where it came from, such as "HSK 1 · Lesson 3". */
  label: string;
  meaning: string;
  pinyin: string;
}
