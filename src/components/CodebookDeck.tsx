import { ArrowLeftRight, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { CodebookItem } from '../server/curriculum'
import { SrsRatingButtons } from './SrsRatingButtons'
import { ToneAudioButton } from './ToneAudioButton'
import { RevealButton, ReviewCard, ReviewHeading, ReviewWorkspace } from './ui/ReviewFrame'

type Props = {
  item: CodebookItem
  pending: boolean
  remaining: number
  onRate: (rating: number) => void
}

export function CodebookDeck({ item, pending, remaining, onRate }: Props) {
  const [revealed, setRevealed] = useState(false)
  const asksForCode = item.direction === 'decode'
  const prompt = asksForCode ? item.association : item.code
  const answer = asksForCode ? item.code : item.association
  const promptLabel = asksForCode ? item.associationLabel : item.codeLabel
  const answerLabel = asksForCode ? item.codeLabel : item.associationLabel
  const directionLabel = asksForCode
    ? 'Recall произношения · образ → звук'
    : 'Build сцены · звук → образ'
  const associationQuestion = item.associationLabel === 'Комната' ? 'Какая' : 'Какой'
  const promptIsTone = item.type === 'tone' && !asksForCode

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
      <ReviewHeading eyebrow="Pronunciation Codebook" title="Закрепите координату" remaining={remaining} />

      <ReviewCard>
        <div className={`grid place-items-center content-center px-7 text-center max-[720px]:px-[18px] ${revealed ? 'min-h-[170px] pt-[17px] pb-[15px]' : 'min-h-[390px] pt-12 pb-[42px] max-[720px]:min-h-[360px]'}`}>
          <span className="mb-2.5 text-[9px] font-bold tracking-[.06em] text-fluenc-blue uppercase">{directionLabel}</span>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[.1em] text-muted uppercase ${revealed ? 'mb-2' : 'mb-[23px]'}`}><KeyRound size={15} /> {promptLabel}</span>
          <span className={`max-w-[min(620px,100%)] [overflow-wrap:anywhere] font-bold leading-none tracking-[-.045em] text-ink ${revealed ? 'text-[clamp(38px,6vw,58px)]' : 'text-[clamp(52px,9vw,88px)]'}`}>{prompt}</span>
          {promptIsTone && !revealed ? <ToneAudioButton className="mt-5" pinyin={prompt} /> : null}
          <p className={`mx-auto max-w-[510px] text-[13px] leading-[1.55] text-muted text-pretty ${revealed ? 'mt-2 mb-0' : promptIsTone ? 'mt-4 mb-[22px]' : 'mt-7 mb-[22px]'}`}>
            {asksForCode
              ? `Какой ${item.codeLabel.toLocaleLowerCase()} закреплён за этим образом?`
              : `${associationQuestion} ${item.associationLabel.toLocaleLowerCase()} закреплён${item.associationLabel === 'Комната' ? 'а' : ''} за этим кодом?`}
          </p>
          {!revealed ? (
            <RevealButton onClick={() => setRevealed(true)}>
              Показать связь <kbd>Space</kbd>
            </RevealButton>
          ) : null}
        </div>

        {revealed ? (
          <div className="border-t border-line px-7 pt-[25px] pb-7 max-[720px]:px-4">
            <div className="mx-auto grid max-w-[670px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[18px] max-[720px]:grid-cols-1 max-[720px]:gap-[9px]" aria-label={`${prompt} связано с ${answer}`}>
              <CodebookFact label={promptLabel} value={prompt} audioPinyin={item.type === 'tone' && !asksForCode ? prompt : undefined} />
              <ArrowLeftRight className="text-jade max-[720px]:rotate-90" size={22} />
              <CodebookFact label={answerLabel} value={answer} audioPinyin={item.type === 'tone' && asksForCode ? answer : undefined} />
            </div>
            <p className="mx-auto mt-3.5 mb-0 max-w-[560px] text-center text-[10px] leading-normal text-muted">Вспомните эту связь в обе стороны без иероглифа. После закрепления она станет координатой фильма.</p>
            <SrsRatingButtons kind="codebook" pending={pending} onRate={onRate} />
          </div>
        ) : null}
      </ReviewCard>
    </ReviewWorkspace>
  )
}

function CodebookFact({ label, value, audioPinyin }: { label: string; value: string; audioPinyin?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px] border-y border-line p-[17px] text-center">
      <small className="text-[9px] font-extrabold tracking-[.1em] text-muted uppercase">{label}</small>
      <strong className="text-[clamp(22px,4vw,34px)] leading-[1.1] [overflow-wrap:anywhere]">{value}</strong>
      {audioPinyin ? <ToneAudioButton className="mx-auto mt-1.5" pinyin={audioPinyin} /> : null}
    </div>
  )
}
