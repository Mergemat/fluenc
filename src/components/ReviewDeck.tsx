import { Brain, Check, Clapperboard } from 'lucide-react'
import { useEffect, useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge, NeutralToneExample } from './NeutralToneHint'
import { SrsRatingButtons } from './SrsRatingButtons'
import { RevealButton, ReviewCard, ReviewHeading, ReviewWorkspace } from './ui/ReviewFrame'

type RecallItem = Exclude<ReviewItem, { type: 'sentence' }>

type Props = {
  item: RecallItem
  pending: boolean
  remaining: number
  onRate: (rating: number) => void
}

export function ReviewDeck({ item, pending, remaining, onRate }: Props) {
  const [revealed, setRevealed] = useState(false)
  const meaning = splitMeaning(item.meaning)
  const tone = item.type === 'character' ? getToneDetail(item.movie.tone) : null

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
      <ReviewHeading eyebrow="Сегодня · Review" title={item.srsState === 0 ? 'Первая проверка' : 'Вспомните без подсказок'} remaining={remaining} />

      <ReviewCard>
        <div className={`grid place-items-center content-center px-7 text-center max-[720px]:px-[18px] ${revealed ? 'min-h-[170px] pt-[17px] pb-[15px]' : 'min-h-[430px] pt-12 pb-[42px] max-[720px]:min-h-[360px]'}`}>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[.1em] text-muted uppercase ${revealed ? 'mb-2' : 'mb-[23px]'}`}><Brain size={15} /> {item.type === 'character' ? 'Иероглиф' : 'Слово'}</span>
          <span className={`font-hanzi font-semibold leading-[.92] tracking-[-.08em] text-ink ${revealed ? 'text-[clamp(68px,9vw,82px)]' : 'text-[clamp(112px,18vw,174px)]'}`} lang="zh-CN">{item.hanzi}</span>
          <p className={`mx-auto max-w-[510px] text-[13px] leading-[1.55] text-muted text-pretty ${revealed ? 'mt-2 mb-0' : 'mt-7 mb-[22px]'}`}>
            {item.type === 'character'
              ? 'Вспомните одно основное значение, pinyin и тон. Не дольше 10 секунд.'
              : 'Вспомните одно основное значение и произношение.'}
          </p>
          {!revealed ? (
            <RevealButton onClick={() => setRevealed(true)}>
              Показать ответ <kbd>Space</kbd>
            </RevealButton>
          ) : null}
        </div>

        {revealed ? (
          <div className="border-t border-line px-7 pt-[25px] pb-7 max-[720px]:px-4">
            <div className="flex items-center justify-center gap-[15px] max-[720px]:flex-wrap">
              <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Послушать" />
              <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-[7px]">
                <strong className="w-full text-center text-[clamp(30px,5vw,44px)] leading-[1.05] tracking-[-.04em] text-ink">{meaning.primary}</strong>
                <span className="text-[23px] font-bold text-jade">{item.pinyin}</span>
                {tone ? <span className="text-[11px] font-bold text-fluenc-red">{tone.syllable} · {tone.label.toLocaleLowerCase()}</span> : null}
                <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} className="text-[11px]" />
                <NeutralToneExample text={item.hanzi} pinyin={item.pinyin} className="w-full text-center" />
              </div>
            </div>

            {item.type === 'character' ? (
              <details className="mt-[22px] border-t border-line pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-bold text-jade"><Clapperboard size={16} /> Не вспомнили? Проверьте фильм</summary>
                <div className="mt-4 grid grid-cols-4 gap-4 max-[720px]:grid-cols-2">
                  <MovieFact label={`Initial · ${item.movie.actorKey}`} value={item.movie.actorName || 'не задано'} />
                  <MovieFact label={`Final · ${item.movie.finalKey}`} value={item.movie.setName || 'не задано'} />
                  <MovieFact label={`Тон · ${item.movie.tone}`} value={item.movie.roomName} />
                  <MovieFact label="Реквизит" value={item.movie.components.map((part) => part.propName || part.hanzi).join(' + ')} />
                </div>
              </details>
            ) : item.livingLink ? (
              <section className="mt-[22px] border-t border-line pt-4">
                <div className="flex items-center gap-2.5 text-jade [&>span]:flex [&>span]:flex-col [&>span]:gap-0.5 [&_b]:text-[11px] [&_b]:text-ink [&_small]:text-[10px] [&_small]:leading-[1.45] [&_small]:text-muted"><Check size={17} /><span><b>Living Link</b><small>{item.livingLink}</small></span></div>
              </section>
            ) : null}

            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        ) : null}
      </ReviewCard>
    </ReviewWorkspace>
  )
}

function MovieFact({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 flex-col gap-[3px]"><small className="text-[8px] font-bold tracking-[.08em] text-muted uppercase">{label}</small><strong className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap">{value || 'не задано'}</strong></div>
}
