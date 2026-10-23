// A progress bar divided into learned and learning, over a grey track of what is still to come.
// Optional marks sit on the bar where milestones fall.
import { DitherGradient } from "../dither-kit/gradient";

const percent = (part: number, total: number) =>
  total ? `${(part / total) * 100}%` : "0%";

export function SplitMeter({
  label,
  learned,
  learning = 0,
  total,
  marks = [],
  text,
  className = "",
}: {
  label: string;
  /** What the bar says to assistive tech, such as "40 learned, 12 learning, 698 to go". */
  text: string;
  learned: number;
  learning?: number;
  total: number;
  /** Milestone positions; one is lit once the learner has passed it. */
  marks?: number[];
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
      className={`dx-progress dx-split ${className}`.trim()}
      role="progressbar"
    >
      <DitherGradient cell={2} direction="right" from="grey" opacity={0.5} />
      <span
        className="dx-progress-fill"
        style={{
          left: percent(learned, total),
          width: percent(learning, total),
        }}
      >
        <DitherGradient cell={2} direction="left" from="orange" />
      </span>
      <span
        className="dx-progress-fill"
        style={{ width: percent(learned, total) }}
      >
        <DitherGradient cell={2} direction="left" from="green" />
      </span>
      {marks
        .filter((mark) => mark > 0 && mark < total)
        .map((mark) => (
          <i
            className="dx-split-mark"
            data-passed={started >= mark}
            key={mark}
            style={{ left: percent(mark, total) }}
          />
        ))}
    </div>
  );
}
