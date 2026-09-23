import { expect, test } from 'bun:test'

import { createLibrarySearch } from './library-search'
import type { LibraryData } from '../server/curriculum'

const library: LibraryData = {
  characters: [
    { id: '你', hanzi: '你', pinyin: 'nǐ', keyword: 'you', dictionaryMeanings: [], rank: 1, status: 'review' },
    { id: '女', hanzi: '女', pinyin: 'nǚ', keyword: 'female', dictionaryMeanings: ['woman'], rank: 2, status: 'learning' },
    { id: '好', hanzi: '好', pinyin: 'hǎo', keyword: 'good', dictionaryMeanings: [], rank: 3, status: 'new' },
  ],
  words: [
    { id: '1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', dictionaryMeanings: ['greeting'], rank: 1, status: 'review' },
    { id: '999999', hanzi: '朋友', pinyin: 'péngyou', meaning: 'friend', dictionaryMeanings: ['companion'], rank: 2, status: 'new' },
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
  const dashboard: import('../server/curriculum').DashboardData = {
    curriculum: { version: 'test', characters: 3, words: 2 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    nextReviewAt: null, reviewQueue: [], scheduledQueue: [], getQueue: [], lockedWords: [],
    buildQueue: [{
      type: 'character', queueKind: 'new', id: '你', hanzi: '你', pinyin: 'nǐ',
      keyword: 'you', dictionaryMeanings: [], rank: 1, unlocks: 1,
      movie: {
        syllable: 'ni', actorKey: 'ni', finalKey: 'ø', tone: 3, actorCategory: 'female',
        actorName: 'Нина', setName: 'old school', roomName: 'Bedroom',
        components: [], configured: true, isPrimitive: false, componentNote: null,
      },
    }, {
      type: 'word', queueKind: 'new', id: '999999', hanzi: '朋友', pinyin: 'péngyou', meaning: 'friend',
      dictionaryMeanings: [], rank: 2, characterIds: [], characterParts: [], livingLink: 'Camping with Sasha',
    }],
  }
  const withNotes = createLibrarySearch(library, dashboard)
  expect(withNotes('нина')[0]?.hanzi).toBe('你')
  expect(withNotes('sasha')[0]?.hanzi).toBe('朋友')
  const updated = createLibrarySearch(library, dashboard, {
    actors: [{ key: 'ni', name: 'Nicki Minaj' }], sets: [], props: [], rooms: [],
  })
  expect(updated('nicki')[0]?.hanzi).toBe('你')
  expect(updated('нина')).toEqual([])
})
