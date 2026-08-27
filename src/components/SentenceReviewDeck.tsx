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
            <div
              className="mb-1 grid place-items-center rounded-[2rem] px-8 py-3"
              style={{
                background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
                boxShadow: '0 16px 36px rgb(43 58 66 / 0.16), 0 2px 6px rgb(43 58 66 / 0.06), inset 0 1px 0 #fff',
              }}
            >
              <p className="m-0 font-hanzi text-3xl font-semibold leading-snug tracking-tight text-glaze" lang="zh-CN">{item.hanzi}</p>
            </div>
            <p className="m-0 text-sm font-medium">{item.pinyin}</p>
            <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          </div>
          <div className="mt-10">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </article>
  )
}
