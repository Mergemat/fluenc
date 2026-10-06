import { brotliCompressSync, constants } from 'node:zlib'
import { describe, expect, test } from 'bun:test'

import hanziIndexJson from '../data/hanzi-index.generated.json'
import { findHanziComposition, groupHanziComponents, isHanziCharacter, type HanziIndex } from './hanzi'

const hanziIndex = hanziIndexJson as unknown as HanziIndex

describe('Hanzi composition index', () => {
  test('covers common and uncommon characters', () => {
    expect(Object.keys(hanziIndex).length).toBeGreaterThan(9_000)
    expect(findHanziComposition(hanziIndex, '好')).toEqual({
      structure: 'compound', glyphVariation: false, note: null,
      radical: '女',
      decomposition: '⿰女子',
      components: ['女', '子'],
    })
    expect(findHanziComposition(hanziIndex, '鬱')).not.toBeNull()
  })

  test('preserves repeated props without asking for duplicate associations', () => {
    const composition = findHanziComposition({ 林: ['木', '⿰木木'] }, '林')
    expect(composition?.components).toEqual(['木', '木'])
    expect(groupHanziComponents(composition!.components)).toEqual([{ hanzi: '木', count: 2 }])
    expect(groupHanziComponents(['木', '日', '木'])).toEqual([{ hanzi: '木', count: 2 }, { hanzi: '日', count: 1 }])
  })

  test.each(['', '⿱一？', '⿱一?', '⿱一', '⿱一木口', '⿰木⿱？一', '⿾木', '㇯木一', '⿱不一'])(
    'rejects incomplete or unsupported structure %s without returning partial props', decomposition => {
      expect(findHanziComposition({ 不: ['一', decomposition] }, '不')).toBeNull()
    },
  )

  test('distinguishes an explicit whole shape from an unknown decomposition', () => {
    expect(findHanziComposition({ 一: ['一', '一'] }, '一')).toMatchObject({ structure: 'atomic', components: ['一'] })
    expect(findHanziComposition({ 一: ['一', ''] }, '一')).toBeNull()
    expect(findHanziComposition({ 永: ['水', '〾⿱丶水'] }, '永')).toMatchObject({ glyphVariation: true, components: ['丶', '水'] })
  })

  test('recognizes one Han code point', () => {
    expect(isHanziCharacter('好')).toBeTrue()
    expect(isHanziCharacter('𠮷')).toBeTrue()
    expect(isHanziCharacter('好想')).toBeFalse()
    expect(isHanziCharacter('🙂')).toBeFalse()
  })

  test('stays below the compressed size budget', () => {
    const compressed = brotliCompressSync(JSON.stringify(hanziIndex), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    })

    expect(compressed.byteLength).toBeLessThan(50_000)
  })
})
