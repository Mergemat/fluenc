import { createEmptyCard, type Card, type Grade } from 'ts-fsrs'

import { isStudyItemType, type studyItemTypes } from '../data/types'
import type { EnrollInput, LivingLinkInput, MovieInput, ReviewInput } from '../server/curriculum.contract'
import { catalog as courseCatalog, type Catalog } from './catalog'
import { studyIdentity } from './character-words'
import { scheduleReview } from './review-schedule'

type StudyItemType = typeof studyItemTypes[number]

export type CardSnapshot = {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview: string | null
}

/**
 * Everything stored for a learner. The dashboard, library and palace are derived from this and
 * the catalog, on the server and on the device alike.
 */
export type LearnerState = {
  /** Introduced material keyed by `cardKey`, in the order it was introduced. */
  cards: Record<string, CardSnapshot>
  /** Names keyed by actor initial, set final, tone and component. */
  actors: Record<string, string>
  sets: Record<string, string>
  rooms: Record<string, string>
  props: Record<string, string>
  /** Living Link stories keyed by word id. */
  livingLinks: Record<string, string>
}

export const emptyLearnerState: LearnerState = { cards: {}, actors: {}, sets: {}, rooms: {}, props: {}, livingLinks: {} }

export type ProgressOperation =
  | { kind: 'enroll'; data: EnrollInput }
  | { kind: 'livingLink'; data: LivingLinkInput }
  | { kind: 'movie'; data: MovieInput }
  | { kind: 'review'; data: ReviewInput }

export const cardKey = (type: StudyItemType, id: string) => `${type}:${id}`

export function parseCardKey(key: string) {
  const separator = key.indexOf(':')
  const type = key.slice(0, separator)
  return isStudyItemType(type) ? { type, id: key.slice(separator + 1) } : null
}

export function toCard(snapshot: CardSnapshot): Card {
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

export function toSnapshot(card: Card): CardSnapshot {
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

/** A review never lands at or before the card's last one, so retried and offline events stay ordered. */
export function reviewTime(lastReview: Date | null, requested: Date) {
  return lastReview && requested <= lastReview ? new Date(lastReview.getTime() + 1) : requested
}

function isInCatalog(type: StudyItemType, id: string, catalog: Catalog) {
  if (type === 'character') return catalog.charactersById.has(id)
  if (type === 'word') return catalog.wordsById.has(id)
  return catalog.sentencesById.has(id)
}

/** Apply one saved operation exactly as the server records it. */
export function applyOperation(state: LearnerState, operation: ProgressOperation, catalog: Catalog = courseCatalog): LearnerState {
  if (operation.kind === 'enroll') {
    const target = studyIdentity(operation.data.itemType, operation.data.itemId)
    const key = cardKey(target.itemType, target.itemId)
    if (state.cards[key] || !isInCatalog(target.itemType, target.itemId, catalog)) return state
    return { ...state, cards: { ...state.cards, [key]: toSnapshot(createEmptyCard(new Date(operation.data.enrolledAt))) } }
  }
  if (operation.kind === 'review') {
    const target = studyIdentity(operation.data.itemType, operation.data.itemId)
    const key = cardKey(target.itemType, target.itemId)
    const card = state.cards[key]
    if (!card) return state
    const reviewedAt = reviewTime(card.lastReview ? new Date(card.lastReview) : null, new Date(operation.data.reviewedAt))
    const next = scheduleReview(toCard(card), reviewedAt, operation.data.rating as Grade)
    return { ...state, cards: { ...state.cards, [key]: toSnapshot(next) } }
  }
  if (operation.kind === 'movie') {
    const { actorKey, actorName, finalKey, setName, tone, roomName, props } = operation.data
    return {
      ...state,
      actors: actorName ? { ...state.actors, [actorKey]: actorName } : state.actors,
      sets: setName ? { ...state.sets, [finalKey]: setName } : state.sets,
      rooms: roomName ? { ...state.rooms, [tone]: roomName } : state.rooms,
      props: props.length
        ? { ...state.props, ...Object.fromEntries(props.map(prop => [prop.component, prop.propName])) }
        : state.props,
    }
  }
  return { ...state, livingLinks: { ...state.livingLinks, [operation.data.wordId]: operation.data.story } }
}
