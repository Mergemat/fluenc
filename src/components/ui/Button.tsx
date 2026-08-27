import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-paper',
  secondary:
    'inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-line px-5 text-sm font-medium text-ink',
  ghost:
    'inline-flex h-10 items-center justify-center gap-1.5 px-2 text-sm font-medium text-muted',
  icon: 'grid size-10 shrink-0 place-items-center rounded-full text-muted',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</button>
}
