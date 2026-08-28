import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink bg-ink px-6 text-sm font-bold text-paper transition hover:border-glaze hover:bg-glaze',
  secondary: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-5 text-sm font-bold text-ink transition hover:border-ink',
  ghost: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-muted transition hover:bg-paper hover:text-ink',
  icon: 'grid size-10 shrink-0 place-items-center rounded-lg border border-transparent text-muted transition hover:border-line hover:bg-paper hover:text-ink',
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</button>
}
