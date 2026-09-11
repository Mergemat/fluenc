import { expect, test } from 'bun:test'

import dictionary from '../data/dictionary.source.json'
import { resolveCharacterKeywords, type CharacterKeyword } from './curriculum-readings'

const long: CharacterKeyword = {
  character: '长', pinyin: 'cháng', keyword: 'long', sourcePinyin: 'chang2', sourceSense: 'long', note: 'Length sense.',
}

test('accepts a reading with its own sense and rejects the old cross-reading pair', () => {
  expect(resolveCharacterKeywords(['长'], [long], dictionary.entries).get('长')).toMatchObject({ pinyin: 'cháng', keyword: 'long' })
  expect(() => resolveCharacterKeywords(['长'], [{ ...long, pinyin: 'zhǎng' }], dictionary.entries)).toThrow('Reading mismatch')
  expect(() => resolveCharacterKeywords(['长'], [{ ...long, pinyin: 'zhǎng', sourcePinyin: 'zhang3' }], dictionary.entries)).toThrow('Unverified reading and sense')
})

test('keeps neutral-tone particle senses separate from marked readings', () => {
  const de = { character: '的', pinyin: 'de', keyword: 'possessive particle', sourcePinyin: 'de5', sourceSense: "of; ~'s (possessive particle)", note: '' }
  expect(resolveCharacterKeywords(['的'], [de], dictionary.entries).get('的')?.pinyin).toBe('de')
  expect(() => resolveCharacterKeywords(['的'], [{ ...de, pinyin: 'dì' }], dictionary.entries)).toThrow('Reading mismatch')
})

test('requires complete unique review coverage before generation', () => {
  expect(() => resolveCharacterKeywords(['长', '人'], [long], dictionary.entries)).toThrow('Missing reviewed keywords')
  expect(() => resolveCharacterKeywords(['长'], [long, long], dictionary.entries)).toThrow('duplicate keyword')
})

test('accepts an explicitly documented alternative pronunciation for the same sense', () => {
  const key = { character: '钥', pinyin: 'yào', keyword: 'key', sourcePinyin: 'yue4', sourceSense: 'key', note: 'CC-CEDICT explicitly lists yao4 as an alternative.' }
  expect(resolveCharacterKeywords(['钥'], [key], dictionary.entries).get('钥')?.pinyin).toBe('yào')
  expect(() => resolveCharacterKeywords(['钥'], [{ ...key, pinyin: 'yáo' }], dictionary.entries)).toThrow('Reading mismatch')
})
