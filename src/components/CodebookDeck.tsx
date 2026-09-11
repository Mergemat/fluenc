import { useReveal } from '../hooks/useReveal'
import type { CodebookItem } from '../server/curriculum'
import { ToneAudioButton } from './ToneAudioButton'
import { RecallFrame } from './ui/RecallFrame'

export function CodebookDeck({ item, pending, onRate }: { item: CodebookItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const asksForCode = item.direction === 'decode'
  const prompt = asksForCode ? item.association : item.code
  const answer = asksForCode ? item.code : item.association
  const promptLabel = asksForCode ? item.associationLabel : item.codeLabel
  const answerLabel = asksForCode ? item.codeLabel : item.associationLabel
  return <RecallFrame revealed={revealed} reveal={reveal} pending={pending} onRate={onRate}>
    <div className="recall-target">
      <p className="study-label">{promptLabel}</p>
      <p className={`recall-code ${asksForCode ? 'recall-association' : ''}`}>{prompt}</p>
      {item.type === 'tone' && !asksForCode ? <ToneAudioButton pinyin={prompt} /> : null}
      {revealed ? <section className={`mapping-answer mapping-${item.type}`}>
        <span className="study-label">{answerLabel}</span><h2>{answer}</h2>
        {item.type === 'tone' && asksForCode ? <ToneAudioButton pinyin={answer} /> : null}
      </section> : <p className="recall-hint">Recall the {answerLabel.toLowerCase()}.</p>}
    </div>
  </RecallFrame>
}
