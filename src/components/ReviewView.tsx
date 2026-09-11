import { useRef, useState } from 'react'

import { REVIEW_TIME_LABEL, REVIEW_TIME_ZONE } from '../lib/review-schedule'
import { CATCH_UP_BATCH_SIZE, partitionReviews, reviewKey } from '../lib/review-session'
import { useProgressMutation } from '../offline/useProgressMutation'
import { saveReview } from '../offline/progress'
import type { DashboardData } from '../server/curriculum'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { Empty, ErrorNote, PageHeader } from './ui/Layout'
import { Button } from './ui/Button'

export function ReviewView({ data }: { data: DashboardData }) {
  const cardStartedAt = useRef(Date.now())
  const [mode, setMode] = useState<'recent' | 'catchup'>('recent')
  const [catchUpIds, setCatchUpIds] = useState<Set<string>>(() => new Set())
  const { recent, backlog } = partitionReviews(data.reviewQueue, new Date(), catchUpIds)
  const batch = backlog.filter(item => catchUpIds.has(reviewKey(item)))
  const queue = mode === 'recent' ? recent : batch
  const activeReview = queue[0]
  const nextBatchSize = Math.min(CATCH_UP_BATCH_SIZE, backlog.length)
  const startCatchUp = () => {
    setCatchUpIds(new Set(backlog.slice(0, CATCH_UP_BATCH_SIZE).map(reviewKey)))
    setMode('catchup')
    cardStartedAt.current = Date.now()
  }

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
      <PageHeader title="Review" meta={activeReview ? `${queue.length} left${mode === 'catchup' ? ' in this batch' : ''}` : data.reviewQueue.length ? 'Catch up at your pace' : 'Up to date'} />

      {backlog.length || catchUpIds.size ? <div className="review-queues" role="group" aria-label="Review queues">
        <Button variant={mode === 'recent' ? 'primary' : 'secondary'} aria-pressed={mode === 'recent'} onClick={() => {
          setMode('recent')
          cardStartedAt.current = Date.now()
        }}>Recent · {recent.length}</Button>
        <Button variant={mode === 'catchup' ? 'primary' : 'secondary'} aria-pressed={mode === 'catchup'} onClick={() => {
          if (!catchUpIds.size) startCatchUp()
          else {
            setMode('catchup')
            cardStartedAt.current = Date.now()
          }
        }}>Catch up · {backlog.length}</Button>
      </div> : null}

      {activeReview?.type === 'sentence' ? (
        <SentenceReviewDeck
          key={`${activeReview.type}:${activeReview.id}:${activeReview.reps}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={rate}
        />
      ) : activeReview ? (
        <ReviewDeck
          key={`${activeReview.type}:${activeReview.id}:${activeReview.reps}`}
          item={activeReview}
          pending={mutation.isPending}
          onRate={rate}
        />
      ) : backlog.length ? (
        <div className="review-complete">
          <Empty
            title={mode === 'catchup' ? 'Batch complete' : 'Recent reviews complete'}
            detail={`${backlog.length} older cards remain. Work through ${nextBatchSize} at a time, and take a break whenever you need. Cards due in the past week stay in Recent.`}
          />
          <Button onClick={startCatchUp}>{mode === 'catchup' ? 'Review next' : 'Catch up on'} {nextBatchSize} cards</Button>
          {mode === 'catchup' && recent.length ? <Button variant="ghost" onClick={() => setMode('recent')}>Return to {recent.length} recent reviews</Button> : null}
        </div>
      ) : mode === 'catchup' && recent.length ? (
        <div className="review-complete">
          <Empty title="Backlog cleared" detail={`${recent.length} recent reviews are waiting.`} />
          <Button onClick={() => setMode('recent')}>Return to recent reviews</Button>
        </div>
      ) : (
        <Empty
          title="All caught up"
          detail={data.nextReviewAt
            ? `Next review: ${new Date(data.nextReviewAt).toLocaleString('en-GB', { timeZone: REVIEW_TIME_ZONE, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} Moscow time. Lessons and reading are always open.`
            : `Reviews return at ${REVIEW_TIME_LABEL}. Start a lesson to add cards.`}
        />
      )}

      {mutation.isError ? <div className="mt-3"><ErrorNote>Could not save this review. Try again.</ErrorNote></div> : null}
    </section>
  )
}
