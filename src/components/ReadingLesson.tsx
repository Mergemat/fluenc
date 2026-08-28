import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye } from 'lucide-react'
import { useState } from 'react'

import { saveEnrollment } from '../offline/progress'
import type { DashboardData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type ReadingItem = DashboardData['getQueue'][number]

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const queryClient = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const mutation = useMutation({
    mutationFn: () => saveEnrollment({ itemType: 'sentence', itemId: item.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  return (
    <article className="study-card overflow-hidden">
      <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-line bg-ink p-6 text-paper md:min-h-[560px] md:border-b-0 md:border-r">
          <span className="text-[10px] font-bold uppercase tracking-[.14em] text-paper/45">Reading desk</span>
          <div className="mt-8 hidden md:block"><span className="block h-1 w-10 bg-glaze" /><h2 className="mb-3 mt-5 text-2xl font-black tracking-tight">Read for meaning first.</h2><p className="m-0 text-sm leading-relaxed text-paper/60">Do not translate each character. Read the full line, then listen.</p></div>
          <div className="mt-auto hidden border-t border-paper/15 pt-5 md:block"><p className="m-0 text-xs font-bold text-paper/45">Known vocabulary</p><p className="mb-0 mt-2 text-2xl font-black">90%+</p></div>
        </aside>

        <section className="flex min-h-[460px] flex-col bg-paper">
          <div className="grid flex-1 place-items-center px-6 py-12 sm:px-10">
            <div className="w-full max-w-2xl">
              <p className="m-0 font-hanzi text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.3] tracking-tight text-ink" lang="zh-CN">{item.hanzi}</p>
              <MandarinAudioButton className="mt-7" text={item.hanzi} pinyin={item.pinyin} label="Play sentence" />
              {revealed ? <div className="mt-8 border-l-4 border-glaze pl-5"><p className="m-0 text-sm font-bold text-muted">{item.pinyin}</p><p className="mb-0 mt-2 text-xl font-black tracking-tight">{item.meaning}</p></div> : <p className="mb-0 mt-8 max-w-md text-sm leading-relaxed text-muted">Read the sentence once without help. Check the meaning only after you have an interpretation.</p>}
            </div>
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-line p-5">
            {revealed ? <Button className="w-auto" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Next sentence'} <ArrowRight size={16} /></Button> : <Button className="w-auto" variant="secondary" type="button" onClick={() => setRevealed(true)}><Eye size={16} /> Check meaning</Button>}
          </footer>
        </section>
      </div>
      {mutation.isError ? <div className="border-t border-line p-4"><ErrorNote>Could not save this sentence. Try again.</ErrorNote></div> : null}
    </article>
  )
}
