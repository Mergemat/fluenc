import { State } from 'ts-fsrs'
import type { ReviewItem } from '../server/curriculum'
import { reviewDay } from './review-schedule'

export const CATCH_UP_BATCH_SIZE = 20
export const EXTRA_PRACTICE_BATCH_SIZE = 20

export function oldestReviewedFirst(left: ReviewItem, right: ReviewItem) {
  return new Date(left.card.lastReview ?? 0).getTime() - new Date(right.card.lastReview ?? 0).getTime()
    || reviewKey(left).localeCompare(reviewKey(right))
}

export function extraPracticeQueue(items: ReviewItem[], batch: ReadonlyMap<string, number>) {
  return items.filter(item => {
    const initialReps = batch.get(reviewKey(item))
    return initialReps !== undefined && (item.reps === initialReps
      || item.card.state === State.Learning || item.card.state === State.Relearning)
  }).sort(oldestReviewedFirst)
}

export function reviewKey(item: Pick<ReviewItem, 'type' | 'id'>) {
  return `${item.type}:${item.id}`
}

export function partitionReviews(queue: ReviewItem[], now: Date, catchUpIds: ReadonlySet<string>) {
  const recent: ReviewItem[] = []
  const backlog: ReviewItem[] = []
  const today = reviewDay(now)
  for (const item of queue) {
    // Keep a missed catch-up card in its batch even though its next attempt is due now.
    const isBacklog = catchUpIds.has(reviewKey(item)) || today - reviewDay(new Date(item.card.due)) >= 7
    if (isBacklog) backlog.push(item)
    else recent.push(item)
  }
  return { recent, backlog }
}
