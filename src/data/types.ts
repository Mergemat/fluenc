export const studyItemTypes = ["character", "word", "sentence"] as const;

export function isStudyItemType(
  value: unknown
): value is (typeof studyItemTypes)[number] {
  return studyItemTypes.some((type) => type === value);
}

export interface Character {
  /** A short second cue shown beside the keyword, or null. */
  also: string | null;
  /** Authored glyph assembly guidance, never source review or replacement history. */
  componentNote: string | null;
  componentStructure: "atomic" | "compound";
  /** The props the character is taught from, in writing order. Independent of stroke files. */
  components: string[];
  frequencyRank: number;
  hanzi: string;
  id: string;
  keyword: string;
  /** Its place in the default teaching order, from frequency and usage. */
  order: number;
  pinyin: string;
  radical: string;
  /** Other readings in modern use. */
  readings: { pinyin: string; meanings: string[] }[];
  /** Senses of the taught reading, most useful first. */
  senses: string[];
  strokes: number;
  unlocks: number;
  /** Reading sentences that use it, plus the course words it spells. */
  usage: number;
}

export interface Word {
  also: string | null;
  characterIds: string[];
  hanzi: string;
  /** A course word's number, or the spelling of a word the learner added. */
  id: number | string;
  meaning: string;
  /** Its place in the default teaching order, from frequency and usage. */
  order: number;
  pinyin: string;
  rank: number;
  senses: string[];
  /** One curriculum syllable per character, or null when the reading does not split cleanly. */
  syllables: string[] | null;
  /** Reading sentences that use it. */
  usage: number;
}

/** A component's suggested prop: a reusable object for every movie that has this part. */
export interface Prop {
  meaning: string;
  prop: string;
  strokes: number;
  variantOf: string | null;
}

export interface Curriculum {
  characters: Character[];
  props: Record<string, Prop>;
  sources: {
    characters: string;
    words: string;
    components: string;
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
  /**
   * A word's pinyin split per character, worked out by the server so devices need no pinyin
   * dictionary. Absent or null when it does not split cleanly.
   */
  syllables?: string[] | null;
}
