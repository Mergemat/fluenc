import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useRef } from 'react'

import { reviewItem, type DashboardData } from '../server/curriculum'
import { CodebookDeck } from './CodebookDeck'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { ActivityEmpty, ActivityHeader } from './ui/ActivityHeader'

export function ReviewView({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient()
  const cardStartedAt = useRef(Date.now())
  const activeCodebook = data.codebookQueue[0]
  const activeReview = data.reviewQueue[0]
  const reviewTarget = activeCodebook ?? activeReview
  const dueCount = data.codebookQueue.length + data.reviewQueue.length

  const mutation = useMutation({
    mutationFn: (rating: number) => {
      if (!reviewTarget) throw new Error('Нет карточки для повторения')
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
    <main className="min-h-screen">
      <ActivityHeader
        eyebrow="Review"
        title="Повторение"
        detail={dueCount ? <><b className="text-base text-ink tabular-nums">{dueCount}</b><br />пора вспомнить</> : 'Очередь пуста'}
      />

      {activeCodebook ? (
        <CodebookDeck
          key={`${activeCodebook.type}:${activeCodebook.id}`}
          item={activeCodebook}
          remaining={dueCount}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
        />
      ) : activeReview?.type === 'sentence' ? (
        <SentenceReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          remaining={dueCount}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
        />
      ) : activeReview ? (
        <ReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          remaining={dueCount}
          pending={mutation.isPending}
          onRate={(rating) => mutation.mutate(rating)}
        />
      ) : (
        <ActivityEmpty icon={<Check size={20} />}>
          <h2 className="m-0 text-2xl tracking-[-.035em] text-ink">Всё повторено</h2>
          <p className="m-0 max-w-[420px] text-sm leading-[1.6]">Новые карточки появятся здесь по расписанию. Уроки и чтение доступны отдельно.</p>
        </ActivityEmpty>
      )}

      {mutation.isError ? <p className="mx-auto mb-7 w-[min(780px,calc(100%-28px))] text-center text-xs text-fluenc-red" role="alert">Не удалось сохранить повторение.</p> : null}
    </main>
  )
}
