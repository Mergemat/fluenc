import type { ReactNode } from 'react'

export type SessionStage = 'review' | 'build' | 'get'

const stages: Array<{ id: SessionStage; label: string }> = [
  { id: 'review', label: 'Review' },
  { id: 'build', label: 'Build' },
  { id: 'get', label: 'Get' },
]

export function SessionProgress({ stage }: { stage: SessionStage }) {
  const activeIndex = stages.findIndex((item) => item.id === stage)

  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0" aria-label="Этапы занятия">
      {stages.map((item, index) => (
        <li className={`flex items-center gap-2 text-[10px] font-bold ${index === activeIndex ? 'text-ink' : index < activeIndex ? 'text-jade' : 'text-[#9aa39f]'}`} key={item.id} aria-current={index === activeIndex ? 'step' : undefined}>
          {index ? <span className="h-px w-5 bg-line max-[520px]:w-2" aria-hidden="true" /> : null}
          <span>{item.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function SessionBar({ children, stage }: { children: ReactNode; stage: SessionStage }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b border-line bg-[#f8faf8]/95 px-6 backdrop-blur-sm max-[720px]:px-3.5">
      <SessionProgress stage={stage} />
      {children}
    </header>
  )
}
