import { z } from 'zod'

import { isHanziCharacter } from '../lib/hanzi'

export const MAX_HANZI_LOOKUP_COUNT = 128

const hanziCharacter = z.string().refine(isHanziCharacter, {
  message: 'Expected one Han character',
})

export const hanziLookupInput = z.object({
  characters: z.array(hanziCharacter).min(1).max(MAX_HANZI_LOOKUP_COUNT),
})

export type HanziLookupInput = z.infer<typeof hanziLookupInput>
