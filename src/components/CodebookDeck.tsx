import { ArrowLeftRight, KeyRound } from 'lucide-react'

import type { CodebookItem } from '../server/curriculum'
import { useReveal } from '../hooks/useReveal'
import { SrsRatingButtons } from './SrsRatingButtons'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'
import { Card } from './ui/Layout'

type Props = {
  item: CodebookItem
  pending: boolean
  onRate: (rating: number) => void
}

export function CodebookDeck({ item, pending, onRate }: Props) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const asksForCode = item.direction === 'decode'
  const prompt = asksForCode ? item.association : item.code
  const answer = asksForCode ? item.code : item.association
  const promptLabel = asksForCode ? item.associationLabel : item.codeLabel
  const answerLabel = asksForCode ? item.codeLabel : item.associationLabel
  const promptIsTone = item.type === 'tone' && !asksForCode
  const question = asksForCode
    ? `Which ${item.codeLabel.toLowerCase()} is paired with this ${item.associationLabel.toLowerCase()}?`
    : `Which ${item.associationLabel.toLowerCase()} does this ${item.codeLabel.toLowerCase()} stand for?`

  return (
    <Card>
      <div className={`grid place-items-center px-5 text-center ${revealed ? 'py-8' : 'min-h-[320px] py-10 sm:min-h-[380px]'}`}>
        <span className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-muted uppercase">
          <KeyRound size={13} /> {promptLabel}
        </span>
        <span className={`max-w-full font-bold leading-none tracking-tight [overflow-wrap:anywhere] ${revealed ? 'text-4xl sm:text-5xl' : 'text-6xl sm:text-7xl'}`}>
          {prompt}
        </span>
        {promptIsTone && !revealed ? <ToneAudioButton className="mt-4" pinyin={prompt} /> : null}
        {!revealed ? (
          <>
            <p className="mt-5 mb-0 max-w-[380px] text-sm leading-relaxed text-muted">{question}</p>
            <Button className="mt-6 w-full sm:w-auto" type="button" onClick={reveal}>
              Show connection <kbd className="font-mono text-[10px] opacity-60">space</kbd>
            </Button>
          </>
        ) : null}
      </div>

      {revealed ? (
        <div className="border-t border-line p-5">
          <div
            aria-label={`${prompt} is paired with ${answer}`}
            className="mx-auto grid max-w-[520px] items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"
          >
            <Fact label={promptLabel} value={prompt} audioPinyin={promptIsTone ? prompt : undefined} />
            <ArrowLeftRight aria-hidden className="mx-auto rotate-90 text-faint sm:rotate-0" size={18} />
            <Fact
              label={answerLabel}
              value={answer}
              audioPinyin={item.type === 'tone' && asksForCode ? answer : undefined}
            />
          </div>
          <div className="mt-5">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function Fact({ label, value, audioPinyin }: { label: string; value: string; audioPinyin?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 border border-line rounded-xl px-3 py-3 text-center">
      <small className="text-[9px] font-bold tracking-[.1em] text-faint uppercase">{label}</small>
      <strong className="text-2xl leading-tight [overflow-wrap:anywhere]">{value}</strong>
      {audioPinyin ? <ToneAudioButton className="mt-1" pinyin={audioPinyin} /> : null}
    </div>
  )
}
