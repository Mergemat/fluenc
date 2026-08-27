import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-ink px-5 text-sm font-semibold text-white hover:bg-black',
  secondary:
    'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-4 text-xs font-semibold text-ink hover:border-ink',
  ghost:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted hover:bg-black/5 hover:text-ink',
  icon: 'grid size-9 place-items-center rounded-lg border border-transparent text-muted hover:bg-black/5 hover:text-ink',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</button>
}
