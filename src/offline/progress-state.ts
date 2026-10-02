import { createEmptyCard, State, type Card, type Grade } from 'ts-fsrs'

import { isStudyItemType } from '../data/types'
import { characterForWord, characterIsWord, studyIdentity } from '../lib/character-words'
import { nextWordCharacters } from '../lib/word-prerequisites'
import { compareReviewOrder, reviewDueAt, scheduleReview } from '../lib/review-schedule'
import type { EnrollInput, LivingLinkInput, MovieInput, ReviewInput } from '../server/curriculum.contract'
import type { DashboardData, LibraryData, PalaceData } from '../server/curriculum'

export type ProgressOperation =
  | { kind: 'enroll'; data: EnrollInput }
  | { kind: 'livingLink'; data: LivingLinkInput }
  | { kind: 'movie'; data: MovieInput }
  | { kind: 'review'; data: ReviewInput }

type CardSnapshot = DashboardData['scheduledQueue'][number]['card']
type ReviewQueueItem = DashboardData['reviewQueue'][number]
type ScheduledQueueItem = DashboardData['scheduledQueue'][number]

function toCard(snapshot: CardSnapshot): Card {
  return {
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningSteps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: snapshot.state,
    last_review: snapshot.lastReview ? new Date(snapshot.lastReview) : undefined,
  }
}

function toSnapshot(card: Card): CardSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString() ?? null,
  }
}

function itemKey(item: { type: string; id: string }) {
  return `${item.type}:${item.id}`
}

export function refreshDueQueues(data: DashboardData, now = new Date()) {
  const next = { ...data }
  const independent = (item: { type: string; id: string }) => isStudyItemType(item.type) && (item.type !== 'word' || !characterForWord(item.id))
  next.buildQueue = next.buildQueue.filter(independent)
  const items = new Map([...data.reviewQueue, ...data.scheduledQueue]
    .filter(independent).map(item => [itemKey(item), item]))
  next.reviewQueue = []
  next.scheduledQueue = []
  for (const item of items.values()) {
    const due = reviewDueAt(new Date(item.card.due), item.card.state)
    const scheduled = { ...item, card: { ...item.card, due: due.toISOString() } }
    if (due <= now) next.reviewQueue.push(scheduled)
    else next.scheduledQueue.push(scheduled)
  }
  next.reviewQueue.sort((left, right) => compareReviewOrder(left.card, right.card))

  next.nextReviewAt = next.scheduledQueue
    .reduce<string | null>((earliest, item) => !earliest || item.card.due < earliest ? item.card.due : earliest, null)
  return next
}

function applyReview(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'review' }>) {
  const target = studyIdentity(operation.data.itemType, operation.data.itemId)
  const key = `${target.itemType}:${target.itemId}`
  const item = [...data.reviewQueue, ...data.scheduledQueue].find((candidate) => itemKey(candidate) === key)
  if (!item) return data

  const reviewedAt = new Date(operation.data.reviewedAt)
  const nextCard = scheduleReview(toCard(item.card), reviewedAt, operation.data.rating as Grade)
  const scheduled = {
    ...item,
    card: toSnapshot(nextCard),
    reps: nextCard.reps,
    srsState: nextCard.state,
  } as ScheduledQueueItem
  const next = { ...data }
  next.reviewQueue = next.reviewQueue.filter((candidate) => itemKey(candidate) !== key)
  next.scheduledQueue = [
    ...next.scheduledQueue.filter((candidate) => itemKey(candidate) !== key),
    scheduled,
  ]
  return refreshDueQueues(next, reviewedAt)
}

function applyEnrollment(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'enroll' }>) {
  const target = studyIdentity(operation.data.itemType, operation.data.itemId)
  const key = `${target.itemType}:${target.itemId}`
  const buildItem = data.buildQueue.find((item) => itemKey(item) === key)
  const readingItem = operation.data.itemType === 'sentence'
    ? data.getQueue.find((item) => item.id === operation.data.itemId)
    : undefined
  const source = buildItem ?? readingItem
  if (!source) return data

  const next = { ...data }
  const card = createEmptyCard(new Date(operation.data.enrolledAt))
  next.buildQueue = next.buildQueue.filter((item) => itemKey(item) !== key)
  next.getQueue = next.getQueue.filter((item) => item.id !== operation.data.itemId)
  next.reviewQueue = [...next.reviewQueue, {
    ...source,
    type: target.itemType,
    queueKind: 'review',
    srsState: card.state,
    reps: card.reps,
    card: toSnapshot(card),
  } as ReviewQueueItem]

  if (target.itemType === 'character') {
    const introduced = new Set([...next.reviewQueue, ...next.scheduledQueue]
      .filter(item => item.type === 'character').map(item => item.id))
    const unlocked = next.lockedWords.filter(word => word.characterIds.every(id => introduced.has(id)))
    const unlockedIds = new Set(unlocked.map(word => word.id))
    next.lockedWords = next.lockedWords.filter(word => !unlockedIds.has(word.id))
    const words = [...next.buildQueue.filter(item => item.type === 'word'), ...unlocked]
      .sort((left, right) => left.rank - right.rank)
    const nextWordParts = nextWordCharacters(next.lockedWords, introduced)
    const characters = next.buildQueue.filter(item => item.type === 'character')
      .sort((left, right) => Number(nextWordParts.has(right.id)) - Number(nextWordParts.has(left.id)))
    next.buildQueue = [...words, ...characters]
  }

  next.progress = { ...data.progress }
  if (target.itemType === 'character') {
    next.progress.introducedCharacters += 1
    if (characterIsWord(target.itemId)) next.progress.introducedWords += 1
  } else if (target.itemType === 'word') {
    next.progress.introducedWords += 1
  }
  return refreshDueQueues(next, new Date(operation.data.enrolledAt))
}

function applyMovie(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'movie' }>) {
  const next = { ...data }
  next.buildQueue = next.buildQueue.map((item) => {
    if (item.type !== 'character' || item.id !== operation.data.characterId) return item
    return {
      ...item,
      movie: {
        ...item.movie,
        actorName: operation.data.actorName || item.movie.actorName,
        setName: operation.data.setName || item.movie.setName,
        roomName: operation.data.roomName || item.movie.roomName,
        configured: true,
        components: item.movie.components.map((component) => ({
          ...component,
          propName: operation.data.props.find((prop) => prop.component === component.hanzi)?.propName ?? component.propName,
        })),
      },
    }
  })
  return next
}

export function applyOperation(data: DashboardData, operation: ProgressOperation) {
  if (operation.kind === 'review') return applyReview(data, operation)
  if (operation.kind === 'enroll') return applyEnrollment(data, operation)
  if (operation.kind === 'movie') return applyMovie(data, operation)
  const next = { ...data }
  next.buildQueue = next.buildQueue.map((item) =>
    item.type === 'word' && item.id === operation.data.wordId
      ? { ...item, livingLink: operation.data.story }
      : item,
  )
  return next
}

export function applyLibraryOperation(data: LibraryData, dashboard: DashboardData, operation: ProgressOperation) {
  if (operation.kind !== 'enroll' && operation.kind !== 'review') return data
  if (operation.data.itemType !== 'character' && operation.data.itemType !== 'word') return data
  const target = studyIdentity(operation.data.itemType, operation.data.itemId)
  const reviewedItem = dashboard.scheduledQueue.find(
    item => item.type === target.itemType && item.id === target.itemId,
  )
  const status = reviewedItem?.srsState === State.Review ? 'review' as const : 'learning' as const
  return {
    ...data,
    characters: data.characters.map(item => target.itemType === 'character' && item.id === target.itemId ? { ...item, status } : item),
    words: data.words.map(item => {
      const identity = studyIdentity('word', item.id)
      return identity.itemType === target.itemType && identity.itemId === target.itemId ? { ...item, status } : item
    }),
  }
}

export function applyPalaceOperation(data: PalaceData, operation: ProgressOperation) {
  if (operation.kind !== 'movie') return data
  const next = { ...data }
  const upsert = (items: Array<{ key: string; name: string }>, key: string, name: string) => {
    if (!name) return items
    return [...items.filter((item) => item.key !== key), { key, name }]
      .sort((left, right) => left.key.localeCompare(right.key))
  }
  next.actors = upsert(next.actors, operation.data.actorKey, operation.data.actorName)
  next.sets = upsert(next.sets, operation.data.finalKey, operation.data.setName)
  next.props = operation.data.props.reduce(
    (items, prop) => upsert(items, prop.component, prop.propName),
    next.props,
  )
  next.rooms = next.rooms.map((room) =>
    room.tone === operation.data.tone && operation.data.roomName
      ? { ...room, name: operation.data.roomName }
      : room,
  )
  return next
}
