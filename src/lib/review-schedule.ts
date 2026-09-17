import { BasicLearningStepsStrategy, fsrs, Rating, State, StrategyMode, type Card, type Grade } from 'ts-fsrs'

export const REVIEW_TIME_ZONE = 'Asia/Shanghai'
export const REVIEW_TIME_LABEL = '14:00 Shanghai time'

const dayMs = 86_400_000
// Shanghai is UTC+8. Use UTC arithmetic so server and offline devices agree.
const shanghaiOffsetMs = 8 * 3_600_000
const reviewHourUtc = 6

export function reviewDay(date: Date) {
  return Math.floor((date.getTime() + shanghaiOffsetMs) / dayMs)
}

const scheduler = fsrs({
  request_retention: 0.95,
  enable_short_term: true,
  enable_fuzz: false,
  learning_steps: ['10m'],
  relearning_steps: ['10m'],
}).useStrategy(StrategyMode.LEARNING_STEPS, (parameters, state, step) => ({
  // Only a missed answer needs relearning. Every passing grade finishes the card.
  [Rating.Again]: BasicLearningStepsStrategy(parameters, state, step)[Rating.Again],
}))

function needsRepeat(state: number) {
  return state === State.Learning || state === State.Relearning
}

function batchOnDate(date: Date) {
  const localDate = new Date(date.getTime() + shanghaiOffsetMs)
  return Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), reviewHourUtc)
}

export function reviewDueAt(due: Date, lastReview: Date | null | undefined, state: number): Date {
  if (!lastReview) return due
  // Learn ahead without a timer: unfinished cards are eligible in this session.
  if (needsRepeat(state)) return lastReview
  return new Date(Math.max(batchOnDate(due), batchOnDate(lastReview) + dayMs))
}

export function compareReviewOrder(left: { due: Date | string; state: number }, right: { due: Date | string; state: number }) {
  return Number(needsRepeat(left.state)) - Number(needsRepeat(right.state))
    || new Date(left.due).getTime() - new Date(right.due).getTime()
}

export function scheduleReview(card: Card, reviewedAt: Date, rating: Grade): Card {
  const next = scheduler.next(card, reviewedAt, rating).card
  return { ...next, due: reviewDueAt(next.due, reviewedAt, next.state) }
}
