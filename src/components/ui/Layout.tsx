import type { ReactNode } from 'react'

export function Page({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-xl px-5 pt-6 pb-36 md:pt-10 md:pb-16">
      {children}
    </section>
  )
}

export function PageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="mb-8 flex items-baseline justify-between gap-4">
      <h1 className="m-0 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">{title}</h1>
      {meta ? <div className="text-xs text-muted">{meta}</div> : null}
    </header>
  )
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid justify-items-center gap-2 py-24 text-center">
      <h2 className="m-0 text-base font-medium">{title}</h2>
      <p className="m-0 max-w-[320px] text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  )
}

export function Status({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center content-center gap-3 py-24 text-center text-muted">
      <p className="m-0 text-sm">{title}</p>
      {action}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="m-0 pt-3 text-xs text-danger" role="alert">{children}</p>
}
