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

test('every course prop owns real strokes in the shipped glyph files', async () => {
  const { directCharacters } = await import('./character-props')
  for (const character of curriculum.characters) {
    const path = new URL(`../../public/hanzi/${character.hanzi}.json`, import.meta.url)
    const shape = await Bun.file(path).json() as { strokes: string[]; medians: number[][][]; owners: string[] }
    const components = directCharacters.has(character.hanzi) ? [character.hanzi] : character.components
    expect(shape.owners.length, character.hanzi).toBe(shape.strokes.length)
    expect(shape.medians.length, character.hanzi).toBe(shape.strokes.length)
    expect([...new Set(shape.owners)].sort(), character.hanzi).toEqual([...new Set(components)].sort())
    expect(shape.strokes.every(path => path.startsWith('M') && path.includes('Z')), character.hanzi).toBeTrue()
  }
})
