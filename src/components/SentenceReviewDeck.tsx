import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { SrsRatingButtons } from './SrsRatingButtons'
import { RevealButton, ReviewCard, ReviewHeading, ReviewWorkspace } from './ui/ReviewFrame'

type SentenceItem = Extract<ReviewItem, { type: 'sentence' }>

export function SentenceReviewDeck({ item, onRate, pending, remaining }: { item: SentenceItem; onRate: (rating: number) => void; pending: boolean; remaining: number }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }
      const rating = Number(event.key)
      if (revealed && !pending && rating >= 1 && rating <= 4) onRate(rating)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onRate, pending, revealed])

  return (
    <ReviewWorkspace>
      <ReviewHeading eyebrow="Review" title="Скажите по-китайски" remaining={remaining} />
      <ReviewCard>
        <div className={`grid place-items-center content-center px-7 text-center ${revealed ? 'min-h-[170px] py-5' : 'min-h-[390px] py-12'}`}>
          <span className="mb-5 text-muted"><MessageCircle size={18} /></span>
          <p className={`m-0 max-w-[600px] font-semibold leading-[1.25] tracking-[-.035em] ${revealed ? 'text-xl' : 'text-[clamp(30px,6vw,52px)]'}`}>{item.meaning}</p>
          {!revealed ? (
            <>
              <p className="mt-6 mb-5 text-xs text-muted">Произнесите всю фразу. Не переводите по словам.</p>
              <RevealButton onClick={() => setRevealed(true)}>Показать ответ <kbd>Space</kbd></RevealButton>
            </>
          ) : null}
        </div>

        {revealed ? (
          <div className="border-t border-line px-7 pt-7 pb-7 max-[720px]:px-4">
            <div className="text-center">
              <p className="my-0 font-hanzi text-[clamp(34px,7vw,58px)] font-semibold leading-[1.25]" lang="zh-CN">{item.hanzi}</p>
              <p className="mt-3 mb-5 text-sm font-semibold text-jade">{item.pinyin}</p>
              <MandarinAudioButton className="mx-auto" text={item.hanzi} pinyin={item.pinyin} label="Послушать" />
            </div>
            <SrsRatingButtons kind="sentence" pending={pending} onRate={onRate} />
          </div>
        ) : null}
      </ReviewCard>
    </ReviewWorkspace>
  )
}
