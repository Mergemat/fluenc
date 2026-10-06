// App-side pieces on top of dither-kit (src/components/dither-kit): rules made of the kit's
// gradient, and a pixel loader. Part colours live in ./part-colors.
import type { CSSProperties } from "react";

import { DitherGradient } from "../dither-kit/gradient";

/** 3×3 pixels lighting up in Bayer order; fixed size, so it never shifts its surroundings. */
export function PixelLoader({
  label = "Loading",
  size = 3,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <span
      aria-label={label}
      className="dx-pixels"
      role="status"
      style={{ "--px": `${size}px` } as CSSProperties}
    >
      {[0, 5, 2, 7, 4, 1, 6, 3, 8].map((step) => (
        <i key={step} style={{ animationDelay: `${step * 90}ms` }} />
      ))}
    </span>
  );
}

/** A dither-kit rule: grey cells fading out to the right, used wherever a divider sits. */
export function Rule({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`dx-rule ${className}`.trim()}>
      <DitherGradient cell={2} direction="right" from="grey" />
    </span>
  );
}
