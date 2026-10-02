import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { isLearning, REVIEW_TIME_ZONE } from '../lib/review-schedule'
import { useProgressMutation } from '../offline/useProgressMutation'
import { saveReview } from '../offline/progress'
import type { DashboardData, ReviewItem } from '../server/curriculum'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { Empty, ErrorNote, PageHeader } from './ui/Layout'

function reviewTime(date: string, includeTime = false) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: REVIEW_TIME_ZONE, day: 'numeric', month: 'long',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  })
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const startedAt = useRef(Date.now())
  const mutation = useProgressMutation(saveReview)
  const rate = (rating: number) => {
    if (mutation.isPending) return
    mutation.mutate({
      itemType: item.type,
      itemId: item.id,
      rating,
      durationMs: Math.min(3_600_000, Math.max(0, Date.now() - startedAt.current)),
    })
  }

  return <>
    {item.type === 'sentence'
      ? <SentenceReviewDeck item={item} pending={mutation.isPending} onRate={rate} />
      : <ReviewDeck item={item} pending={mutation.isPending} onRate={rate} />}
    {mutation.isError ? <div className="mt-3"><ErrorNote>Could not save this review. Try again.</ErrorNote></div> : null}
  </>
}

export function ReviewView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.reviewQueue[0])
  // A learning step becoming due must not replace the card being answered.
  const active = data.reviewQueue.find(item => item.type === selected?.type && item.id === selected.id && item.reps === selected.reps)
    ?? data.reviewQueue[0]
  if (active?.type !== selected?.type || active?.id !== selected?.id || active?.reps !== selected?.reps) setSelected(active)

  const learning = data.scheduledQueue.filter(item => isLearning(item.card.state))
  const nextLearningAt = learning.reduce<string | null>((next, item) => !next || item.card.due < next ? item.card.due : next, null)
  const hasCards = data.reviewQueue.length + data.scheduledQueue.length > 0

  return <section className="study-page session-page">
    <PageHeader title="Review" meta={active
      ? `${data.reviewQueue.length} ready${learning.length ? ` · ${learning.length} learning` : ''}`
      : learning.length ? `${learning.length} learning` : 'Up to date'} />

    {active ?
      <ReviewCard key={`${active.type}:${active.id}:${active.reps}`} item={active} />
    : nextLearningAt ? <div className="review-complete" role="status">
      <Empty title="A short break, then another recall"
        detail={`${learning.length} ${learning.length === 1 ? 'card still needs' : 'cards still need'} practice. Next recall: ${reviewTime(nextLearningAt, true)} Shanghai time. It will appear here when ready. Finish these reviews before new lessons.`} />
    </div> : <div className="review-complete">
      <Empty title={hasCards ? 'Reviews finished' : 'Start with a lesson'}
        detail={hasCards
          ? `You have finished the scheduled reviews. ${data.nextReviewAt ? `Next review day: ${reviewTime(data.nextReviewAt)} in Shanghai. ` : ''}Use your remaining study time for new characters and words, then reading.`
          : 'Learn a character or word before reviewing it. Reviews help you retain what you already understand.'} />
      <div className="review-next-actions">
        <Link to="/lessons" className="ui-button ui-primary">Learn characters and words</Link>
        {hasCards ? <Link to="/reading" className="ui-button ui-secondary">Read sentences</Link> : null}
      </div>
    </div>}
  </section>
}
