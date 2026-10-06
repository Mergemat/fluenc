// The fluenc mark: the four Mandarin tone contours — high level, rising, dipping, falling — drawn
// as pixel strokes on a 2×2 grid. docs/design/brand/icon-generator.html uses the same geometry.
export const brandTones = [
  { color: 'green', points: [[0, .1], [1, .1]] },
  { color: 'blue', points: [[0, .9], [1, .1]] },
  { color: 'purple', points: [[0, .15], [.5, .9], [1, .15]] },
  { color: 'orange', points: [[0, .1], [1, .9]] },
] as const

export type BrandCell = { x: number; y: number; color: (typeof brandTones)[number]['color'] }

/** Pixel cells for a mark `size` units wide, with `pixel`-sized cells and `pad` margin (0–.5). */
export function brandCells(size: number, pixel: number, pad: number): BrandCell[] {
  const inset = size * pad
  const quadrant = (size - inset * 2) / 2
  const cells = new Map<string, BrandCell>()
  brandTones.forEach((tone, index) => {
    const x0 = inset + (index % 2) * quadrant + quadrant * .16
    const y0 = inset + Math.floor(index / 2) * quadrant + quadrant * .22
    const width = quadrant * .62
    const height = quadrant * .52
    for (let segment = 0; segment < tone.points.length - 1; segment++) {
      const [ax, ay] = tone.points[segment]
      const [bx, by] = tone.points[segment + 1]
      for (let step = 0; step <= 60; step++) {
        const t = step / 60
        const x = Math.round((x0 + (ax + (bx - ax) * t) * width) / pixel) * pixel
        const y = Math.round((y0 + (ay + (by - ay) * t) * height) / pixel) * pixel
        cells.set(`${x},${y}`, { x, y, color: tone.color })
      }
    }
  })
  return [...cells.values()]
}
