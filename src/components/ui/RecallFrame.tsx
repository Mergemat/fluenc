import type { ReactNode } from 'react'

import { SrsRatingButtons } from '../SrsRatingButtons'
import { Button } from './Button'

export function RecallFrame({ children, revealed, pending, reveal, onRate }: {
  children: ReactNode
  revealed: boolean
  pending: boolean
  reveal: () => void
  onRate: (rating: number) => void
}) {
  return <article className={`recall-frame ${revealed ? 'is-revealed' : ''}`}>
    <div className="recall-content">{children}</div>
    <footer className="recall-footer">
      {!revealed ? <p>Recall it before checking.</p> : null}
      {revealed ? <SrsRatingButtons pending={pending} onRate={onRate} /> : <Button type="button" onClick={reveal}>Reveal answer <span className="key-hint">Space</span></Button>}
    </footer>
  </article>
}
