import { brandCells } from "../../lib/brand-mark";

const SIZE = 28;
const cells = brandCells(SIZE, 2, 0.04);

/** The four tone contours as crisp pixel strokes, in the clue colours. */
export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="dx-mark"
      height={SIZE}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
    >
      {cells.map((cell) => (
        <rect
          fill={`var(--dx-${cell.color})`}
          height={2}
          key={`${cell.x},${cell.y}`}
          width={2}
          x={cell.x}
          y={cell.y}
        />
      ))}
    </svg>
  );
}
