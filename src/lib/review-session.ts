import type { ReviewItem } from '../server/curriculum'
import { reviewDay } from './review-schedule'

export const CATCH_UP_BATCH_SIZE = 20

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
