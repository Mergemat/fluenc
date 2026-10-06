import { State } from 'ts-fsrs'

import type { Character, Word } from '../data/types'
import { catalog as courseCatalog, type Catalog } from './catalog'
import { directCharacters } from './character-props'
import { characterForWord, characterIsWord } from './character-words'
import { groupHanziComponents } from './hanzi'
import { cardKey, parseCardKey, type CardSnapshot, type LearnerState } from './learner-state'
import { defaultToneRooms, getMovieCoordinates } from './pinyin'
import { compareReviewOrder, reviewDueAt } from './review-schedule'
import { nextWordCharacters } from './word-prerequisites'

const starterCharacterIds = ['一', '人', '个', '大', '太', '了', '也', '他', '不', '在', '有', '是', '马', '吗']

function characterStudyItem(character: Character, state: LearnerState, catalog: Catalog) {
  const coordinates = getMovieCoordinates(character.pinyin)
  const actorName = state.actors[coordinates.actorKey] ?? ''
  const setName = state.sets[coordinates.finalKey] ?? ''
  const roomName = state.rooms[coordinates.tone] ?? defaultToneRooms[coordinates.tone]
  const direct = directCharacters.has(character.hanzi)
  const movieComponents = groupHanziComponents(direct ? [character.hanzi] : character.components)
  return {
    type: 'character' as const,
    id: character.id,
    hanzi: character.hanzi,
    pinyin: character.pinyin,
    keyword: character.keyword,
    dictionaryMeanings: character.dictionaryMeanings,
    rank: character.frequencyRank,
    unlocks: character.unlocks,
    movie: {
      ...coordinates,
      actorName,
      setName,
      roomName,
      isPrimitive: character.componentStructure === 'atomic',
      componentNote: character.componentNote,
      components: movieComponents.map(({ hanzi: component, count }) => {
        const componentCharacter = catalog.charactersById.get(component)
        return {
          hanzi: component,
          count,
          propName: state.props[component] ?? '',
          character: componentCharacter ? { pinyin: componentCharacter.pinyin, keyword: componentCharacter.keyword } : null,
        }
      }),
      configured: Boolean(
        (direct || (actorName && setName && roomName)) &&
        movieComponents.every(({ hanzi: component }) => state.props[component]),
      ),
    },
  }
}

function characterParts(word: Word, catalog: Catalog) {
  return word.characterIds.map(id => {
    const character = catalog.charactersById.get(id)
    if (!character) throw new Error(`Missing curriculum character: ${id}`)
    return { id, hanzi: character.hanzi, meaning: character.keyword }
  })
}

function wordStudyItem(word: Word, state: LearnerState, catalog: Catalog) {
  return {
    type: 'word' as const,
    id: String(word.id),
    hanzi: word.hanzi,
    pinyin: word.pinyin,
    meaning: word.meaning,
    dictionaryMeanings: word.dictionaryMeanings,
    rank: word.rank,
    characterIds: word.characterIds,
    syllables: word.syllables,
    characterParts: characterParts(word, catalog).map(({ hanzi, meaning }) => ({ hanzi, meaning })),
    livingLink: state.livingLinks[String(word.id)] ?? '',
  }
}

function studyItem(type: 'character' | 'word' | 'sentence', id: string, state: LearnerState, catalog: Catalog) {
  if (type === 'character') {
    const character = catalog.charactersById.get(id)
    return character ? characterStudyItem(character, state, catalog) : null
  }
  if (type === 'word') {
    const word = catalog.wordsById.get(id)
    return word ? wordStudyItem(word, state, catalog) : null
  }
  const sentence = catalog.sentencesById.get(id)
  return sentence ? { type: 'sentence' as const, id: sentence.id, hanzi: sentence.hanzi, pinyin: sentence.pinyin, meaning: sentence.meaning } : null
}

/**
 * Introduced cards, skipping words that are now taught as their single character. Sorted like the
 * database's key so a device and the server break review-order ties the same way.
 */
function introducedCards(state: LearnerState) {
  return Object.entries(state.cards)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .flatMap(([key, card]) => {
      const target = parseCardKey(key)
      if (!target || (target.type === 'word' && characterForWord(target.id))) return []
      return [{ ...target, card }]
    })
}

/** Review, Build and Get queues at a moment in time. */
export function deriveDashboard(state: LearnerState, now: Date, catalog: Catalog = courseCatalog) {
  const items = introducedCards(state).map(item => ({
    ...item,
    card: { ...item.card, due: reviewDueAt(new Date(item.card.due), item.card.state).toISOString() },
  }))
  const introduced = new Set(items.map(item => cardKey(item.type, item.id)))
  const introducedCharacters = new Set(items.filter(item => item.type === 'character').map(item => item.id))
  const learnedWords = new Set([
    ...items.flatMap(item => {
      const word = item.type === 'word' ? catalog.wordsById.get(item.id) : undefined
      return word ? [word.hanzi] : []
    }),
    ...[...introducedCharacters].filter(characterIsWord),
  ])
  const introducedSentences = new Set(items.filter(item => item.type === 'sentence').map(item => item.id))
  const scheduled = (item: typeof items[number]) => {
    const resolved = studyItem(item.type, item.id, state, catalog)
    return resolved ? { ...resolved, queueKind: 'review' as const, srsState: item.card.state, reps: item.card.reps, card: item.card as CardSnapshot } : null
  }
  const nowIso = now.toISOString()
  const reviewQueue = items
    .filter(item => item.card.due <= nowIso)
    .sort((left, right) => compareReviewOrder(left.card, right.card))
    .map(scheduled)
    .filter(item => item !== null)
  const scheduledQueue = items
    .filter(item => item.card.due > nowIso)
    .map(scheduled)
    .filter(item => item !== null)

  const unintroducedWords = catalog.uniqueWords
    .filter(item => !characterForWord(String(item.id)) && !introduced.has(cardKey('word', String(item.id))) && !learnedWords.has(item.hanzi))
    .map(item => ({ ...wordStudyItem(item, state, catalog), queueKind: 'new' as const }))
  const wordReady = (item: typeof unintroducedWords[number]) => item.characterIds.every(character => introducedCharacters.has(character))
  const newWords = unintroducedWords.filter(wordReady)
  const lockedWords = unintroducedWords.filter(item => !wordReady(item))
  const nextWordParts = nextWordCharacters(lockedWords, introducedCharacters)
  const missingProps = (character: Character) => [...new Set(character.components)].filter(component => !state.props[component]).length
  const newCharacters = catalog.characters
    .filter(item => !introduced.has(cardKey('character', item.id)))
    .map(character => ({ character, missingProps: missingProps(character) }))
    .sort(({ character: left, missingProps: leftMissing }, { character: right, missingProps: rightMissing }) => {
      const wordPriority = Number(nextWordParts.has(right.id)) - Number(nextWordParts.has(left.id))
      if (wordPriority) return wordPriority
      const leftStarter = starterCharacterIds.indexOf(left.id)
      const rightStarter = starterCharacterIds.indexOf(right.id)
      if (leftStarter >= 0 || rightStarter >= 0) {
        if (leftStarter < 0) return 1
        if (rightStarter < 0) return -1
        return leftStarter - rightStarter
      }
      return leftMissing - rightMissing || left.frequencyRank - right.frequencyRank
    })
    .map(({ character }) => ({ ...characterStudyItem(character, state, catalog), queueKind: 'new' as const }))

  const getQueue = catalog.sentences
    .filter(sentence => !introducedSentences.has(sentence.id))
    .map(sentence => {
      const missingWords = sentence.words.filter(word => !learnedWords.has(word))
      const characters = [...new Set(Array.from(sentence.hanzi).filter(character => catalog.charactersById.has(character)))]
      const missingCharacters = characters.filter(character => !introducedCharacters.has(character))
      const wordCoverage = sentence.words.length ? (sentence.words.length - missingWords.length) / sentence.words.length : 1
      const characterCoverage = characters.length ? (characters.length - missingCharacters.length) / characters.length : 1
      return { ...sentence, coverage: Math.min(wordCoverage, characterCoverage), missingWords, missingCharacters }
    })
    .filter(sentence => sentence.coverage >= 0.9)
    .sort((left, right) => right.coverage - left.coverage)
    .slice(0, 6)

  return {
    curriculum: { version: catalog.version, characters: catalog.characters.length, words: catalog.uniqueWords.length },
    progress: { introducedCharacters: introducedCharacters.size, introducedWords: learnedWords.size },
    reviewQueue,
    buildQueue: [...newWords, ...newCharacters],
    lockedWords,
    getQueue,
    scheduledQueue,
    nextReviewAt: scheduledQueue.reduce<string | null>((earliest, item) => !earliest || item.card.due < earliest ? item.card.due : earliest, null),
  }
}

/** Every course entry with the learner's status, so entry pages render offline. */
export function deriveLibrary(state: LearnerState, catalog: Catalog = courseCatalog) {
  const status = (card: CardSnapshot) => card.state === State.Review ? 'review' as const : 'learning' as const
  const wordProgress = new Map<string, 'learning' | 'review'>()
  for (const [key, card] of Object.entries(state.cards)) {
    const target = parseCardKey(key)
    const word = target?.type === 'word' ? catalog.wordsById.get(target.id) : undefined
    if (!word) continue
    if (status(card) === 'review' || !wordProgress.has(word.hanzi)) wordProgress.set(word.hanzi, status(card))
  }
  const characterStatus = (id: string) => {
    const card = state.cards[cardKey('character', id)]
    return card ? status(card) : undefined
  }

  return {
    characters: catalog.characters.map(character => ({
      id: character.id,
      hanzi: character.hanzi,
      pinyin: character.pinyin,
      keyword: character.keyword,
      dictionaryMeanings: character.dictionaryMeanings,
      rank: character.frequencyRank,
      status: characterStatus(character.id) ?? 'new' as const,
      movie: getMovieCoordinates(character.pinyin),
      components: groupHanziComponents(directCharacters.has(character.hanzi) ? [character.hanzi] : character.components),
      structure: character.componentStructure,
      componentNote: character.componentNote,
    })),
    words: catalog.uniqueWords.map(word => {
      const id = String(word.id)
      const character = characterForWord(id)
      return {
        id,
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        meaning: word.meaning,
        dictionaryMeanings: word.dictionaryMeanings,
        rank: word.rank,
        syllables: word.syllables,
        characterParts: characterParts(word, catalog),
        livingLink: state.livingLinks[id] ?? '',
        status: (character ? characterStatus(character) : wordProgress.get(word.hanzi)) ?? 'new' as const,
      }
    }),
  }
}

/** The learner's named actors, sets, tone rooms and props. */
export function derivePalace(state: LearnerState) {
  const named = (names: Record<string, string>) => Object.entries(names)
    .map(([key, name]) => ({ key, name }))
    .sort((left, right) => left.key.localeCompare(right.key))
  return {
    actors: named(state.actors),
    sets: named(state.sets),
    rooms: Object.entries(defaultToneRooms).map(([tone, name]) => ({ tone: Number(tone), name: state.rooms[tone] ?? name })),
    props: named(state.props),
  }
}

export type DashboardData = ReturnType<typeof deriveDashboard>
export type BuildItem = DashboardData['buildQueue'][number]
export type ReviewItem = DashboardData['reviewQueue'][number]
export type StudyItem = BuildItem | ReviewItem
export type LibraryData = ReturnType<typeof deriveLibrary>
export type PalaceData = ReturnType<typeof derivePalace>
