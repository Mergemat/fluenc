// Throwaway fixtures. These associations are an example, never the learner's saved mappings.
import type { BuildItem } from '../../server/curriculum'
import { getMovieCoordinates } from '../../lib/pinyin'

export type CharacterItem = Extract<BuildItem, { type: 'character' }>
export type CueKind = 'actor' | 'set' | 'room' | 'prop'
export type Cue = {
  id: string
  kind: CueKind
  code: string
  name: string
  role: string
  count?: number
}

// The first-party walkthrough teaches these directly, while still assigning props.
export const directCharacters = new Set(['一', '二', '三'])
export const directCharacter: CharacterItem = {
  type: 'character', queueKind: 'new', id: '一', hanzi: '一', pinyin: 'yī', keyword: 'one', dictionaryMeanings: [], rank: 2, unlocks: 1,
  movie: {
    ...getMovieCoordinates('yī'), actorName: '', setName: '', roomName: 'Outside entrance',
    componentNote: null, isPrimitive: true, configured: false,
    components: [{ count: 1, hanzi: '一', propName: '', character: { pinyin: 'yī', keyword: 'one' } }],
  },
}

export const exampleCharacter: CharacterItem = {
  type: 'character', queueKind: 'new', id: '明', hanzi: '明', pinyin: 'míng', keyword: 'bright', dictionaryMeanings: [], rank: 137, unlocks: 3,
  movie: {
    ...getMovieCoordinates('míng'), actorName: 'Michelle Yeoh', setName: 'My primary school', roomName: 'Kitchen',
    componentNote: null, isPrimitive: false, configured: true,
    components: [
      { count: 1, hanzi: '日', propName: 'Sun', character: { pinyin: 'rì', keyword: 'sun' } },
      { count: 1, hanzi: '月', propName: 'Moon', character: { pinyin: 'yuè', keyword: 'moon' } },
    ],
  },
}

export const exampleCharacters: CharacterItem[] = [
  exampleCharacter,
  {
    type: 'character', queueKind: 'new', id: '休', hanzi: '休', pinyin: 'xiū', keyword: 'rest', dictionaryMeanings: [], rank: 475, unlocks: 1,
    movie: {
      ...getMovieCoordinates('xiū'), actorName: '', setName: '', roomName: 'Outside entrance', componentNote: null, isPrimitive: false, configured: false,
      components: [
        { count: 1, hanzi: '亻', propName: 'Toy soldier', character: null },
        { count: 1, hanzi: '木', propName: 'Tree', character: { pinyin: 'mù', keyword: 'tree' } },
      ],
    },
  },
  {
    type: 'character', queueKind: 'new', id: '好', hanzi: '好', pinyin: 'hǎo', keyword: 'good', dictionaryMeanings: [], rank: 8, unlocks: 16,
    movie: {
      ...getMovieCoordinates('hǎo'), actorName: 'Harrison Ford', setName: 'Childhood home', roomName: 'Bedroom', componentNote: null, isPrimitive: false, configured: true,
      components: [
        { count: 1, hanzi: '女', propName: 'Doll', character: { pinyin: 'nǚ', keyword: 'woman' } },
        { count: 1, hanzi: '子', propName: 'Child', character: { pinyin: 'zǐ', keyword: 'child' } },
      ],
    },
  },
]

export const denseCharacter: CharacterItem = {
  type: 'character', queueKind: 'new', id: '聽', hanzi: '聽', pinyin: 'tīng', keyword: 'listen', dictionaryMeanings: [], rank: 400, unlocks: 1,
  movie: {
    ...getMovieCoordinates('tīng'), actorName: 'Tina Fey', setName: 'My university library', roomName: 'Outside entrance',
    componentNote: null, isPrimitive: false, configured: true,
    components: [
      { count: 1, hanzi: '耳', propName: 'Headphones', character: null },
      { count: 1, hanzi: '王', propName: 'Crown', character: null },
      { count: 1, hanzi: '十', propName: 'Cross', character: null },
      { count: 1, hanzi: '罒', propName: 'Fishing net', character: null },
      { count: 1, hanzi: '一', propName: 'Pencil', character: null },
      { count: 1, hanzi: '心', propName: 'Heart', character: null },
    ],
  },
}

export const repeatedCharacter: CharacterItem = {
  ...exampleCharacter, id: '朋', hanzi: '朋', pinyin: 'péng', keyword: 'friend',
  movie: {
    ...exampleCharacter.movie, ...getMovieCoordinates('péng'), actorName: 'Patrick Stewart',
    components: [{ hanzi: '月', count: 2, propName: 'Moon', character: { pinyin: 'yuè', keyword: 'moon' } }],
  },
}

export const shapeCharacter: CharacterItem = {
  ...exampleCharacter, id: '马', hanzi: '马', pinyin: 'mǎ', keyword: 'horse',
  movie: {
    ...exampleCharacter.movie, ...getMovieCoordinates('mǎ'), actorName: 'Matt Damon', roomName: 'Bedroom',
    componentNote: 'The first two bent strokes interlock. Place the horizontal stroke across the lower part, as shown in 马.',
    components: [
      { hanzi: '㇕', count: 1, propName: 'Coat hanger', character: null },
      { hanzi: '㇉', count: 1, propName: 'Fishing hook', character: null },
      { hanzi: '一', count: 1, propName: 'Pencil', character: null },
    ],
  },
}

export const exampleQueues = {
  ming: exampleCharacters,
  xiu: [exampleCharacters[1]],
  hao: [exampleCharacters[2]],
  ting: [denseCharacter],
  yi: [directCharacter],
  peng: [repeatedCharacter],
  ma: [shapeCharacter],
}
export type Example = keyof typeof exampleQueues
