// App-side helpers on top of dither-kit (src/components/dither-kit): palette colours for clue
// parts, rules made of the kit's gradient, and a pixel loader.
import type { CSSProperties } from 'react'

import { DitherGradient } from '../dither-kit/gradient'
import { rgb } from '../dither-kit/palette'
import { fillOf, type PixelColor } from '../dither-kit/pixel'

/** Prop colours: dither-kit palette names, then hues for the parts beyond them. */
const partPalette: PixelColor[] = ['orange', 'pink', 'red', 52, 96, 172]

export const partPixelColor = (index: number) => partPalette[index % partPalette.length]
export const partColor = (index: number) => rgb(fillOf(partPixelColor(index)))

/** CSS colour for a dither-kit palette entry, so CSS and canvas fills agree. */
export const ditherColor = (color: PixelColor, alpha = 1) => rgb(fillOf(color), 1, alpha)

/** 3×3 pixels lighting up in Bayer order; fixed size, so it never shifts its surroundings. */
export function PixelLoader({ label = 'Loading', size = 3 }: { label?: string; size?: number }) {
  return <span className="dx-pixels" role="status" aria-label={label} style={{ '--px': `${size}px` } as CSSProperties}>
    {[0, 5, 2, 7, 4, 1, 6, 3, 8].map((step, index) => <i key={index} style={{ animationDelay: `${step * 90}ms` }} />)}
  </span>
}

/** A dither-kit rule: grey cells fading out to the right, used wherever a divider sits. */
export function Rule({ className = '' }: { className?: string }) {
  return <span className={`dx-rule ${className}`.trim()} aria-hidden="true"><DitherGradient from="grey" direction="right" cell={2} /></span>
}
