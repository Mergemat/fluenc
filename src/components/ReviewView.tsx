import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { saveReview } from '../offline/progress'
import type { DashboardData } from '../server/curriculum'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { Empty, ErrorNote, PageHeader } from './ui/Layout'

export function ReviewView({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient()
  const cardStartedAt = useRef(Date.now())
  const activeReview = data.reviewQueue[0]
  const dueCount = data.reviewQueue.length

  const mutation = useMutation({
    mutationFn: (rating: number) => {
      if (!activeReview) throw new Error('No card to review')
      return saveReview({
        itemType: activeReview.type,
        itemId: activeReview.id,
        rating,
        durationMs: Date.now() - cardStartedAt.current,
      })
    },
    onSuccess: async () => {
      cardStartedAt.current = Date.now()
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <section className="study-page session-page">
      <PageHeader title="Review" meta={dueCount ? `${dueCount} due` : 'Up to date'} />

      {activeReview?.type === 'sentence' ? (
        <SentenceReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
        />
      ) : activeReview ? (
        <ReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
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
