import type { ReactNode } from 'react'

import { Eyebrow } from './Eyebrow'

export function ActivityHeader({ detail, eyebrow, title }: { detail: ReactNode; eyebrow: string; title: string }) {
  return (
    <header className="flex min-h-20 items-center justify-between gap-6 border-b border-line bg-[#f8faf8] px-7 py-4 max-[720px]:min-h-16 max-[720px]:px-3.5">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="m-0 text-xl tracking-[-.035em]">{title}</h1>
      </div>
      <div className="text-right text-[11px] leading-[1.4] text-muted">{detail}</div>
    </header>
  )
}

export function ActivityEmpty({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-80px)] w-[min(680px,calc(100%-48px))] place-content-center justify-items-center gap-3 py-12 text-center text-muted max-[720px]:min-h-[calc(100vh-126px)] max-[720px]:w-[calc(100%-28px)]">
      <span className="grid size-11 place-items-center rounded-full bg-jade-light text-jade">{icon}</span>
      {children}
    </div>
  )
}
