import { brandCells } from '../../lib/brand-mark'

const SIZE = 28
const cells = brandCells(SIZE, 2, .04)

/** The four tone contours as crisp pixel strokes, in the clue colours. */
export function BrandMark() {
  return <svg className="dx-mark" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true" shapeRendering="crispEdges">
    {cells.map(cell => <rect key={`${cell.x},${cell.y}`} x={cell.x} y={cell.y} width={2} height={2} fill={`var(--dx-${cell.color})`} />)}
  </svg>
}
