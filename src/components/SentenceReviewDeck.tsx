import { Eye } from 'lucide-react'

import { useReveal } from '../hooks/useReveal'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { SrsRatingButtons } from './SrsRatingButtons'
import { Button } from './ui/Button'

type SentenceItem = Extract<ReviewItem, { type: 'sentence' }>

export function SentenceReviewDeck({ item, pending, onRate }: { item: SentenceItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  return (
    <article className="study-card grid h-[calc(100dvh-177px)] min-h-0 overflow-hidden md:h-[calc(100dvh-92px)] md:grid-cols-[minmax(0,1fr)_340px]">
      <section className={`${revealed ? 'hidden' : 'grid'} relative min-h-0 place-items-center bg-ink p-8 pb-24 text-paper md:grid md:pb-8`}><div className="max-w-2xl text-center"><span className="mb-8 block text-[10px] font-bold uppercase tracking-[.14em] text-paper/45">Say it in Mandarin</span><p className="m-0 text-[clamp(2rem,5vw,3.75rem)] font-black leading-tight tracking-tight">{item.meaning}</p><span className="mx-auto mt-8 block h-1 w-12 bg-glaze" /></div><Button className="absolute inset-x-5 bottom-5 w-auto md:hidden" variant="secondary" type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button></section>
      <aside className={`${revealed ? 'flex' : 'hidden'} min-h-0 flex-col bg-paper md:flex`}>
        {!revealed ? <div className="flex flex-1 flex-col justify-between p-6"><div><span className="study-label">Your task</span><h2 className="mb-3 mt-4 text-2xl font-black tracking-tight">Build the sentence.</h2><p className="m-0 text-sm leading-relaxed text-muted">Say the full sentence before checking.</p></div><Button type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button></div> : <div className="flex flex-1 flex-col"><div className="flex-1 p-6"><span className="study-label">Answer</span><p className="mb-3 mt-5 font-hanzi text-4xl font-bold leading-tight text-glaze" lang="zh-CN">{item.hanzi}</p><p className="m-0 text-sm font-bold">{item.pinyin}</p><MandarinAudioButton className="mt-4" text={item.hanzi} pinyin={item.pinyin} label="Listen" /></div><div className="border-t border-line p-5"><p className="mb-3 mt-0 text-xs font-bold text-muted">How was your recall?</p><SrsRatingButtons pending={pending} onRate={onRate} /></div></div>}
      </aside>
    </article>
  )
}
