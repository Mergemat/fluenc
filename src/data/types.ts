export const studyItemTypes = ["character", "word", "sentence"] as const;

export function isStudyItemType(
  value: unknown
): value is (typeof studyItemTypes)[number] {
  return studyItemTypes.some((type) => type === value);
}

export interface Character {
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
  id: number;
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
    characters: string;
    decompositionReviews: string;
    keywordReviews: string;
    dictionary: string;
    wordReviews: string;
  };
  version: string;
  words: Word[];
}
