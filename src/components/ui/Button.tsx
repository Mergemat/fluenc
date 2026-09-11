import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'ui-button ui-primary',
  secondary: 'ui-button ui-secondary',
  ghost: 'ui-button ui-ghost',
  icon: 'ui-button ui-icon',
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</button>
}
