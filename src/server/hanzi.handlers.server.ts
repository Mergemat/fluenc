import hanziIndexJson from '../data/hanzi-index.generated.json'
import {
  findHanziComposition,
  type HanziComposition,
  type HanziIndex,
} from '../lib/hanzi'
import type { HanziLookupInput } from './hanzi.contract'

const hanziIndex = hanziIndexJson as unknown as HanziIndex

export function getHanziCompositionsHandler({ characters }: HanziLookupInput) {
  const compositions: Record<string, HanziComposition | null> = {}

  for (const character of new Set(characters)) {
    compositions[character] = findHanziComposition(hanziIndex, character)
  }

  return compositions
}
