// Throwaway fixtures. These associations are an example, never the learner's saved mappings.
import type { BuildItem } from '../../server/curriculum'
import { getMovieCoordinates } from '../../lib/pinyin'

export type CharacterItem = Extract<BuildItem, { type: 'character' }>
export type Variant = 'a' | 'b' | 'c'
export type CueKind = 'actor' | 'set' | 'room' | 'prop'
export type Cue = {
  id: string
  kind: CueKind
  code: string
  name: string
  role: string
  position?: string
}

export const variants = [
  { id: 'a', name: 'Character canvas' },
  { id: 'b', name: 'Scene sentence' },
  { id: 'c', name: 'Shape / sound' },
] as const

export const exampleCharacter: CharacterItem = {
  type: 'character', queueKind: 'new', id: '明', hanzi: '明', pinyin: 'míng', meaning: 'bright', rank: 137, unlocks: 3,
  movie: {
    ...getMovieCoordinates('míng'), actorName: 'Michelle Yeoh', setName: 'My primary school', roomName: 'Kitchen',
    isPrimitive: false, configured: true,
    components: [
      { hanzi: '日', propName: 'Sun', character: { pinyin: 'rì', meaning: 'sun' } },
      { hanzi: '月', propName: 'Moon', character: { pinyin: 'yuè', meaning: 'moon' } },
    ],
  },
}

export const exampleCharacters: CharacterItem[] = [
  exampleCharacter,
  {
    type: 'character', queueKind: 'new', id: '休', hanzi: '休', pinyin: 'xiū', meaning: 'rest', rank: 475, unlocks: 1,
    movie: {
      ...getMovieCoordinates('xiū'), actorName: '', setName: '', roomName: 'Outside entrance', isPrimitive: false, configured: false,
      components: [
        { hanzi: '亻', propName: 'Toy soldier', character: null },
        { hanzi: '木', propName: 'Tree', character: { pinyin: 'mù', meaning: 'tree' } },
      ],
    },
  },
  {
    type: 'character', queueKind: 'new', id: '好', hanzi: '好', pinyin: 'hǎo', meaning: 'good', rank: 8, unlocks: 16,
    movie: {
      ...getMovieCoordinates('hǎo'), actorName: 'Harrison Ford', setName: 'Childhood home', roomName: 'Bedroom', isPrimitive: false, configured: true,
      components: [
        { hanzi: '女', propName: 'Doll', character: { pinyin: 'nǚ', meaning: 'woman' } },
        { hanzi: '子', propName: 'Child', character: { pinyin: 'zǐ', meaning: 'child' } },
      ],
    },
  },
]
