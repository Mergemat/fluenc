import { z } from 'zod'

import { isHanziCharacter } from './hanzi'
import { getMovieCoordinates } from './pinyin'

export type DictionaryReading = {
  traditional: string
  simplified: string
  pinyin: string
  senses: string[]
}

const keywordSchema = z.object({
  character: z.string().refine(isHanziCharacter),
  pinyin: z.string().regex(/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/),
  keyword: z.string().trim().min(1).max(60).regex(/^[^,;/]+$/, 'Choose one keyword, not a list of meanings'),
  sourcePinyin: z.string().min(1),
  sourceSense: z.string().min(1),
  note: z.string(),
})

export type CharacterKeyword = z.infer<typeof keywordSchema>

// The dictionary snapshot binds each sense to a reading. Reviews select a pair;
// neither dictionary order nor an unrelated character gloss can select a lesson.
export function resolveCharacterKeywords(
  characters: readonly string[],
  reviews: unknown,
  dictionary: Record<string, DictionaryReading[]>,
) {
  const entries = z.array(keywordSchema).parse(reviews)
  const lessons = new Map<string, { pinyin: string; keyword: string; dictionaryMeanings: string[] }>()
  const expected = new Set(characters)

  for (const entry of entries) {
    if (!expected.has(entry.character) || lessons.has(entry.character)) {
      throw new Error(`Unexpected or duplicate keyword: ${entry.character}`)
    }
    const reading = verifyDictionaryReading(entry.character, entry, dictionary)
    lessons.set(entry.character, {
      pinyin: entry.pinyin,
      keyword: entry.keyword,
      dictionaryMeanings: reading.senses,
    })
  }

  const missing = characters.filter(character => !lessons.has(character))
  if (missing.length) throw new Error(`Missing reviewed keywords (${missing.length}): ${missing.join(' ')}`)
  return lessons
}

export function verifyDictionaryReading(
  character: string,
  entry: { pinyin: string; sourcePinyin: string; sourceSense: string },
  dictionary: Record<string, DictionaryReading[]>,
) {
  const reading = dictionary[character]?.find(candidate =>
    (candidate.simplified === character || candidate.traditional === character) &&
    candidate.pinyin === entry.sourcePinyin && candidate.senses.includes(entry.sourceSense),
  )
  if (!reading) throw new Error(`Unverified reading and sense: ${character} ${entry.sourcePinyin}`)

  const selected = getMovieCoordinates(entry.pinyin)
  const pronunciations = [reading.pinyin, ...reading.senses.flatMap(sense => {
    const alternate = /^also pr\. \[([a-zü:]+[1-5])\]$/.exec(sense)?.[1]
    return alternate ? [alternate] : []
  })]
  const matches = pronunciations.some(pinyin => {
    const source = getMovieCoordinates(pinyin)
    return selected.syllable === source.syllable && selected.tone === source.tone
  })
  if (!matches) {
    throw new Error(`Reading mismatch: ${character} ${entry.pinyin} / ${entry.sourcePinyin}`)
  }
  return reading
}
