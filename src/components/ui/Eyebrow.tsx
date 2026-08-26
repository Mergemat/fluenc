import type { ReactNode } from 'react'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p data-eyebrow className={`mb-[7px] text-[10px] font-extrabold tracking-[.13em] text-[#78847f] uppercase ${className}`.trim()}>{children}</p>
}
