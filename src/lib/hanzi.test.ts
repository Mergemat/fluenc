import { brotliCompressSync, constants } from 'node:zlib'
import { describe, expect, test } from 'bun:test'

import hanziIndexJson from '../data/hanzi-index.generated.json'
import { findHanziComposition, isHanziCharacter, type HanziIndex } from './hanzi'
import { MAX_HANZI_LOOKUP_COUNT, hanziLookupInput } from '../server/hanzi.contract'
import { getHanziCompositionsHandler } from '../server/hanzi.handlers.server'

const hanziIndex = hanziIndexJson as unknown as HanziIndex

describe('Hanzi composition index', () => {
  test('covers common and uncommon characters', () => {
    expect(Object.keys(hanziIndex).length).toBeGreaterThan(9_000)
    expect(findHanziComposition(hanziIndex, '好')).toEqual({
      radical: '女',
      decomposition: '⿰女子',
      components: ['女', '子'],
    })
    expect(findHanziComposition(hanziIndex, '鬱')).not.toBeNull()
  })

  test('keeps nested components unique and ordered', () => {
    expect(findHanziComposition(hanziIndex, '赢')?.components).toEqual([
      '吂',
      '⺼',
      '贝',
    ])
  })

  test('recognizes one Han code point', () => {
    expect(isHanziCharacter('好')).toBeTrue()
    expect(isHanziCharacter('𠮷')).toBeTrue()
    expect(isHanziCharacter('好想')).toBeFalse()
    expect(isHanziCharacter('🙂')).toBeFalse()
  })

  test('looks up one character and batches unique characters', () => {
    expect(getHanziCompositionsHandler({ characters: ['想'] })).toEqual({
      想: {
        radical: '心',
        decomposition: '⿱相心',
        components: ['相', '心'],
      },
    })

    expect(getHanziCompositionsHandler({ characters: ['好', '想', '好'] })).toEqual({
      好: {
        radical: '女',
        decomposition: '⿰女子',
        components: ['女', '子'],
      },
      想: {
        radical: '心',
        decomposition: '⿱相心',
        components: ['相', '心'],
      },
    })
  })

  test('rejects invalid and oversized requests', () => {
    expect(hanziLookupInput.safeParse({ characters: [] }).success).toBeFalse()
    expect(hanziLookupInput.safeParse({ characters: ['🙂'] }).success).toBeFalse()
    expect(hanziLookupInput.safeParse({
      characters: Array.from({ length: MAX_HANZI_LOOKUP_COUNT + 1 }, () => '好'),
    }).success).toBeFalse()
    expect(hanziLookupInput.safeParse({ characters: ['想'] }).data).toEqual({
      characters: ['想'],
    })
  })

  test('returns null for an unsupported Han character', () => {
    expect(findHanziComposition(hanziIndex, '𠮷')).toBeNull()
    expect(getHanziCompositionsHandler({ characters: ['𠮷'] })).toEqual({
      𠮷: null,
    })
  })

  test('stays below the compressed size budget', () => {
    const compressed = brotliCompressSync(JSON.stringify(hanziIndex), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    })

    expect(compressed.byteLength).toBeLessThan(50_000)
  })
})
