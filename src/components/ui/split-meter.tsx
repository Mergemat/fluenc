// A progress bar divided into learned and learning, over a grey track of what is still to come.
import { cn } from "../../lib/utils";
import { DitherGradient } from "../dither-kit/gradient";

/**
 * A thin dithered bar; its fills are `progressFill` spans with a width. A fill doesn't animate: a
 * width in motion resizes its dither, which repaints every frame.
 */
export const progressTrack =
  "relative h-1.5 max-w-72 flex-1 overflow-hidden rounded-xs";
export const progressFill = "absolute inset-y-0 left-0 overflow-hidden";

const percent = (part: number, total: number) =>
  total ? `${(part / total) * 100}%` : "0%";

export function SplitMeter({
  label,
  learned,
  learning = 0,
  total,
  text,
  className,
}: {
  label: string;
  /** What the bar says to assistive tech, such as "40 learned, 12 learning, 698 to go". */
  text: string;
  learned: number;
  learning?: number;
  total: number;
  className?: string;
}) {
  const started = learned + learning;
  return (
    <div
      aria-label={label}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={started}
      aria-valuetext={text}
      className={cn(progressTrack, "max-w-none", className)}
      role="progressbar"
    >
      <DitherGradient cell={2} direction="right" from="grey" opacity={0.5} />
      <span
        className={progressFill}
        style={{
          left: percent(learned, total),
          width: percent(learning, total),
        }}
      >
        <DitherGradient cell={2} direction="left" from="orange" />
      </span>
      <span className={progressFill} style={{ width: percent(learned, total) }}>
        <DitherGradient cell={2} direction="left" from="green" />
      </span>
    </div>
  );
}
