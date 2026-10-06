import { expect, test } from 'bun:test'

import { buildPalaceBoard } from './palace-board'
import { getMovieCoordinates } from './pinyin'
import type { LibraryData } from './learner-views'

type Character = LibraryData['characters'][number]
const character = (hanzi: string, pinyin: string, components: string[], status: Character['status'] = 'new'): Character => ({
  id: hanzi, hanzi, pinyin, keyword: hanzi, dictionaryMeanings: [], rank: 1, status,
  movie: getMovieCoordinates(pinyin), components: components.map(part => ({ hanzi: part, count: 1 })), structure: 'compound', componentNote: null,
})

const library: LibraryData = {
  characters: [
    character('一', 'yī', ['一'], 'review'),
    character('好', 'hǎo', ['女', '子'], 'review'),
    character('号', 'hào', ['口', '丂']),
    character('妈', 'mā', ['女', '马']),
  ],
  words: [],
}

test('counts every actor, set, area and prop the course uses, with the learner’s names', () => {
  const board = buildPalaceBoard(library, {
    actors: [{ key: 'h', name: 'Harrison Ford' }], sets: [{ key: 'ao', name: 'Grandma’s flat' }],
    rooms: [{ tone: 3, name: 'Bedroom' }], props: [{ key: '女', name: 'Wonder Woman' }],
  })
  expect(board.actors.map(actor => [actor.key, actor.category, actor.name, actor.characters, actor.started])).toEqual([
    ['h', 'male', 'Harrison Ford', 2, 1],
    ['m', 'male', '', 1, 0],
  ])
  expect(board.sets.map(set => [set.key, set.name, set.characters])).toEqual([['ao', 'Grandma’s flat', 2], ['a', '', 1]])
  expect(board.rooms.find(room => room.tone === 4)?.name).toBe('Bathroom')
  expect(board.props[0]).toMatchObject({ key: '女', name: 'Wonder Woman', characters: 2, started: 1, ids: ['好', '妈'] })
})

test('learns prop-only characters without inventing a sound scene', () => {
  const board = buildPalaceBoard(library, { actors: [], sets: [], rooms: [], props: [] })
  expect(board.actors.some(actor => actor.key === 'y')).toBeFalse()
  expect(board.props.find(prop => prop.key === '一')?.started).toBe(1)
})
