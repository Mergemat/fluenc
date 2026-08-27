import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { enrollItem, type DashboardData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type ReadingItem = DashboardData['getQueue'][number]

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const queryClient = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const mutation = useMutation({
    mutationFn: () => enrollItem({ data: { itemType: 'sentence', itemId: item.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <article>
      <div className="grid justify-items-center gap-8 px-2 py-10 text-center">
        <div
          className="grid place-items-center rounded-[2rem] px-8 py-3"
          style={{
            background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
            boxShadow: '0 16px 36px rgb(43 58 66 / 0.16), 0 2px 6px rgb(43 58 66 / 0.06), inset 0 1px 0 #fff',
          }}
        >
          <p className="m-0 font-hanzi text-4xl leading-snug font-semibold tracking-tight text-glaze" lang="zh-CN">
            {item.hanzi}
          </p>
        </div>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Listen" />

        {revealed ? (
          <div className="w-full max-w-[420px]">
            <p className="m-0 mb-1 text-base font-medium">{item.pinyin}</p>
            <p className="m-0 text-lg font-medium">{item.meaning}</p>
          </div>
        ) : (
          <p className="m-0 max-w-[320px] text-sm text-muted">Understand it first, then listen.</p>
        )}
      </div>

      <footer className="mt-4">
        {revealed ? (
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving…' : 'Next'}
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" type="button" onClick={() => setRevealed(true)}>
            Check meaning
          </Button>
        )}
      </footer>
      {mutation.isError ? <ErrorNote>Could not save this sentence. Try again.</ErrorNote> : null}
    </article>
  )
}
