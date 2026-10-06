export const studyItemTypes = ['character', 'word', 'sentence'] as const

export function isStudyItemType(value: unknown): value is typeof studyItemTypes[number] {
  return studyItemTypes.some(type => type === value)
}

export type Character = {
  id: string
  hanzi: string
  pinyin: string
  keyword: string
  dictionaryMeanings: string[]
  components: string[]
  componentStructure: 'atomic' | 'compound'
  componentNote: string | null
  frequencyRank: number
  unlocks: number
}

export type Word = {
  id: number
  rank: number
  hanzi: string
  pinyin: string
  meaning: string
  dictionaryMeanings: string[]
  characterIds: string[]
  /** One curriculum syllable per character, or null when the reading does not split cleanly. */
  syllables: string[] | null
}

export type Curriculum = {
  version: string
  sources: {
    words: string
    characters: string
    decompositionReviews: string
    keywordReviews: string
    dictionary: string
    wordReviews: string
  }
  characters: Character[]
  words: Word[]
}
