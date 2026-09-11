import { and, eq, inArray } from 'drizzle-orm'
import { createEmptyCard, fsrs, State, type Card, type Grade } from 'ts-fsrs'

import curriculumJson from '../data/curriculum.generated.json'
import { sentences } from '../data/sentences'
import { studyItemTypes, type Character, type Curriculum, type Word } from '../data/types'
import { db } from '../db'
import {
  componentProps,
  learnerItems,
  learners,
  mnemonics,
  palaceActors,
  palaceSets,
  reviewLogs,
  syncEvents,
  toneRooms,
  type ItemType,
  type LearnerItem,
} from '../db/schema'
import { characterForWord, characterIsWord, studyIdentity } from '../lib/character-words'
import { directCharacters } from '../lib/character-props'
import { groupHanziComponents } from '../lib/hanzi'
import { defaultToneRooms, getMovieCoordinates } from '../lib/pinyin'
import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
} from './curriculum.contract'

const LEARNER_ID = 'default'
const curriculum = curriculumJson as Curriculum
const charactersById = new Map(curriculum.characters.map((item) => [item.id, item]))
const wordsById = new Map(curriculum.words.map((item) => [String(item.id), item]))
const sentencesById = new Map(sentences.map((item) => [item.id, item]))
const uniqueWords = [...curriculum.words.reduce((items, item) => {
  if (!items.has(item.hanzi)) items.set(item.hanzi, item)
  return items
}, new Map<string, Word>()).values()]
const scheduler = fsrs({
  request_retention: 0.9,
  enable_short_term: true,
  learning_steps: ['10m'],
  relearning_steps: ['10m'],
})
const starterCharacterIds = ['一', '人', '个', '大', '太', '了', '也', '他', '不', '在', '有', '是', '马', '吗']

async function ensureLearner() {
  await db.insert(learners).values({ id: LEARNER_ID }).onConflictDoNothing()
}

function fromLearnerItem(item: LearnerItem): Card {
  return {
    due: item.due,
    stability: item.stability,
    difficulty: item.difficulty,
    elapsed_days: item.elapsedDays,
    scheduled_days: item.scheduledDays,
    learning_steps: item.learningSteps,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state as State,
    last_review: item.lastReview ?? undefined,
  }
}

function learnerItemValues(itemType: ItemType, itemId: string, card: Card, introducedAt?: Date) {
  return {
    learnerId: LEARNER_ID,
    itemType,
    itemId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review,
    ...(introducedAt ? { introducedAt } : {}),
  }
}

function scheduledCard(item: LearnerItem) {
  return {
    due: item.due.toISOString(),
    stability: item.stability,
    difficulty: item.difficulty,
    elapsedDays: item.elapsedDays,
    scheduledDays: item.scheduledDays,
    learningSteps: item.learningSteps,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state,
    lastReview: item.lastReview?.toISOString() ?? null,
  }
}

type MappingRows = Awaited<ReturnType<typeof getMappings>>

async function getMappings() {
  const [actors, sets, rooms, props, stories] = await Promise.all([
    db.select().from(palaceActors).where(eq(palaceActors.learnerId, LEARNER_ID)),
    db.select().from(palaceSets).where(eq(palaceSets.learnerId, LEARNER_ID)),
    db.select().from(toneRooms).where(eq(toneRooms.learnerId, LEARNER_ID)),
    db.select().from(componentProps).where(eq(componentProps.learnerId, LEARNER_ID)),
    db.select().from(mnemonics).where(eq(mnemonics.learnerId, LEARNER_ID)),
  ])
  return { actors, sets, rooms, props, stories }
}

function characterStudyItem(character: Character, mappings: MappingRows) {
  const coordinates = getMovieCoordinates(character.pinyin)
  const actor = mappings.actors.find((item) => item.actorKey === coordinates.actorKey)
  const set = mappings.sets.find((item) => item.finalKey === coordinates.finalKey)
  const room = mappings.rooms.find((item) => item.tone === coordinates.tone)
  const movieComponents = groupHanziComponents(directCharacters.has(character.hanzi) ? [character.hanzi] : character.components)
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
      actorName: actor?.actorName ?? '',
      setName: set?.setName ?? '',
      roomName: room?.roomName ?? defaultToneRooms[coordinates.tone],
      isPrimitive: character.componentStructure === 'atomic',
      componentNote: character.componentNote,
      components: movieComponents.map(({ hanzi: component, count }) => {
        const componentCharacter = charactersById.get(component)
        return {
          hanzi: component,
          count,
          propName: mappings.props.find((item) => item.component === component)?.propName ?? '',
          character: componentCharacter ? {
            pinyin: componentCharacter.pinyin,
            keyword: componentCharacter.keyword,
          } : null,
        }
      }),
      configured: Boolean(
        (directCharacters.has(character.hanzi) || (actor?.actorName && set?.setName && (room?.roomName || defaultToneRooms[coordinates.tone]))) &&
        movieComponents.every(({ hanzi: component }) => mappings.props.some((item) => item.component === component && item.propName)),
      ),
    },
  }
}

function wordStudyItem(word: Word, mappings: MappingRows) {
  const story = mappings.stories.find(
    (item) => item.itemType === 'word' && item.itemId === String(word.id),
  )
  return {
    type: 'word' as const,
    id: String(word.id),
    hanzi: word.hanzi,
    pinyin: word.pinyin,
    meaning: word.meaning,
    dictionaryMeanings: word.dictionaryMeanings,
    rank: word.rank,
    characterIds: word.characterIds,
    livingLink: story?.story ?? '',
  }
}

function resolveStudyItem(type: ItemType, id: string, mappings: MappingRows) {
  if (type === 'character') {
    const character = charactersById.get(id)
    return character ? characterStudyItem(character, mappings) : null
  }
  if (type === 'word') {
    const word = wordsById.get(id)
    return word ? wordStudyItem(word, mappings) : null
  }
  if (type === 'sentence') {
    const sentence = sentencesById.get(id)
    return sentence ? {
      type: 'sentence' as const,
      id: sentence.id,
      hanzi: sentence.hanzi,
      pinyin: sentence.pinyin,
      meaning: sentence.meaning,
    } : null
  }
  return null
}

export async function getDashboardHandler() {
  await ensureLearner()
  const mappings = await getMappings()
  const now = new Date()
  const rows = await db.select().from(learnerItems).where(and(
    eq(learnerItems.learnerId, LEARNER_ID),
    inArray(learnerItems.itemType, studyItemTypes),
  ))

  const items = rows.filter(item => item.itemType !== 'word' || !characterForWord(item.itemId))

  const itemKey = (type: ItemType, id: string) => `${type}:${id}`
  const introduced = new Set(items.map((item) => itemKey(item.itemType, item.itemId)))
  const introducedCharacters = new Set(
    items.filter((item) => item.itemType === 'character').map((item) => item.itemId),
  )
  const wordItems = items.filter((item) => item.itemType === 'word')
  const learnedWords = new Set([
    ...wordItems.flatMap(item => { const word = wordsById.get(item.itemId); return word ? [word.hanzi] : [] }),
    ...[...introducedCharacters].filter(characterIsWord),
  ])
  const introducedSentences = new Set(
    items.filter((item) => item.itemType === 'sentence').map((item) => item.itemId),
  )
  const dueItems = items
    .filter((item) => item.due <= now)
    .sort((left, right) => left.due.getTime() - right.due.getTime())
    .map((progress) => {
      const item = resolveStudyItem(progress.itemType, progress.itemId, mappings)
      return item ? {
        ...item,
        queueKind: 'review' as const,
        srsState: progress.state,
        reps: progress.reps,
        card: scheduledCard(progress),
      } : null
    })
    .filter((item) => item !== null)

  const knownProps = new Set(mappings.props.map((item) => item.component))
  const newCharacters = curriculum.characters
    .filter((item) => !introduced.has(itemKey('character', item.id)))
    .sort((left, right) => {
      const leftStarter = starterCharacterIds.indexOf(left.id)
      const rightStarter = starterCharacterIds.indexOf(right.id)
      if (leftStarter >= 0 || rightStarter >= 0) {
        if (leftStarter < 0) return 1
        if (rightStarter < 0) return -1
        return leftStarter - rightStarter
      }
      const leftMissing = [...new Set(left.components)].filter((component) => !knownProps.has(component)).length
      const rightMissing = [...new Set(right.components)].filter((component) => !knownProps.has(component)).length
      return leftMissing - rightMissing || left.frequencyRank - right.frequencyRank
    })
    .map((item) => ({ ...characterStudyItem(item, mappings), queueKind: 'new' as const }))

  const newWords = uniqueWords
    .filter(
      (item) =>
        !characterForWord(String(item.id)) &&
        !introduced.has(itemKey('word', String(item.id))) &&
        !learnedWords.has(item.hanzi) &&
        item.characterIds.every((character) => introducedCharacters.has(character)),
    )
    .map((item) => ({ ...wordStudyItem(item, mappings), queueKind: 'new' as const }))

  const getQueue = sentences
    .filter((sentence) => !introducedSentences.has(sentence.id))
    .map((sentence) => {
      const missingWords = sentence.words.filter((word) => !learnedWords.has(word))
      const characters = [...new Set(Array.from(sentence.hanzi).filter((character) => charactersById.has(character)))]
      const missingCharacters = characters.filter((character) => !introducedCharacters.has(character))
      const wordCoverage = sentence.words.length
        ? (sentence.words.length - missingWords.length) / sentence.words.length
        : 1
      const characterCoverage = characters.length
        ? (characters.length - missingCharacters.length) / characters.length
        : 1
      return {
        ...sentence,
        coverage: Math.min(wordCoverage, characterCoverage),
        missingWords,
        missingCharacters,
      }
    })
    .filter((sentence) => sentence.coverage >= 0.9)
    .sort((left, right) => right.coverage - left.coverage)
    .slice(0, 6)

  const nextDue = items
    .filter((item) => item.due > now)
    .reduce<Date | null>((earliest, item) => !earliest || item.due < earliest ? item.due : earliest, null)

  const scheduledQueue = items
    .filter((item) => item.due > now)
    .map((progress) => {
      const item = resolveStudyItem(progress.itemType, progress.itemId, mappings)
      return item ? {
        ...item,
        queueKind: 'review' as const,
        srsState: progress.state,
        reps: progress.reps,
        card: scheduledCard(progress),
      } : null
    })
    .filter((item) => item !== null)

  return {
    curriculum: {
      version: curriculum.version,
      characters: curriculum.characters.length,
      words: uniqueWords.length,
    },
    progress: {
      introducedCharacters: introducedCharacters.size,
      introducedWords: learnedWords.size,
    },
    reviewQueue: dueItems,
    buildQueue: [...newWords, ...newCharacters],
    getQueue,
    scheduledQueue,
    nextReviewAt: nextDue?.toISOString() ?? null,
  }
}

export async function enrollItemHandler(input: EnrollInput) {
  const data = { ...input, ...studyIdentity(input.itemType, input.itemId) }
  await ensureLearner()

  if (data.itemType === 'character' && !charactersById.has(data.itemId)) {
    throw new Error('Character not found')
  }
  if (data.itemType === 'word' && !wordsById.has(data.itemId)) {
    throw new Error('Word not found')
  }
  if (data.itemType === 'sentence' && !sentencesById.has(data.itemId)) {
    throw new Error('Sentence not found')
  }

  const introducedAt = new Date(data.enrolledAt)
  const card = createEmptyCard(introducedAt)
  await db
    .insert(learnerItems)
    .values(learnerItemValues(data.itemType, data.itemId, card, introducedAt))
    .onConflictDoNothing()

  return { due: card.due.toISOString(), state: card.state }
}

export async function reviewItemHandler(input: ReviewInput) {
  const data = { ...input, ...studyIdentity(input.itemType, input.itemId) }
  await ensureLearner()
  return db.transaction(async (transaction) => {
    const claimed = await transaction
      .insert(syncEvents)
      .values({ id: data.eventId, learnerId: LEARNER_ID })
      .onConflictDoNothing()
      .returning({ id: syncEvents.id })
    if (!claimed.length) return { duplicate: true as const }

    const existing = await transaction
      .select()
      .from(learnerItems)
      .where(
        and(
          eq(learnerItems.learnerId, LEARNER_ID),
          eq(learnerItems.itemType, data.itemType),
          eq(learnerItems.itemId, data.itemId),
        ),
      )
      .limit(1)

    if (!existing[0]) throw new Error('Card is not in review yet')

    const requestedReviewTime = new Date(data.reviewedAt)
    const reviewedAt = existing[0].lastReview && requestedReviewTime <= existing[0].lastReview
      ? new Date(existing[0].lastReview.getTime() + 1)
      : requestedReviewTime
    const currentCard = fromLearnerItem(existing[0])
    const nextCard = scheduler.next(currentCard, reviewedAt, data.rating as Grade).card
    const values = learnerItemValues(data.itemType, data.itemId, nextCard)

    await transaction
      .insert(learnerItems)
      .values(values)
      .onConflictDoUpdate({
        target: [learnerItems.learnerId, learnerItems.itemType, learnerItems.itemId],
        set: values,
      })
    await transaction.insert(reviewLogs).values({
      learnerId: LEARNER_ID,
      itemType: data.itemType,
      itemId: data.itemId,
      rating: data.rating,
      durationMs: data.durationMs,
      reviewedAt,
    })

    return { due: nextCard.due.toISOString(), state: nextCard.state, duplicate: false as const }
  })
}

export async function saveMovieHandler(data: MovieInput) {
  await ensureLearner()
  await Promise.all([
    ...(data.actorName
      ? [
          db
            .insert(palaceActors)
            .values({ learnerId: LEARNER_ID, actorKey: data.actorKey, actorName: data.actorName })
            .onConflictDoUpdate({
              target: [palaceActors.learnerId, palaceActors.actorKey],
              set: { actorName: data.actorName },
            }),
        ]
      : []),
    ...(data.setName
      ? [
          db
            .insert(palaceSets)
            .values({ learnerId: LEARNER_ID, finalKey: data.finalKey, setName: data.setName })
            .onConflictDoUpdate({
              target: [palaceSets.learnerId, palaceSets.finalKey],
              set: { setName: data.setName },
            }),
        ]
      : []),
    ...(data.roomName
      ? [
          db
            .insert(toneRooms)
            .values({ learnerId: LEARNER_ID, tone: data.tone, roomName: data.roomName })
            .onConflictDoUpdate({
              target: [toneRooms.learnerId, toneRooms.tone],
              set: { roomName: data.roomName },
            }),
        ]
      : []),
    ...data.props.map((prop) =>
      db
        .insert(componentProps)
        .values({
          learnerId: LEARNER_ID,
          component: prop.component,
          propName: prop.propName,
        })
        .onConflictDoUpdate({
          target: [componentProps.learnerId, componentProps.component],
          set: { propName: prop.propName },
        }),
    ),
  ])
  return { saved: true }
}

export async function saveLivingLinkHandler(data: LivingLinkInput) {
  await ensureLearner()
  await db
    .insert(mnemonics)
    .values({
      learnerId: LEARNER_ID,
      itemType: 'word',
      itemId: data.wordId,
      story: data.story,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mnemonics.learnerId, mnemonics.itemType, mnemonics.itemId],
      set: { story: data.story, updatedAt: new Date() },
    })
  return { saved: true }
}

export async function getLibraryHandler() {
  await ensureLearner()
  const items = await db
    .select()
    .from(learnerItems)
    .where(eq(learnerItems.learnerId, LEARNER_ID))
  const progress = new Map(
    items.map((item) => [
      `${item.itemType}:${item.itemId}`,
      item.state === State.Review ? 'review' as const : 'learning' as const,
    ]),
  )
  const wordProgress = new Map<string, 'learning' | 'review'>()
  for (const item of items.filter((entry) => entry.itemType === 'word')) {
    const word = wordsById.get(item.itemId)
    if (!word) continue
    const status = item.state === State.Review ? 'review' as const : 'learning' as const
    if (status === 'review' || !wordProgress.has(word.hanzi)) wordProgress.set(word.hanzi, status)
  }

  return {
    characters: curriculum.characters.map((character) => ({
      id: character.id,
      hanzi: character.hanzi,
      pinyin: character.pinyin,
      keyword: character.keyword,
      dictionaryMeanings: character.dictionaryMeanings,
      rank: character.frequencyRank,
      status: progress.get(`character:${character.id}`) ?? 'new' as const,
    })),
    words: uniqueWords.map((word) => ({
      id: String(word.id),
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      meaning: word.meaning,
      dictionaryMeanings: word.dictionaryMeanings,
      rank: word.rank,
      status: (characterForWord(String(word.id))
        ? progress.get(`character:${characterForWord(String(word.id))}`)
        : wordProgress.get(word.hanzi)) ?? 'new' as const,
    })),
  }
}

export async function getPalaceHandler() {
  await ensureLearner()
  const mappings = await getMappings()
  return {
    actors: mappings.actors
      .map(({ actorKey, actorName }) => ({ key: actorKey, name: actorName }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    sets: mappings.sets
      .map(({ finalKey, setName }) => ({ key: finalKey, name: setName }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    rooms: Object.entries(defaultToneRooms).map(([toneKey, defaultName]) => {
      const tone = Number(toneKey)
      return {
        tone,
        name: mappings.rooms.find((room) => room.tone === tone)?.roomName ?? defaultName,
      }
    }),
    props: mappings.props
      .map(({ component, propName }) => ({ key: component, name: propName }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  }
}
