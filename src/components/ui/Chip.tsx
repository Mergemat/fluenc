import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { DitherGradient } from '../dither-kit/gradient'

/** A toggle chip; the pressed state is a quiet dither-kit fill, like the active nav chip. */
export function Chip({ pressed, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; children: ReactNode }) {
  return <button type="button" className={`dx-chip-toggle ${className}`.trim()} aria-pressed={pressed} {...props}>
    {pressed ? <DitherGradient from="blue" direction="up" cell={2} opacity={.45} /> : null}
    <span>{children}</span>
  </button>
}
