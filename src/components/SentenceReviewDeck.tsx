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
    <article>
      <div className={`grid place-items-center px-2 text-center ${revealed ? '' : 'min-h-[300px] py-6'}`}>
        <p className={`m-0 max-w-[520px] font-medium leading-snug tracking-tight ${revealed ? 'text-lg' : 'text-2xl'}`}>
          {item.meaning}
        </p>
        {!revealed ? (
          <>
            <p className="mt-6 mb-0 text-sm text-muted">Say it in Chinese.</p>
            <Button className="mt-10" type="button" onClick={reveal}><Eye size={16} /> Show</Button>
          </>
        ) : null}
      </div>

      {revealed ? (
        <div className="pt-10">
          <div className="grid justify-items-center gap-2 text-center">
            <p className="m-0 font-hanzi text-3xl font-semibold leading-snug tracking-tight" lang="zh-CN">{item.hanzi}</p>
            <p className="m-0 text-sm font-medium">{item.pinyin}</p>
            <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          </div>
          <div className="mt-10 border-t border-line pt-2">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </article>
  )
}
