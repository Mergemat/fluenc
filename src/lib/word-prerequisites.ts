import type { Word } from '../data/types'

export function nextWordCharacters(words: Pick<Word, 'rank' | 'characterIds'>[], introduced: Set<string>) {
  const candidates = words.map(word => ({
    rank: word.rank,
    missing: [...new Set(word.characterIds)].filter(id => !introduced.has(id)),
    started: word.characterIds.some(id => introduced.has(id)),
  })).filter(word => word.started && word.missing.length > 0)
  candidates.sort((left, right) => left.missing.length - right.missing.length || left.rank - right.rank)
  return new Set(candidates[0]?.missing)
}
