import type { ReactNode } from 'react'

export function Page({ children }: { children: ReactNode }) {
  return <section className="mx-auto w-full max-w-4xl px-5 pb-32 pt-6 sm:px-8 md:pb-16 md:pt-10">{children}</section>
}

export function PageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="mb-7 flex items-end justify-between gap-4 border-b border-line pb-5 md:mb-9">
      <h1 className="m-0 text-2xl font-black tracking-[-0.04em] md:text-3xl">{title}</h1>
      {meta ? <div className="mb-1 text-xs font-bold tabular-nums text-muted">{meta}</div> : null}
    </header>
  )
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="study-card grid justify-items-start gap-2 px-6 py-16 text-left sm:px-10">
      <span className="mb-4 block h-1 w-10 bg-glaze" />
      <h2 className="m-0 text-xl font-black tracking-tight">{title}</h2>
      <p className="m-0 max-w-[420px] text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  )
}

export function Status({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="study-card grid min-h-48 place-items-center content-center gap-3 px-5 text-center text-muted"><p className="m-0 text-sm font-medium">{title}</p>{action}</div>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="m-0 border-l-2 border-danger pl-3 pt-0 text-xs font-medium text-danger" role="alert">{children}</p>
}
