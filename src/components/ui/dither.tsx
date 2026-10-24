// App-side pieces on top of dither-kit (src/components/dither-kit): rules made of the kit's
// gradient, and a pixel loader. Part colours live in ./part-colors.
import { cn } from "../../lib/utils";
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
      className="inline-grid gap-px align-middle text-current"
      role="status"
      style={{ gridTemplateColumns: `repeat(3, ${size}px)` }}
    >
      {[0, 5, 2, 7, 4, 1, 6, 3, 8].map((step) => (
        <i
          className="animate-pixel bg-current opacity-15"
          key={step}
          style={{
            width: size,
            height: size,
            animationDelay: `${step * 90}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** A dither-kit rule: grey cells fading out to the right, used wherever a divider sits. */
export function Rule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block h-1 min-w-3 flex-1", className)}
    >
      <DitherGradient cell={2} direction="right" from="grey" />
    </span>
  );
}
