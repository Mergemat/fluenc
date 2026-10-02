import { fsrs, State, type Card, type Grade } from 'ts-fsrs'

export const REVIEW_TIME_ZONE = 'Asia/Shanghai'

const dayMs = 86_400_000
// Shanghai is UTC+8. Use UTC arithmetic so server and offline devices agree.
const shanghaiOffsetMs = 8 * 3_600_000

export function reviewDay(date: Date) {
  return Math.floor((date.getTime() + shanghaiOffsetMs) / dayMs)
}

const scheduler = fsrs({
  request_retention: 0.95,
  enable_short_term: true,
  enable_fuzz: false,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

export function isLearning(state: number) {
  return state === State.Learning || state === State.Relearning
}

export function reviewDueAt(due: Date, state: number): Date {
  // Long-term reviews belong to a calendar day; short learning steps keep their exact time.
  return state === State.Review ? new Date(reviewDay(due) * dayMs - shanghaiOffsetMs) : due
}

export function compareReviewOrder(left: { due: Date | string; state: number }, right: { due: Date | string; state: number }) {
  const priority = (state: number) => isLearning(state) ? 0 : state === State.Review ? 1 : 2
  return priority(left.state) - priority(right.state)
    || new Date(left.due).getTime() - new Date(right.due).getTime()
}

export function scheduleReview(card: Card, reviewedAt: Date, rating: Grade): Card {
  const next = scheduler.next(card, reviewedAt, rating).card
  return { ...next, due: reviewDueAt(next.due, next.state) }
}
