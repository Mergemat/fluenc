import { describe, expect, test } from 'bun:test'

import { getMovieCoordinates } from './pinyin'

describe('Hanzi Movie coordinates', () => {
  test.each([
    ['rén', 'r', 'en', 2, 'male'],
    ['xiǎng', 'xi', 'ang', 3, 'female'],
    ['shuō', 'shu', 'o', 1, 'fictional'],
    ['bù', 'bu', 'ø', 4, 'fictional'],
    ['shì', 'sh', 'ø', 4, 'male'],
    ['yě', 'y', 'e', 3, 'female'],
    ['yī', 'y', 'ø', 1, 'female'],
    ['yīn', 'y', 'en', 1, 'female'],
    ['yīng', 'y', 'eng', 1, 'female'],
    ['jù', 'ju', 'ø', 4, 'wildcard'],
    ['qù', 'qu', 'ø', 4, 'wildcard'],
    ['xū', 'xu', 'ø', 1, 'wildcard'],
  ] as const)('%s maps to actor, set and tone', (pinyin, actorKey, finalKey, tone, actorCategory) => {
    expect(getMovieCoordinates(pinyin)).toMatchObject({ actorKey, finalKey, tone, actorCategory })
  })
})
