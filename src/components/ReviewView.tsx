import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { reviewItem, type DashboardData } from '../server/curriculum'
import { CodebookDeck } from './CodebookDeck'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { Empty, ErrorNote, Page, PageHeader } from './ui/Layout'

export function ReviewView({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient()
  const cardStartedAt = useRef(Date.now())
  const activeCodebook = data.codebookQueue[0]
  const activeReview = data.reviewQueue[0]
  const reviewTarget = activeCodebook ?? activeReview
  const dueCount = data.codebookQueue.length + data.reviewQueue.length

  const mutation = useMutation({
    mutationFn: (rating: number) => {
      if (!reviewTarget) throw new Error('No card to review')
      return reviewItem({
        data: {
          itemType: reviewTarget.type,
          itemId: reviewTarget.id,
          rating,
          durationMs: Date.now() - cardStartedAt.current,
        },
      })
    },
    onSuccess: async () => {
      cardStartedAt.current = Date.now()
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <Page>
      <PageHeader
        title="Review"
        meta={dueCount ? `${dueCount} due` : 'Queue is empty'}
      />

      {activeCodebook ? (
        <CodebookDeck
          key={`${activeCodebook.type}:${activeCodebook.id}`}
          item={activeCodebook}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
        />
      ) : activeReview?.type === 'sentence' ? (
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

      {mutation.isError ? <ErrorNote>Could not save this review. Try again.</ErrorNote> : null}
    </Page>
  )
}
