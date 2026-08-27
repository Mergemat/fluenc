import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { enrollItem, type DashboardData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote, Page, PageHeader } from './ui/Layout'

type ReadingItem = DashboardData['getQueue'][number]

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const queryClient = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const mutation = useMutation({
    mutationFn: () => enrollItem({ data: { itemType: 'sentence', itemId: item.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <Page>
      <PageHeader title="Read" meta="Understand it, then say it" />

      <section className="grid justify-items-center gap-6 rounded-2xl border border-line bg-paper px-5 py-10 text-center">
        <p className="m-0 font-hanzi text-4xl leading-snug font-semibold tracking-tight sm:text-5xl" lang="zh-CN">
          {item.hanzi}
        </p>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Listen" />

        {revealed ? (
          <div className="w-full max-w-[420px] border-t border-line pt-5">
            <p className="m-0 mb-1.5 text-base font-bold text-accent">{item.pinyin}</p>
            <p className="m-0 text-lg font-semibold">{item.meaning}</p>
          </div>
        ) : (
          <p className="m-0 max-w-[380px] text-sm leading-relaxed text-muted">
            Understand the sentence first, without a translation. Then listen.
          </p>
        )}
      </section>

      <footer className="mt-5">
        {revealed ? (
          <Button className="w-full sm:w-auto" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            <ArrowRight size={16} /> {mutation.isPending ? 'Saving…' : 'Next sentence'}
          </Button>
        ) : (
          <Button className="w-full sm:w-auto" variant="secondary" type="button" onClick={() => setRevealed(true)}>
            Check meaning
          </Button>
        )}
      </footer>
      {mutation.isError ? <ErrorNote>Could not save this sentence. Try again.</ErrorNote> : null}
    </Page>
  )
}
