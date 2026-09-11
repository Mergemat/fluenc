import { useRef } from 'react'

import { useProgressMutation } from '../offline/useProgressMutation'
import { saveReview } from '../offline/progress'
import type { DashboardData } from '../server/curriculum'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { Empty, ErrorNote, PageHeader } from './ui/Layout'

export function ReviewView({ data }: { data: DashboardData }) {
  const cardStartedAt = useRef(Date.now())
  const activeReview = data.reviewQueue[0]
  const dueCount = data.reviewQueue.length

  const mutation = useProgressMutation(saveReview)
  const rate = (rating: number) => {
    if (!activeReview || mutation.isPending) return
    mutation.mutate({
      itemType: activeReview.type,
      itemId: activeReview.id,
      rating,
      durationMs: Math.min(3_600_000, Math.max(0, Date.now() - cardStartedAt.current)),
    }, {
      onSuccess: () => { cardStartedAt.current = Date.now() },
    })
  }

  return (
    <section className="study-page session-page">
      <PageHeader title="Review" meta={dueCount ? `${dueCount} due` : 'Up to date'} />

      {activeReview?.type === 'sentence' ? (
        <SentenceReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={rate}
        />
      ) : activeReview ? (
        <ReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={rate}
        />
      ) : (
        <Empty
          title="All caught up"
          detail="New cards appear here on schedule. Lessons and reading are always open."
        />
      )}

      {mutation.isError ? <div className="mt-3"><ErrorNote>Could not save this review. Try again.</ErrorNote></div> : null}
    </section>
  )
}
