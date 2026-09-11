import { expect, test } from 'bun:test'

import dictionary from '../data/dictionary.source.json'
import reviews from '../data/word-meanings.reviewed.json'
import { getItemMeaning } from './meaning'
import { resolveWordMeanings } from './word-meanings'

const personalWord = { id: 590, rank: 590, hanzi: '个人' }
const personalReview = reviews.find(review => review.id === personalWord.id)!

test('dictionary ordering cannot choose or truncate a teaching meaning', () => {
  const reordered = { ...dictionary.entries, 个人: [...dictionary.entries['个人']].reverse().map(reading => ({ ...reading, senses: [...reading.senses].reverse() })) }
  const words = resolveWordMeanings([personalWord], [personalReview], reordered)
  expect(words[0]?.meaning).toBe('personal')
  expect(words[0]?.dictionaryMeanings.some(sense => sense.includes('individual'))).toBeTrue()
  expect(getItemMeaning({ meaning: 'the more..., the more...', dictionaryMeanings: [] }).primary).toBe('the more..., the more...')
})

test('future frequency entries require an explicit review decision', () => {
  const future = { id: 1001, rank: 1001, hanzi: '学习' }
  expect(() => resolveWordMeanings([personalWord, future], [personalReview], dictionary.entries)).toThrow('Missing reviewed words')
  expect(() => resolveWordMeanings([personalWord], [personalReview, personalReview], dictionary.entries)).toThrow('duplicate word review')
  expect(() => resolveWordMeanings([personalWord], [{ ...personalReview, hanzi: '客人' }], dictionary.entries)).toThrow('Unexpected')
})

test('checks every syllable and binds the sense to its reading', () => {
  expect(() => resolveWordMeanings([personalWord], [{ ...personalReview, pinyin: 'gérén' }], dictionary.entries)).toThrow('Reading mismatch')
  expect(() => resolveWordMeanings([personalWord], [{ ...personalReview, pinyin: 'gèrèn' }], dictionary.entries)).toThrow('Reading mismatch')
  const tell = reviews.find(review => review.id === 49)!
  expect(() => resolveWordMeanings([{ id: 49, rank: 49, hanzi: '告诉' }], [{ ...tell, sourcePinyin: 'gao4 su4' }], dictionary.entries)).toThrow('Unverified reading and sense')
})

test('phrase evidence must reconstruct the phrase and preserve the sourced tones', () => {
  const think = reviews.find(review => review.id === 592)!
  const word = { id: 592, rank: 592, hanzi: '想想' }
  expect(resolveWordMeanings([word], [think], dictionary.entries)[0]?.pinyin).toBe('xiǎngxiang')
  expect(() => resolveWordMeanings([word], [{ ...think, pinyin: 'xiángxiang' }], dictionary.entries)).toThrow('reading mismatch')
  expect(() => resolveWordMeanings([word], [{ ...think, composition: [{ hanzi: '想', sourcePinyin: 'xiang3', sourceSense: 'to think' }, { hanzi: '人', sourcePinyin: 'ren2', sourceSense: 'person' }] }], dictionary.entries)).toThrow('does not spell')
})
