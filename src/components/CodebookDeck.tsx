import { Eye } from 'lucide-react'

import type { CodebookItem } from '../server/curriculum'
import { useReveal } from '../hooks/useReveal'
import { SrsRatingButtons } from './SrsRatingButtons'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'

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
    ? `Which ${item.codeLabel.toLowerCase()} pairs with it?`
    : `What does it stand for?`

  return (
    <article>
      <div className={`grid place-items-center px-2 text-center ${revealed ? '' : 'min-h-[340px] py-6'}`}>
        <p className="m-0 mb-4 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">{promptLabel}</p>
        <div
          className="grid place-items-center rounded-[2rem] px-8 py-4"
          style={{
            background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
            boxShadow: '0 16px 36px rgb(43 58 66 / 0.16), 0 2px 6px rgb(43 58 66 / 0.06), inset 0 1px 0 #fff',
          }}
        >
          <p className={`m-0 max-w-full font-semibold leading-none tracking-tight text-glaze [overflow-wrap:anywhere] ${revealed ? 'text-4xl' : 'text-6xl'}`}>
            {prompt}
          </p>
        </div>
        {promptIsTone && !revealed ? <ToneAudioButton className="mt-4" pinyin={prompt} /> : null}
        {!revealed ? (
          <>
            <p className="mt-6 mb-0 text-sm text-muted">{question}</p>
            <Button className="mt-10" type="button" onClick={reveal}><Eye size={16} /> Show</Button>
          </>
        ) : null}
      </div>

      {revealed ? (
        <div className="pt-10">
          <div
            aria-label={`${prompt} is paired with ${answer}`}
            className="grid place-items-center gap-6 text-center"
          >
            <p className="m-0 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">{answer}</p>
            {item.type === 'tone' && asksForCode ? <ToneAudioButton pinyin={answer} /> : null}
          </div>
          <div className="mt-12">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </article>
  )
}
