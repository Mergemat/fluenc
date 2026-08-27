import { MessageCircle } from 'lucide-react'

import { useReveal } from '../hooks/useReveal'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { SrsRatingButtons } from './SrsRatingButtons'
import { Button } from './ui/Button'
import { Card } from './ui/Layout'

type SentenceItem = Extract<ReviewItem, { type: 'sentence' }>

export function SentenceReviewDeck({ item, pending, onRate }: { item: SentenceItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })

  return (
    <Card>
      <div className={`grid place-items-center px-5 text-center ${revealed ? 'py-8' : 'min-h-[300px] py-10 sm:min-h-[340px]'}`}>
        <span className="mb-3 text-muted"><MessageCircle size={16} /></span>
        <p className={`m-0 max-w-[520px] font-semibold leading-snug tracking-tight ${revealed ? 'text-lg' : 'text-2xl sm:text-3xl'}`}>
          {item.meaning}
        </p>
        {!revealed ? (
          <>
            <p className="mt-5 mb-0 max-w-[380px] text-sm leading-relaxed text-muted">
              Say the whole phrase in Chinese. Don’t translate word by word.
            </p>
            <Button className="mt-6 w-full sm:w-auto" type="button" onClick={reveal}>
              Show answer <kbd className="font-mono text-[10px] opacity-60">space</kbd>
            </Button>
          </>
        ) : null}
      </div>

      {revealed ? (
        <div className="border-t border-line p-5">
          <div className="grid justify-items-center gap-2 text-center">
            <p className="m-0 font-hanzi text-3xl font-semibold leading-snug tracking-tight sm:text-4xl" lang="zh-CN">{item.hanzi}</p>
            <p className="m-0 text-sm font-bold text-accent">{item.pinyin}</p>
            <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          </div>
          <div className="mt-5">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}
