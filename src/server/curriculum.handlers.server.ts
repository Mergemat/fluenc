import { and, eq, gte } from 'drizzle-orm'
import { createEmptyCard, fsrs, State, type Card, type Grade } from 'ts-fsrs'

import curriculumJson from '../data/curriculum.generated.json'
import { sentences } from '../data/sentences'
import type { Character, Curriculum, Word } from '../data/types'
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
import {
  codebookCoordinateIds,
  codebookDirections,
  codebookItemId,
  codebookKinds,
  parseCodebookItemId,
  type CodebookKind,
} from '../lib/codebook'
import { defaultToneRooms, getMovieCoordinates } from '../lib/pinyin'
import { getToneSyllable } from '../lib/tones'
import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  PreferencesInput,
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

function codebookMappings(mappings: MappingRows) {
  return [
    ...mappings.actors.map((item) => ({
      kind: 'actor' as const,
      key: item.actorKey,
      association: item.actorName,
      code: item.actorKey,
    })),
    ...mappings.sets.map((item) => ({
      kind: 'set' as const,
      key: item.finalKey,
      association: item.setName,
      code: item.finalKey,
    })),
    ...mappings.rooms.map((item) => ({
      kind: 'tone' as const,
      key: String(item.tone),
      association: item.roomName,
      code: String(item.tone),
    })),
  ]
}

async function ensureCodebookItems(mappings: MappingRows) {
  const now = new Date()
  const values = codebookMappings(mappings).flatMap((mapping) =>
    codebookDirections.map((direction) =>
      learnerItemValues(mapping.kind, codebookItemId(mapping.key, direction), createEmptyCard(now)),
    ),
  )

  if (values.length) {
    await db.insert(learnerItems).values(values).onConflictDoNothing()
  }
}

async function resetCodebookCoordinate(kind: CodebookKind, key: string) {
  const now = new Date()
  await Promise.all(codebookCoordinateIds(kind, key).map(({ itemType, itemId }) => {
    const values = learnerItemValues(itemType, itemId, createEmptyCard(now))
    return db.insert(learnerItems).values(values).onConflictDoUpdate({
      target: [learnerItems.learnerId, learnerItems.itemType, learnerItems.itemId],
      set: values,
    })
  }))
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
  const movieComponents = character.components.length ? character.components : [character.hanzi]
  return {
    type: 'character' as const,
    id: character.id,
    hanzi: character.hanzi,
    pinyin: character.pinyin,
    meaning: character.meaningEn,
    rank: character.frequencyRank,
    unlocks: character.unlocks,
    movie: {
      ...coordinates,
      actorName: actor?.actorName ?? '',
      setName: set?.setName ?? '',
      roomName: room?.roomName ?? defaultToneRooms[coordinates.tone],
      isPrimitive: character.components.length === 0,
      components: movieComponents.map((component) => {
        const componentCharacter = charactersById.get(component)
        return {
          hanzi: component,
          propName: mappings.props.find((item) => item.component === component)?.propName ?? '',
          character: componentCharacter ? {
            pinyin: componentCharacter.pinyin,
            meaning: componentCharacter.meaningEn,
          } : null,
        }
      }),
      configured: Boolean(
        actor?.actorName && set?.setName && (room?.roomName || defaultToneRooms[coordinates.tone]) &&
        movieComponents.every((component) => mappings.props.some((item) => item.component === component && item.propName)),
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
    meaning: word.meaningEn,
    rank: word.rank,
    characterIds: word.characterIds,
    livingLink: story?.story ?? '',
  }
}

type ReviewableItemType = Extract<ItemType, 'character' | 'word' | 'sentence'>

function resolveStudyItem(type: ReviewableItemType, id: string, mappings: MappingRows) {
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

function resolveCodebookItem(item: LearnerItem, mappings: MappingRows) {
  if (!codebookKinds.includes(item.itemType as CodebookKind)) return null
  const parsed = parseCodebookItemId(item.itemId)
  if (!parsed) return null
  const mapping = codebookMappings(mappings).find(
    (candidate) => candidate.kind === item.itemType && candidate.key === parsed.key,
  )
  if (!mapping) return null

  const labels = {
    actor: { code: 'Initial', association: 'Actor' },
    set: { code: 'Final', association: 'Set' },
    tone: { code: 'Tone', association: 'Room' },
  }

  return {
    type: mapping.kind,
    id: item.itemId,
    direction: parsed.direction,
    code: mapping.kind === 'tone' ? getToneSyllable(Number(mapping.code)) : mapping.code,
    association: mapping.association,
    codeLabel: labels[mapping.kind].code,
    associationLabel: labels[mapping.kind].association,
    srsState: item.state,
    reps: item.reps,
    card: scheduledCard(item),
  }
}

export async function getDashboardHandler() {
  await ensureLearner()
  const mappings = await getMappings()
  await ensureCodebookItems(mappings)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const now = new Date()

  const [items, todayLogs, learner] = await Promise.all([
    db.select().from(learnerItems).where(eq(learnerItems.learnerId, LEARNER_ID)),
    db
      .select()
      .from(reviewLogs)
      .where(
        and(
          eq(reviewLogs.learnerId, LEARNER_ID),
          gte(reviewLogs.reviewedAt, startOfToday),
        ),
      ),
    db.select().from(learners).where(eq(learners.id, LEARNER_ID)).limit(1),
  ])

  const itemKey = (type: ItemType, id: string) => `${type}:${id}`
  const introduced = new Set(items.map((item) => itemKey(item.itemType, item.itemId)))
  const introducedCharacters = new Set(
    items.filter((item) => item.itemType === 'character').map((item) => item.itemId),
  )
  const wordItems = items.filter((item) => item.itemType === 'word')
  const learnedWords = new Set(wordItems.map((item) => wordsById.get(item.itemId)?.hanzi))
  const introducedSentences = new Set(
    items.filter((item) => item.itemType === 'sentence').map((item) => item.itemId),
  )
  const dueItems = items
    .filter((item): item is LearnerItem & { itemType: ReviewableItemType } =>
      (item.itemType === 'character' || item.itemType === 'word' || item.itemType === 'sentence') && item.due <= now,
    )
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

  const codebookQueue = items
    .filter((item) => codebookKinds.includes(item.itemType as CodebookKind) && item.due <= now)
    .sort((left, right) => left.due.getTime() - right.due.getTime())
    .map((item) => resolveCodebookItem(item, mappings))
    .filter((item) => item !== null)
  const profile = learner[0]
  const introducedToday = items.filter(
    (item) =>
      (item.itemType === 'character' || item.itemType === 'word') &&
      item.introducedAt >= startOfToday,
  )
  const introducedCharactersToday = introducedToday.filter((item) => item.itemType === 'character').length
  const introducedWordsToday = introducedToday.filter((item) => item.itemType === 'word').length
  const remainingCharacterGoal = Math.max(0, profile.dailyCharacterGoal - introducedCharactersToday)
  const remainingWordGoal = Math.max(0, profile.dailyWordGoal - introducedWordsToday)
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
      const leftMissing = left.components.filter((component) => !knownProps.has(component)).length
      const rightMissing = right.components.filter((component) => !knownProps.has(component)).length
      return leftMissing - rightMissing || left.frequencyRank - right.frequencyRank
    })
    .slice(0, remainingCharacterGoal)
    .map((item) => ({ ...characterStudyItem(item, mappings), queueKind: 'new' as const }))

  const newWords = uniqueWords
    .filter(
      (item) =>
        !introduced.has(itemKey('word', String(item.id))) &&
        !learnedWords.has(item.hanzi) &&
        item.characterIds.every((character) => introducedCharacters.has(character)),
    )
    .slice(0, remainingWordGoal)
    .map((item) => ({ ...wordStudyItem(item, mappings), queueKind: 'new' as const }))

  const activeCharacter = newCharacters[0]
  const activeCoordinates = activeCharacter
    ? new Set([
      `actor:${activeCharacter.movie.actorKey}`,
      `set:${activeCharacter.movie.finalKey}`,
      `tone:${activeCharacter.movie.tone}`,
    ])
    : new Set<string>()
  const mirrorSpacingStart = new Date(now.getTime() - 5 * 60 * 1000)
  const recentlyReviewedCoordinates = new Set(
    todayLogs
      .filter((log) =>
        codebookKinds.includes(log.itemType as CodebookKind) &&
        log.reviewedAt >= mirrorSpacingStart,
      )
      .map((log) => `${log.itemType}:${parseCodebookItemId(log.itemId)?.key}`),
  )
  const queueScore = (item: (typeof codebookQueue)[number]) => {
    const coordinate = `${item.type}:${parseCodebookItemId(item.id)?.key}`
    return [
      recentlyReviewedCoordinates.has(coordinate) ? 1 : 0,
      activeCoordinates.has(coordinate) ? 0 : 1,
      item.direction === 'encode' ? 0 : 1,
    ]
  }
  codebookQueue.sort((left, right) => {
    const leftScore = queueScore(left)
    const rightScore = queueScore(right)
    return leftScore[0] - rightScore[0] || leftScore[1] - rightScore[1] || leftScore[2] - rightScore[2]
  })

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
      if (progress.itemType === 'character' || progress.itemType === 'word' || progress.itemType === 'sentence') {
        const item = resolveStudyItem(progress.itemType, progress.itemId, mappings)
        return item ? {
          ...item,
          queueKind: 'review' as const,
          srsState: progress.state,
          reps: progress.reps,
          card: scheduledCard(progress),
        } : null
      }
      return resolveCodebookItem(progress, mappings)
    })
    .filter((item) => item !== null)

  return {
    learner: profile,
    curriculum: {
      version: curriculum.version,
      characters: curriculum.characters.length,
      words: uniqueWords.length,
    },
    progress: {
      introducedCharacters: introducedCharacters.size,
      introducedWords: learnedWords.size,
      introducedCharactersToday,
      introducedWordsToday,
    },
    reviewQueue: dueItems,
    codebookQueue,
    buildQueue: [...newWords, ...newCharacters],
    getQueue,
    scheduledQueue,
    nextReviewAt: nextDue?.toISOString() ?? null,
  }
}

export async function enrollItemHandler(data: EnrollInput) {
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

export async function reviewItemHandler(data: ReviewInput) {
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
  const previous = await getMappings()
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
  const changedCoordinates = [
    ...(data.actorName && previous.actors.find((item) => item.actorKey === data.actorKey)?.actorName !== data.actorName
      ? [{ kind: 'actor' as const, key: data.actorKey }]
      : []),
    ...(data.setName && previous.sets.find((item) => item.finalKey === data.finalKey)?.setName !== data.setName
      ? [{ kind: 'set' as const, key: data.finalKey }]
      : []),
    ...(data.roomName && previous.rooms.find((item) => item.tone === data.tone)?.roomName !== data.roomName
      ? [{ kind: 'tone' as const, key: String(data.tone) }]
      : []),
  ]
  await Promise.all(changedCoordinates.map((coordinate) =>
    resetCodebookCoordinate(coordinate.kind, coordinate.key),
  ))
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
      meaning: character.meaningEn,
      rank: character.frequencyRank,
      status: progress.get(`character:${character.id}`) ?? 'new' as const,
    })),
    words: uniqueWords.map((word) => ({
      id: String(word.id),
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      meaning: word.meaningEn,
      rank: word.rank,
      status: wordProgress.get(word.hanzi) ?? 'new' as const,
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

export async function savePreferencesHandler(data: PreferencesInput) {
  await ensureLearner()
  await db
    .update(learners)
    .set(data)
    .where(eq(learners.id, LEARNER_ID))
  return { saved: true }
}
