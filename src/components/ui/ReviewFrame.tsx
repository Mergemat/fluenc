import type { ReactNode } from 'react'

export function ReviewWorkspace({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-[min(780px,calc(100%-48px))] pt-7 pb-14 max-[720px]:w-auto max-[720px]:px-3.5 max-[720px]:pt-5 max-[720px]:pb-10">{children}</div>
}

export function ReviewHeading({ eyebrow, title, remaining }: { eyebrow: string; title: string; remaining: number }) {
  return (
    <header className="mb-3 flex items-center justify-between gap-6">
      <div className="flex items-baseline gap-2.5">
        <p className="m-0 text-[9px] font-bold tracking-[.1em] text-jade uppercase">{eyebrow}</p>
        <h1 className="m-0 text-xs font-semibold">{title}</h1>
      </div>
      <span className="text-[11px] text-muted"><b className="mr-[3px] text-base text-ink tabular-nums">{remaining}</b> осталось</span>
    </header>
  )
}

export function ReviewCard({ children }: { children: ReactNode }) {
  return <article className="overflow-hidden rounded-2xl border border-line bg-paper">{children}</article>
}

export function RevealButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="inline-flex min-h-11 items-center gap-2.5 rounded-[10px] border-0 bg-jade px-[17px] text-xs font-extrabold text-white hover:bg-[#115a4d] [&_kbd]:rounded-[5px] [&_kbd]:bg-black/15 [&_kbd]:px-1.5 [&_kbd]:py-[3px] [&_kbd]:font-mono [&_kbd]:text-[9px] [&_kbd]:font-semibold [&_kbd]:leading-none [&_kbd]:text-[#c7ddd5]" type="button" onClick={onClick}>
      {children}
    </button>
  )
}
