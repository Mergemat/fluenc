import { brotliCompressSync, constants } from 'node:zlib'
import { describe, expect, test } from 'bun:test'

import hanziIndexJson from '../data/hanzi-index.generated.json'
import { findHanziComposition, type HanziIndex } from './hanzi'
import { lookupHanzi } from './lookupHanzi'

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

  test('loads lazily and returns null outside the index', async () => {
    expect(await lookupHanzi('想')).toEqual({
      radical: '心',
      decomposition: '⿱相心',
      components: ['相', '心'],
    })
    expect(await lookupHanzi('🙂')).toBeNull()
  })

  test('stays below the compressed size budget', () => {
    const compressed = brotliCompressSync(JSON.stringify(hanziIndex), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    })

    expect(compressed.byteLength).toBeLessThan(50_000)
  })
})
