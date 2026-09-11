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
  meaningEn: string
  characterIds: string[]
}

export type Curriculum = {
  version: string
  sources: {
    words: string
    characters: string
    decompositionReviews: string
    keywordReviews: string
    dictionary: string
    wordCorrections: string
  }
  characters: Character[]
  words: Word[]
}
