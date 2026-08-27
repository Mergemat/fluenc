export type Character = {
  id: string
  hanzi: string
  pinyin: string
  meaningEn: string
  components: string[]
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
  sources: { words: string; characters: string }
  characters: Character[]
  words: Word[]
}
