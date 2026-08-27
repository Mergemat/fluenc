import { Brain, Check, Clapperboard } from 'lucide-react'

import { useReveal } from '../hooks/useReveal'
import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { SrsRatingButtons } from './SrsRatingButtons'
import { Button } from './ui/Button'
import { Card } from './ui/Layout'

type RecallItem = Exclude<ReviewItem, { type: 'sentence' }>

type Props = {
  item: RecallItem
  pending: boolean
  onRate: (rating: number) => void
}

export function ReviewDeck({ item, pending, onRate }: Props) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const meaning = splitMeaning(item.meaning)
  const tone = item.type === 'character' ? getToneDetail(item.movie.tone) : null

  return (
    <Card>
      <div className={`grid place-items-center px-5 text-center ${revealed ? 'py-8' : 'min-h-[340px] py-10 sm:min-h-[400px]'}`}>
        <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-muted uppercase">
          <Brain size={13} /> {item.type === 'character' ? 'Character' : 'Word'}
        </span>
        <span
          className={`font-hanzi font-semibold leading-none tracking-tight ${revealed ? 'text-6xl sm:text-7xl' : 'text-[88px] sm:text-[120px]'}`}
          lang="zh-CN"
        >
          {item.hanzi}
        </span>
        {!revealed ? (
          <>
            <p className="mt-5 mb-0 max-w-[380px] text-sm leading-relaxed text-muted">
              Recall one core meaning, pinyin, and tone. Ten seconds at most.
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
            <strong className="text-3xl leading-tight tracking-tight sm:text-4xl">{meaning.primary}</strong>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-lg font-bold text-accent">{item.pinyin}</span>
              {tone ? <span className="text-xs font-semibold text-muted">{tone.syllable} · {tone.label.toLowerCase()}</span> : null}
              <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
              <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
            </div>
          </div>

          {item.type === 'character' ? (
            <details className="mt-5 border-t border-line pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-accent">
                <Clapperboard size={15} /> Forgot? Check the movie
              </summary>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <MovieFact label={`Initial · ${item.movie.actorKey}`} value={item.movie.actorName || 'not set'} />
                <MovieFact label={`Final · ${item.movie.finalKey}`} value={item.movie.setName || 'not set'} />
                <MovieFact label={`Tone · ${item.movie.tone}`} value={item.movie.roomName} />
                <MovieFact label="Props" value={item.movie.components.map((part) => part.propName || part.hanzi).join(' + ')} />
              </dl>
            </details>
          ) : item.livingLink ? (
            <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-accent">
              <Check size={15} className="mt-0.5" />
              <p className="m-0 text-xs leading-relaxed text-muted">
                <b className="block text-ink">Living link</b>
                {item.livingLink}
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function MovieFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="m-0 overflow-hidden text-[9px] font-bold tracking-[.08em] text-faint uppercase text-ellipsis whitespace-nowrap">{label}</dt>
      <dd className="m-0 overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{value || 'not set'}</dd>
    </div>
  )
}
