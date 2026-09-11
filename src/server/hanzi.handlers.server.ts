import reviewedJson from '../data/reviewed-compositions.json'
import hanziIndexJson from '../data/hanzi-index.generated.json'
import {
  findHanziComposition,
  type HanziComposition,
  type HanziIndex,
  type ReviewedComposition,
} from '../lib/hanzi'
import type { HanziLookupInput } from './hanzi.contract'

const reviewed = new Map((reviewedJson as ReviewedComposition[]).map(entry => [entry.character, entry]))
const hanziIndex = hanziIndexJson as unknown as HanziIndex

export function getHanziCompositionsHandler({ characters }: HanziLookupInput) {
  const compositions: Record<string, HanziComposition | null> = {}

  for (const character of new Set(characters)) {
    compositions[character] = findHanziComposition(hanziIndex, character, reviewed.get(character))
  }

  return compositions
}
