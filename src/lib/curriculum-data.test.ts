import { expect, test } from 'bun:test'

import curriculum from '../data/curriculum.generated.json'
import indexJson from '../data/hanzi-index.generated.json'
import reviewedJson from '../data/reviewed-compositions.json'
import { findHanziComposition, type HanziIndex, type ReviewedComposition } from './hanzi'

const index = indexJson as unknown as HanziIndex
const reviewed = reviewedJson as ReviewedComposition[]

test('every lesson has a complete composition and a deliberate whole-shape decision', () => {
  const errors: string[] = []
  for (const character of curriculum.characters) {
    const composition = findHanziComposition(index, character.hanzi, reviewed.find(entry => entry.character === character.hanzi))
    if (!composition || !composition.components.length) errors.push(`${character.hanzi}: incomplete`)
    else if (JSON.stringify(character.components) !== JSON.stringify(composition.components)) errors.push(`${character.hanzi}: stale generated components`)
  }
  expect(errors).toEqual([])
})

test('curated source data cannot silently disappear during regeneration', () => {
  expect(new Set(reviewed.map(entry => entry.character)).size).toBe(reviewed.length)
  for (const entry of reviewed) {
    expect(entry.sources.every(source => source.startsWith('https://'))).toBeTrue()
    expect(findHanziComposition(index, entry.character, entry)).not.toBeNull()
  }
})
