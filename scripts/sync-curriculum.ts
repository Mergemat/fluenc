import { parse } from 'csv-parse/sync'

import { characterWordEquivalences } from '../src/lib/character-word-equivalence'

import dictionarySource from '../src/data/dictionary.source.json'
import keywordReviews from '../src/data/character-keywords.reviewed.json'
import reviewedJson from '../src/data/reviewed-compositions.json'
import wordReviews from '../src/data/word-meanings.reviewed.json'
import { resolveCharacterKeywords } from '../src/lib/curriculum-readings'
import { resolveWordMeanings } from '../src/lib/word-meanings'
import { findHanziComposition, type HanziIndex, type ReviewedComposition } from '../src/lib/hanzi'

const WORDS_URL =
  'https://adsonant.com/word-frequency-lists/Adsonant-1000-most-common-chinese-words.csv'
const CHARACTERS_URL =
  'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt'

type CsvWord = {
  rank: string
  word: string
}

type DictionaryEntry = {
  character: string
  decomposition: string
  radical: string
}

const [wordsResponse, charactersResponse] = await Promise.all([
  fetch(WORDS_URL),
  fetch(CHARACTERS_URL),
])

if (!wordsResponse.ok || !charactersResponse.ok) {
  throw new Error(
    `Curriculum download failed: words=${wordsResponse.status}, characters=${charactersResponse.status}`,
  )
}

const records = parse(await wordsResponse.text(), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
}) as CsvWord[]

const dictionary = new Map<string, DictionaryEntry>()
for (const line of (await charactersResponse.text()).split('\n')) {
  if (!line.trim()) continue
  const entry = JSON.parse(line) as DictionaryEntry
  dictionary.set(entry.character, entry)
}

const hanziIndex = Object.fromEntries(
  [...dictionary.values()].map((entry) => [
    entry.character,
    [entry.radical, entry.decomposition],
  ]),
) as HanziIndex
const reviewed = new Map((reviewedJson as ReviewedComposition[]).map(entry => [entry.character, entry]))

const isHanzi = (value: string) => /[\p{Script=Han}\u2e80-\u2eff\u31c0-\u31ef]/u.test(value)
const splitHanzi = (value: string) => Array.from(value).filter(isHanzi)

const uniqueRecords = [...records.reduce((items, record) => {
  if (!items.has(record.word)) items.set(record.word, record)
  return items
}, new Map<string, CsvWord>()).values()]

const frequencyWords = uniqueRecords.map((record) => ({
  id: Number(record.rank),
  rank: Number(record.rank),
  hanzi: record.word,
}))
const words = resolveWordMeanings(frequencyWords, wordReviews, dictionarySource.entries).map(word => ({
  ...word,
  characterIds: [...new Set(splitHanzi(word.hanzi))],
}))

const stats = new Map<string, { rank: number; unlocks: number }>()
for (const word of words) {
  for (const hanzi of word.characterIds) {
    const current = stats.get(hanzi)
    stats.set(hanzi, {
      rank: Math.min(current?.rank ?? Number.POSITIVE_INFINITY, word.rank),
      unlocks: (current?.unlocks ?? 0) + 1,
    })
  }
}

const compositions = new Map([...stats.keys()].map(hanzi => [hanzi, findHanziComposition(hanziIndex, hanzi, reviewed.get(hanzi))]))
const incomplete = [...compositions].filter(([, composition]) => !composition).map(([hanzi]) => hanzi)
if (incomplete.length) throw new Error(`Incomplete decompositions (${incomplete.length}): ${incomplete.join(' ')}. Review these before generating the curriculum.`)

const keywords = resolveCharacterKeywords([...stats.keys()], keywordReviews, dictionarySource.entries)

const characters = [...stats.entries()]
  .map(([hanzi, characterStats]) => {
    const keyword = keywords.get(hanzi)!
    const composition = compositions.get(hanzi)!

    return {
      id: hanzi,
      hanzi,
      ...keyword,
      components: composition.components,
      componentStructure: composition.structure,
      componentNote: composition.glyphVariation || reviewed.get(hanzi)?.confidence === 'editorial' ? composition.note : null,
      frequencyRank: characterStats.rank,
      unlocks: characterStats.unlocks,
    }
  })
  .sort(
    (left, right) =>
      left.frequencyRank - right.frequencyRank ||
      right.unlocks - left.unlocks ||
      left.hanzi.localeCompare(right.hanzi),
  )

const curriculum = {
  version: '2026-09-23',
  sources: {
    words: WORDS_URL,
    characters: CHARACTERS_URL,
    decompositionReviews: 'src/data/reviewed-compositions.json',
    keywordReviews: 'src/data/character-keywords.reviewed.json',
    dictionary: dictionarySource.url,
    wordReviews: 'src/data/word-meanings.reviewed.json',
  },
  words,
  characters,
}

await Promise.all([
  Bun.write(
    new URL('../src/data/character-words.generated.json', import.meta.url),
    `${JSON.stringify(characterWordEquivalences(characters, words))}\n`,
  ),
  Bun.write(
    new URL('../src/data/curriculum.generated.json', import.meta.url),
    `${JSON.stringify(curriculum)}\n`,
  ),
  Bun.write(
    new URL('../src/data/hanzi-index.generated.json', import.meta.url),
    `${JSON.stringify(hanziIndex)}\n`,
  ),
])

console.log(
  `Synced ${words.length} words, ${characters.length} curriculum characters, and ${dictionary.size} Hanzi decompositions.`,
)
