import { ArrowRight, Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { enrollItem, type DashboardData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'

type GetItem = DashboardData['getQueue'][number]

export function GetDeck({ items, onComplete }: { items: GetItem[]; onComplete: (readCount: number) => void }) {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const sentence = items[index]

  const learnMutation = useMutation({
    mutationFn: () => {
      if (!sentence) throw new Error('Нет предложения')
      return enrollItem({ data: { itemType: 'sentence', itemId: sentence.id } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      advance()
    },
  })

  if (!sentence) return null

  const lastSentence = index === items.length - 1

  function advance() {
    if (lastSentence) {
      onComplete(index + 1)
      return
    }
    setIndex((current) => current + 1)
    setRevealed(false)
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-64px)] w-[min(820px,calc(100%-48px))] content-center py-10 max-[720px]:w-[calc(100%-28px)]">
      <header className="mb-5 flex items-center justify-between text-[10px] font-bold text-muted">
        <span>Понятное предложение</span>
        <span className="tabular-nums">{index + 1} / {items.length}</span>
      </header>

      <article className="border-y border-line py-10 text-center max-[720px]:py-8">
        <p className="mt-0 mb-7 text-xs text-muted">Прочитайте вслух. Затем послушайте.</p>
        <p className="my-0 font-hanzi text-[clamp(42px,8vw,72px)] font-semibold leading-[1.25] tracking-[-.045em]" lang="zh-CN">{sentence.hanzi}</p>
        <MandarinAudioButton className="mx-auto mt-7" text={sentence.hanzi} pinyin={sentence.pinyin} label="Послушать" />

        {revealed ? (
          <div className="mx-auto mt-8 max-w-[600px] border-t border-line pt-6">
            <p className="mt-0 mb-2 text-base font-semibold text-jade">{sentence.pinyin}</p>
            <p className="m-0 text-lg font-semibold">{sentence.meaningRu}</p>
          </div>
        ) : null}
      </article>

      <footer className="mt-6 flex justify-end">
        {revealed ? (
          <Button type="button" disabled={learnMutation.isPending} onClick={() => learnMutation.mutate()}>
            {lastSentence ? <Check size={16} /> : <ArrowRight size={16} />}
            {learnMutation.isPending ? 'Сохраняю…' : lastSentence ? 'Закончить занятие' : 'Следующее'}
          </Button>
        ) : <Button type="button" onClick={() => setRevealed(true)}>Проверить смысл</Button>}
      </footer>
      {learnMutation.isError ? <p className="mt-3 text-right text-xs text-fluenc-red" role="alert">Не удалось сохранить предложение.</p> : null}
    </main>
  )
}
