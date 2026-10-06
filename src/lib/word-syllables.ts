import { pinyin } from 'pinyin-pro'

const toneless = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Split a word's curriculum pinyin into one syllable per character. pinyin-pro only supplies
 * the syllable boundaries; spelling and tones stay the curriculum's (东西 keeps neutral "xi").
 * Returns null when the two disagree, so callers can fall back to the whole reading.
 */
export function wordSyllables(hanzi: string, reading: string): string[] | null {
  const guesses = pinyin(hanzi, { type: 'array' })
  const letters = Array.from(reading.normalize('NFC').replace(/[\s'’]/g, ''))
  if (guesses.length !== Array.from(hanzi).length) return null
  const syllables: string[] = []
  let offset = 0
  for (const guess of guesses) {
    const length = Array.from(toneless(guess).normalize('NFC')).length
    const slice = letters.slice(offset, offset + length).join('')
    if (toneless(slice) !== toneless(guess)) return null
    syllables.push(slice)
    offset += length
  }
  return offset === letters.length ? syllables : null
}
