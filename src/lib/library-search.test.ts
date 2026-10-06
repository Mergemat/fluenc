import { expect, test } from 'bun:test'

import { createLibrarySearch } from './library-search'
import { getMovieCoordinates } from './pinyin'
import type { LibraryData } from './learner-views'

type Character = LibraryData['characters'][number]
type Word = LibraryData['words'][number]
const character = (entry: Pick<Character, 'id' | 'hanzi' | 'pinyin' | 'keyword' | 'dictionaryMeanings' | 'rank' | 'status'>, components = [entry.hanzi]): Character => ({
  ...entry, movie: getMovieCoordinates(entry.pinyin), components: components.map(hanzi => ({ hanzi, count: 1 })), structure: 'atomic', componentNote: null,
})
const word = (entry: Pick<Word, 'id' | 'hanzi' | 'pinyin' | 'meaning' | 'dictionaryMeanings' | 'rank' | 'status'>, livingLink = ''): Word => ({
  ...entry, syllables: null, characterParts: [], livingLink,
})

const library: LibraryData = {
  characters: [
    character({ id: '你', hanzi: '你', pinyin: 'nǐ', keyword: 'you', dictionaryMeanings: [], rank: 1, status: 'review' }),
    character({ id: '女', hanzi: '女', pinyin: 'nǚ', keyword: 'female', dictionaryMeanings: ['woman'], rank: 2, status: 'learning' }),
    character({ id: '好', hanzi: '好', pinyin: 'hǎo', keyword: 'good', dictionaryMeanings: [], rank: 3, status: 'new' }, ['女', '子']),
  ],
  words: [
    word({ id: '1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', dictionaryMeanings: ['greeting'], rank: 1, status: 'review' }),
    word({ id: '999999', hanzi: '朋友', pinyin: 'péngyou', meaning: 'friend', dictionaryMeanings: ['companion'], rank: 2, status: 'new' }, 'two moons walking together'),
  ],
}
const search = createLibrarySearch(library)

test('finds the same word across tone marks, numbers, spaces, and casing', () => {
  for (const query of ['ni hao', 'nihao', 'ni3hao3', 'NI3 HAO3', 'nǐ hǎo', 'ni’hao']) {
    expect(search(query)[0]?.hanzi).toBe('你好')
  }
  for (const query of ['nü', 'nv', 'nu:', 'nü3', 'nǚ']) expect(search(query)[0]?.hanzi).toBe('女')
})

test('searches both kinds and puts exact readings ahead of longer words', () => {
  expect(search('ni').slice(0, 2).map(item => item.hanzi)).toEqual(['你', '你好'])
  expect(search('你好')[0]?.kind).toBe('words')
})

test('recovers typos in meanings and pinyin, and searches alternative definitions', () => {
  expect(search('freind')[0]?.hanzi).toBe('朋友')
  expect(search('pengyuo')[0]?.hanzi).toBe('朋友')
  expect(search('companion')[0]?.hanzi).toBe('朋友')
})

test('does not flood short or unrelated queries with fuzzy matches', () => {
  expect(search('zz')).toEqual([])
  expect(search('zzzzzzzzzz')).toEqual([])
  expect(search('   ')).toHaveLength(5)
})

test('finds saved personal clues and word stories, including non-English notes', () => {
  const stories = { ...library, words: library.words.map(entry => entry.id === '999999' ? { ...entry, livingLink: 'Camping with Sasha' } : entry) }
  const palace = { actors: [{ key: 'ni', name: 'Нина' }], sets: [{ key: 'ø', name: 'old school' }], props: [], rooms: [] }
  const withNotes = createLibrarySearch(stories, palace)
  expect(withNotes('нина')[0]?.hanzi).toBe('你')
  expect(withNotes('sasha')[0]?.hanzi).toBe('朋友')
  const updated = createLibrarySearch(stories, { ...palace, actors: [{ key: 'ni', name: 'Nicki Minaj' }] })
  expect(updated('nicki')[0]?.hanzi).toBe('你')
  expect(updated('нина')).toEqual([])
})

test('finds entries by the learner’s own clue names, for every character, not just queued ones', () => {
  const withPalace = createLibrarySearch(library, {
    actors: [{ key: 'h', name: 'Harrison Ford' }], sets: [], rooms: [{ tone: 3, name: 'Bedroom' }],
    props: [{ key: '子', name: 'Baby Yoda' }],
  })
  expect(withPalace('harrison')[0]?.hanzi).toBe('好')
  expect(withPalace('yoda')[0]?.hanzi).toBe('好')
  expect(search('moons')[0]?.hanzi).toBe('朋友')
})
