import type { Character, Word } from '../data/types'
import { getItemMeaning } from './meaning'

const normalizeMeaning = (meaning: string) => meaning.normalize('NFC').trim().toLowerCase().replace(/^to\s+/, '')
const normalizePinyin = (pinyin: string) => pinyin.normalize('NFC').trim().toLowerCase()

export function characterWordEquivalences(characters: Pick<Character, 'id' | 'hanzi' | 'pinyin' | 'keyword'>[], words: Pick<Word, 'id' | 'hanzi' | 'pinyin' | 'meaningEn'>[]) {
  const byHanzi = new Map(characters.map(character => [character.hanzi, character]))
  const equivalents: Record<string, string> = {}
  for (const word of words) {
    const character = byHanzi.get(word.hanzi)
    if (!character || Array.from(word.hanzi).length !== 1) continue
    if (normalizePinyin(word.pinyin) !== normalizePinyin(character.pinyin)) continue
    if (normalizeMeaning(getItemMeaning({ meaning: word.meaningEn }).primary) !== normalizeMeaning(character.keyword)) continue
    equivalents[String(word.id)] = character.id
  }
  return equivalents
}
