import type { ReactNode } from 'react'

export function StudioCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <article className={`overflow-hidden rounded-[16px] border border-line bg-paper shadow-[0_1px_2px_rgba(31,52,43,.03)] ${className}`.trim()}>
      {children}
    </article>
  )
}
