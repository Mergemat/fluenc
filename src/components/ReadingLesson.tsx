import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { enrollItem, type DashboardData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'

type ReadingItem = DashboardData['getQueue'][number]

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const queryClient = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const mutation = useMutation({
    mutationFn: () => enrollItem({ data: { itemType: 'sentence', itemId: item.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <section className="mx-auto grid min-h-[calc(100vh-80px)] w-[min(820px,calc(100%-48px))] content-center py-10 max-[720px]:min-h-[calc(100vh-126px)] max-[720px]:w-[calc(100%-28px)]">
      <p className="mb-5 text-[10px] font-bold text-muted">Понятное предложение · прочитайте вслух</p>

      <article className="border-y border-line py-10 text-center max-[720px]:py-8">
        <p className="mt-0 mb-7 text-xs text-muted">Сначала поймите фразу без перевода. Затем послушайте.</p>
        <p className="my-0 font-hanzi text-[clamp(42px,8vw,72px)] font-semibold leading-[1.25] tracking-[-.045em]" lang="zh-CN">{item.hanzi}</p>
        <MandarinAudioButton className="mx-auto mt-7" text={item.hanzi} pinyin={item.pinyin} label="Послушать" />

        {revealed ? (
          <div className="mx-auto mt-8 max-w-[600px] border-t border-line pt-6">
            <p className="mt-0 mb-2 text-base font-semibold text-jade">{item.pinyin}</p>
            <p className="m-0 text-lg font-semibold">{item.meaningRu}</p>
          </div>
        ) : null}
      </article>

      <footer className="mt-6 flex justify-end">
        {revealed ? (
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            <ArrowRight size={16} /> {mutation.isPending ? 'Сохраняю…' : 'Следующая фраза'}
          </Button>
        ) : <Button type="button" onClick={() => setRevealed(true)}>Проверить смысл</Button>}
      </footer>
      {mutation.isError ? <p className="mt-3 text-right text-xs text-fluenc-red" role="alert">Не удалось сохранить предложение.</p> : null}
    </section>
  )
}
