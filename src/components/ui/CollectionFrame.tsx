import type { ReactNode } from 'react'

import { Eyebrow } from './Eyebrow'

export function CollectionFrame({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-[1040px] px-8 pt-10 pb-16 max-[720px]:px-3.5 max-[720px]:pt-7 max-[720px]:pb-12">{children}</section>
}

export function CollectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-8 border-b border-line pb-6 max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:gap-[18px]">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-.045em] text-balance">{title}</h1>
        <p className="mt-2 mb-0 max-w-[560px] text-xs leading-[1.55] text-muted text-pretty">{description}</p>
      </div>
      {action}
    </header>
  )
}

export function ViewStatus({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[260px] place-items-center content-center gap-3 rounded-2xl border border-dashed border-[#bcc8c1] bg-white/45 text-muted [&_p]:m-0">{children}</div>
}
