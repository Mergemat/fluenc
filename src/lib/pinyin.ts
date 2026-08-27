const tonedVowels: Record<string, { base: string; tone: number }> = {
  ā: { base: 'a', tone: 1 }, á: { base: 'a', tone: 2 }, ǎ: { base: 'a', tone: 3 }, à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 }, é: { base: 'e', tone: 2 }, ě: { base: 'e', tone: 3 }, è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 }, í: { base: 'i', tone: 2 }, ǐ: { base: 'i', tone: 3 }, ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 }, ó: { base: 'o', tone: 2 }, ǒ: { base: 'o', tone: 3 }, ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 }, ú: { base: 'u', tone: 2 }, ǔ: { base: 'u', tone: 3 }, ù: { base: 'u', tone: 4 },
  ǖ: { base: 'ü', tone: 1 }, ǘ: { base: 'ü', tone: 2 }, ǚ: { base: 'ü', tone: 3 }, ǜ: { base: 'ü', tone: 4 },
}

const standardInitials = [
  'zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
]
const fakeIFinals = new Set(['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si'])

export type MovieCoordinates = {
  syllable: string
  actorKey: string
  finalKey: string
  tone: number
  actorCategory: 'male' | 'female' | 'fictional' | 'wildcard'
}

export const defaultToneRooms: Record<number, string> = {
  1: 'Entrance hall',
  2: 'Kitchen',
  3: 'Bedroom',
  4: 'Bathroom',
  5: 'Rooftop',
}

function getActorCategory(actorKey: string): MovieCoordinates['actorCategory'] {
  if (actorKey.includes('ü')) return 'wildcard'
  if (actorKey.includes('u') || actorKey === 'w') return 'fictional'
  if (actorKey.includes('i') || actorKey === 'y') return 'female'
  return 'male'
}

export function getMovieCoordinates(pinyin: string): MovieCoordinates {
  const source = pinyin.toLowerCase().split(/[\s,/]+/)[0] || ''
  let tone = 5
  let syllable = ''

  for (const char of source) {
    const toned = tonedVowels[char]
    if (toned) {
      syllable += toned.base
      tone = toned.tone
    } else if (/^[1-5]$/.test(char)) {
      tone = Number(char)
    } else {
      syllable += char
    }
  }

  syllable = syllable.replace('u:', 'ü').replace('v', 'ü')
  if (syllable === 'er') return { syllable, actorKey: 'ø', finalKey: 'ø', tone, actorCategory: 'male' }

  const initial = standardInitials.find((candidate) => syllable.startsWith(candidate)) ?? ''
  if (fakeIFinals.has(syllable)) {
    return { syllable, actorKey: initial, finalKey: 'ø', tone, actorCategory: 'male' }
  }

  let actorKey = initial || 'ø'
  let final = syllable.slice(initial.length)

  if (initial === 'w') {
    if (final === 'u') final = ''
    else if (final === 'ei') final = 'ei'
  } else if (initial === 'y') {
    if (final === 'i') final = ''
    else if (final.startsWith('u')) {
      actorKey = 'yü'
      final = final.slice(1)
    }
  } else {
    if (final === 'iu') final = 'iou'
    if (final === 'ui') final = 'uei'
    if (final === 'un') final = 'uen'

    const carriedVowel = final.at(0)
    if (carriedVowel === 'i' || carriedVowel === 'u' || carriedVowel === 'ü') {
      actorKey = `${actorKey === 'ø' ? '' : actorKey}${carriedVowel}` || carriedVowel
      final = final.slice(1)
    }
  }

  if (final === 'n') final = 'en'
  if (final === 'ng') final = 'eng'

  return {
    syllable,
    actorKey,
    finalKey: final || 'ø',
    tone,
    actorCategory: getActorCategory(actorKey),
  }
}
