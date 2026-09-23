import type { ReactNode } from 'react'

export function RecallAnswer({ revealed, hint, children }: { revealed: boolean; hint: string; children: ReactNode }) {
  return <div className="recall-answer">
    <div className="recall-answer-content" inert={!revealed} aria-hidden={!revealed}>{children}</div>
    {!revealed ? <p className="recall-hint">{hint}</p> : null}
  </div>
}
