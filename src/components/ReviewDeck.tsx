import { Eye } from 'lucide-react'

import { useReveal } from '../hooks/useReveal'
import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { SrsRatingButtons } from './SrsRatingButtons'
import { Button } from './ui/Button'

type RecallItem = Exclude<ReviewItem, { type: 'sentence' }>

export function ReviewDeck({ item, pending, onRate }: { item: RecallItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const meaning = splitMeaning(item.meaning)
  const tone = item.type === 'character' ? getToneDetail(item.movie.tone) : null

  return (
    <article className="study-card grid h-[calc(100dvh-177px)] min-h-0 overflow-hidden md:h-[calc(100dvh-92px)] md:grid-cols-[minmax(0,1fr)_340px]">
      <section className={`${revealed ? 'hidden' : 'grid'} relative min-h-0 place-items-center bg-ink p-8 pb-24 text-paper md:grid md:pb-8`}>
        <div className="grid justify-items-center text-center">
          <span className="mb-8 text-[10px] font-bold uppercase tracking-[.14em] text-paper/45">Recall from memory</span>
          <p className="m-0 font-hanzi text-[clamp(7rem,18vw,12rem)] font-semibold leading-none text-paper" lang="zh-CN">{item.hanzi}</p>
          <span className="mt-8 h-1 w-12 bg-glaze" />
        </div>
        <Button className="absolute inset-x-5 bottom-5 w-auto md:hidden" variant="secondary" type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button>
      </section>

      <aside className={`${revealed ? 'flex' : 'hidden'} min-h-0 flex-col bg-paper md:flex`}>
        {!revealed ? (
          <div className="flex flex-1 flex-col justify-between p-6">
            <div><span className="study-label">Your task</span><h2 className="mb-3 mt-4 text-2xl font-black tracking-tight">Name it out loud.</h2><p className="m-0 text-sm leading-relaxed text-muted">Recall the meaning, pronunciation, and tone before checking.</p></div>
            <Button type="button" onClick={reveal}><Eye size={16} /> Reveal answer</Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="border-b border-line p-6">
              <span className="study-label">Answer</span>
              <h2 className="mb-2 mt-4 text-3xl font-black tracking-tight">{meaning.primary}</h2>
              <div className="flex items-center gap-2"><strong className="text-lg">{item.pinyin}</strong><NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} /><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
            </div>
            <div className="flex-1 p-6">
              {item.type === 'character' ? <details><summary className="text-xs font-bold text-muted">Open memory movie</summary><dl className="mt-5 grid gap-3"><MovieFact label={`Initial ${item.movie.actorKey}`} value={item.movie.actorName || 'not set'} /><MovieFact label={`Final ${item.movie.finalKey}`} value={item.movie.setName || 'not set'} /><MovieFact label={`Tone ${tone?.mark ?? item.movie.tone}`} value={item.movie.roomName} /><MovieFact label="Props" value={item.movie.components.map((part) => `${part.propName || part.hanzi}${part.count > 1 ? ` ×${part.count}` : ''}`).join(' + ')} /></dl></details> : item.livingLink ? <p className="m-0 text-sm leading-relaxed text-muted">{item.livingLink}</p> : <p className="m-0 text-sm text-faint">No memory link saved.</p>}
            </div>
            <div className="border-t border-line p-5"><p className="mb-3 mt-0 text-xs font-bold text-muted">How was your recall?</p><SrsRatingButtons pending={pending} onRate={onRate} /></div>
          </div>
        )}
      </aside>
    </article>
  )
}

function MovieFact({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[84px_1fr] gap-3 text-sm"><dt className="text-xs font-bold text-faint">{label}</dt><dd className="m-0 font-bold">{value || 'not set'}</dd></div>
}
