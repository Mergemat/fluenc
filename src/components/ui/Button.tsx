import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { DitherButton } from '../dither-kit/button'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

const plain: Record<Extract<Variant, 'ghost' | 'icon'>, string> = {
  ghost: 'ui-button ui-ghost',
  icon: 'ui-button ui-icon',
}

/** Primary and secondary actions are dither-kit buttons; ghost and icon stay quiet. */
export function Button({ variant = 'primary', className = '', children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { variant?: Variant; children: ReactNode }) {
  if (variant === 'primary' || variant === 'secondary') return <DitherButton
    className={`ui-button dx-ui-button ${variant === 'primary' ? 'dx-ui-primary' : ''} ${className}`.trim()}
    color={variant === 'primary' ? 'blue' : 'grey'} variant={variant === 'primary' ? 'gradient' : 'dotted'}
    {...props}>{children}</DitherButton>
  return <button className={`${plain[variant]} ${className}`.trim()} {...props}>{children}</button>
}
