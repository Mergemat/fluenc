import { findHanziComposition, type HanziIndex } from './hanzi'

let hanziIndexPromise: Promise<HanziIndex> | undefined

export async function lookupHanzi(character: string) {
  hanziIndexPromise ??= import('../data/hanzi-index.generated.json').then(
    ({ default: index }) => index as unknown as HanziIndex,
  )

  return findHanziComposition(await hanziIndexPromise, character)
}
