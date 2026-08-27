import type { ReactNode } from 'react'

type Width = 'narrow' | 'wide'

const widths: Record<Width, string> = {
  narrow: 'max-w-xl',
  wide: 'max-w-2xl',
}

export function Page({ children, width = 'narrow' }: { children: ReactNode; width?: Width }) {
  return (
    <section className={`mx-auto w-full ${widths[width]} px-4 pt-4 pb-32 md:pt-8 md:pb-16`}>
      {children}
    </section>
  )
}

export function PageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="mb-5 flex items-baseline justify-between gap-4">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
      {meta ? <div className="text-right text-xs text-muted">{meta}</div> : null}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`overflow-hidden rounded-2xl border border-line bg-paper ${className}`.trim()}>{children}</article>
}

export function Empty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="grid justify-items-center gap-2 py-20 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
      <h2 className="m-0 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="m-0 max-w-[360px] text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  )
}

export function Status({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center content-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center text-muted">
      <p className="m-0 text-sm">{title}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="m-0 px-4 py-2.5 text-xs text-danger" role="alert">{children}</p>
}
