import { Eye } from 'lucide-react'

import { useReveal } from '../hooks/useReveal'
import type { CodebookItem } from '../server/curriculum'
import { SrsRatingButtons } from './SrsRatingButtons'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'

export function CodebookDeck({ item, pending, onRate }: { item: CodebookItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const asksForCode = item.direction === 'decode'
  const prompt = asksForCode ? item.association : item.code
  const answer = asksForCode ? item.code : item.association
  const promptLabel = asksForCode ? item.associationLabel : item.codeLabel
  const answerLabel = asksForCode ? item.codeLabel : item.associationLabel

  return (
    <article className="study-card grid h-[calc(100dvh-177px)] min-h-0 overflow-hidden md:h-[calc(100dvh-92px)] md:grid-cols-[minmax(0,1fr)_340px]">
      <section className={`${revealed ? 'hidden' : 'grid'} relative min-h-0 place-items-center bg-ink p-8 pb-24 text-paper md:grid md:pb-8`}><div className="grid max-w-full justify-items-center text-center"><span className="mb-8 text-[10px] font-bold uppercase tracking-[.14em] text-paper/45">{promptLabel}</span><p className="m-0 max-w-full text-[clamp(3.5rem,10vw,7rem)] font-black leading-none tracking-tight text-paper [overflow-wrap:anywhere]">{prompt}</p>{item.type === 'tone' && !asksForCode ? <ToneAudioButton className="mt-8 text-paper" pinyin={prompt} /> : <span className="mt-8 h-1 w-12 bg-glaze" />}</div><Button className="absolute inset-x-5 bottom-5 w-auto md:hidden" variant="secondary" type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button></section>
      <aside className={`${revealed ? 'flex' : 'hidden'} min-h-0 flex-col bg-paper md:flex`}>
        {!revealed ? <div className="flex flex-1 flex-col justify-between p-6"><div><span className="study-label">Your task</span><h2 className="mb-3 mt-4 text-2xl font-black tracking-tight">{asksForCode ? `Name the ${item.codeLabel.toLowerCase()}.` : 'Name the association.'}</h2><p className="m-0 text-sm leading-relaxed text-muted">Answer before you reveal the mapping.</p></div><Button type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button></div> : <div className="flex flex-1 flex-col"><div className="flex-1 p-6"><span className="study-label">{answerLabel}</span><p className="my-5 text-4xl font-black tracking-tight [overflow-wrap:anywhere]">{answer}</p>{item.type === 'tone' && asksForCode ? <ToneAudioButton pinyin={answer} /> : null}</div><div className="border-t border-line p-5"><p className="mb-3 mt-0 text-xs font-bold text-muted">How was your recall?</p><SrsRatingButtons pending={pending} onRate={onRate} /></div></div>}
      </aside>
    </article>
  )
}
