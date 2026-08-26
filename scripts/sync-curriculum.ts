import { parse } from 'csv-parse/sync'

const WORDS_URL =
  'https://adsonant.com/word-frequency-lists/Adsonant-1000-most-common-chinese-words.csv'
const CHARACTERS_URL =
  'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt'

type CsvWord = {
  rank: string
  word: string
  pinyin: string
  english: string
}

type DictionaryEntry = {
  character: string
  definition?: string
  pinyin: string[]
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

const isHanzi = (value: string) => /[\p{Script=Han}\u2e80-\u2eff\u31c0-\u31ef]/u.test(value)
const splitHanzi = (value: string) => Array.from(value).filter(isHanzi)
const componentOverrides: Record<string, string[]> = {
  人: ['丿', '㇏'],
}

const uniqueRecords = [...records.reduce((items, record) => {
  if (!items.has(record.word)) items.set(record.word, record)
  return items
}, new Map<string, CsvWord>()).values()]

const words = uniqueRecords.map((record) => ({
  id: Number(record.rank),
  rank: Number(record.rank),
  hanzi: record.word,
  pinyin: record.pinyin,
  meaningEn: record.english,
  characterIds: [...new Set(splitHanzi(record.word))],
}))

const firstStandaloneWord = new Map(
  words
    .filter((word) => word.characterIds.length === 1 && word.hanzi.length === 1)
    .map((word) => [word.hanzi, word]),
)

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

const characters = [...stats.entries()]
  .map(([hanzi, characterStats]) => {
    const dictionaryEntry = dictionary.get(hanzi)
    const standalone = firstStandaloneWord.get(hanzi)
    const components = componentOverrides[hanzi] ?? (dictionaryEntry?.decomposition
      ? [
          ...new Set(
            splitHanzi(dictionaryEntry.decomposition).filter(
              (component) => component !== hanzi,
            ),
          ),
        ]
      : [])

    return {
      id: hanzi,
      hanzi,
      pinyin: dictionaryEntry?.pinyin.at(0) ?? standalone?.pinyin ?? '',
      meaningEn: dictionaryEntry?.definition ?? standalone?.meaningEn ?? '',
      radical: dictionaryEntry?.radical ?? '',
      decomposition: dictionaryEntry?.decomposition ?? hanzi,
      components,
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

const payload = {
  version: '2026-08-26',
  sources: {
    words: WORDS_URL,
    characters: CHARACTERS_URL,
  },
  words,
  characters,
}

await Bun.write(
  new URL('../src/data/curriculum.generated.json', import.meta.url),
  `${JSON.stringify(payload)}\n`,
)

console.log(`Synced ${words.length} words and ${characters.length} characters.`)
