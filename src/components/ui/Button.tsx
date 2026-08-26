import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'inline-flex min-h-[38px] items-center justify-center gap-2 rounded-[9px] border-0 bg-jade px-4 text-xs font-extrabold text-white hover:not-disabled:bg-[#115a4d]',
  secondary: 'inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-[11px] py-2 text-[10px] font-bold text-ink hover:border-jade hover:text-jade',
  icon: 'grid size-9 place-items-center rounded-[10px] border border-line bg-white p-0 text-muted',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</button>
}
