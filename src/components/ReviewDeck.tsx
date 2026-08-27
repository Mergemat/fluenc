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
    <article>
      <div className={`grid place-items-center px-2 text-center ${revealed ? '' : 'min-h-[340px] py-6'}`}>
        <p className={`m-0 font-hanzi font-semibold leading-none tracking-tight ${revealed ? 'text-6xl' : 'text-8xl'}`} lang="zh-CN">
          {item.hanzi}
        </p>
        {!revealed ? (
          <>
            <p className="mt-6 mb-0 text-sm text-muted">Recall the meaning, pinyin, tone.</p>
            <Button className="mt-10" type="button" onClick={reveal}><Eye size={16} /> Show</Button>
          </>
        ) : null}
      </div>

      {revealed ? (
        <div className="pt-10">
          <div className="grid justify-items-center gap-2 text-center">
            <p className="m-0 text-2xl font-semibold tracking-tight">{meaning.primary}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-medium">{item.pinyin}</span>
              <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
            </div>
            <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          </div>

          {item.type === 'character' ? (
            <details className="mx-auto mt-8 max-w-sm">
              <summary className="grid list-none justify-items-center text-xs text-muted">Movie</summary>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-center">
                <MovieFact label={`Initial · ${item.movie.actorKey}`} value={item.movie.actorName || 'not set'} />
                <MovieFact label={`Final · ${item.movie.finalKey}`} value={item.movie.setName || 'not set'} />
                <MovieFact label={`Tone · ${item.movie.tone}`} value={item.movie.roomName} />
                <MovieFact label="Props" value={item.movie.components.map((part) => part.propName || part.hanzi).join(' + ')} />
              </dl>
            </details>
          ) : item.livingLink ? (
            <p className="mx-auto mt-8 max-w-sm text-center text-xs leading-relaxed text-muted">{item.livingLink}</p>
          ) : null}

          <div className="mt-10 border-t border-line pt-2">
            <SrsRatingButtons pending={pending} onRate={onRate} />
          </div>
        </div>
      ) : null}
    </article>
  )
}

function MovieFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="m-0 overflow-hidden text-[10px] uppercase tracking-wide text-faint text-ellipsis whitespace-nowrap">{label}</dt>
      <dd className="m-0 overflow-hidden text-xs text-ellipsis whitespace-nowrap">{value || 'not set'}</dd>
    </div>
  )
}
