import type { ReactNode } from 'react'

import { Rule } from './Dither'

export function Page({ children }: { children: ReactNode }) {
  return <section className="study-page">{children}</section>
}

export function PageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="page-header">
      <h1 className="page-title">{title}</h1>
      <Rule />
      {meta ? <div className="page-meta">{meta}</div> : null}
    </header>
  )
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-mark font-hanzi" aria-hidden="true">休</span>
      <h2 className="m-0 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="m-0 max-w-[420px] text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  )
}

export function Status({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="status-panel"><p className="m-0 text-sm font-medium">{title}</p>{action}</div>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="m-0 border-l-2 border-danger pl-3 pt-0 text-xs font-medium text-danger" role="alert">{children}</p>
}
