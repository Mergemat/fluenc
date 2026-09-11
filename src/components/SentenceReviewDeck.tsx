import { useReveal } from '../hooks/useReveal'
import type { ReviewItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { RecallFrame } from './ui/RecallFrame'

type SentenceItem = Extract<ReviewItem, { type: 'sentence' }>

export function SentenceReviewDeck({ item, pending, onRate }: { item: SentenceItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  return <RecallFrame revealed={revealed} reveal={reveal} pending={pending} onRate={onRate}>
    <div className="recall-target">
      <p className="study-label">Say it in Mandarin</p>
      <p className="sentence-prompt">{item.meaning}</p>
      {revealed ? <section className="sentence-answer">
        <p className="font-hanzi" lang="zh-CN">{item.hanzi}</p><strong>{item.pinyin}</strong>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Listen" />
      </section> : <p className="recall-hint">Say the whole sentence aloud, including the tones.</p>}
    </div>
  </RecallFrame>
}
