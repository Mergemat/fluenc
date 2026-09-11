import type { ReactNode } from 'react'

import { SrsRatingButtons } from '../SrsRatingButtons'
import { Button } from './Button'

export function RecallFrame({ children, revealed, pending, reveal, onRate, ratingHint }: {
  children: ReactNode
  revealed: boolean
  pending: boolean
  reveal: () => void
  onRate: (rating: number) => void
  ratingHint: string
}) {
  return <article className={`recall-frame ${revealed ? 'is-revealed' : ''}`}>
    <div className="recall-content">{children}</div>
    <footer className="recall-footer">
      <p>{revealed ? ratingHint : 'Recall it before checking.'}</p>
      {revealed ? <SrsRatingButtons pending={pending} onRate={onRate} /> : <Button type="button" onClick={reveal}>Reveal answer <span className="key-hint">Space</span></Button>}
    </footer>
  </article>
}
