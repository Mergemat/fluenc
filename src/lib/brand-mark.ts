// The fluenc mark: the four Mandarin tone contours — high level, rising, dipping, falling — drawn
// as pixel strokes on a 2×2 grid. docs/design/brand/icon-generator.html uses the same geometry.
export const brandTones = [
  {
    color: "green",
    points: [
      [0, 0.1],
      [1, 0.1],
    ],
  },
  {
    color: "blue",
    points: [
      [0, 0.9],
      [1, 0.1],
    ],
  },
  {
    color: "purple",
    points: [
      [0, 0.15],
      [0.5, 0.9],
      [1, 0.15],
    ],
  },
  {
    color: "orange",
    points: [
      [0, 0.1],
      [1, 0.9],
    ],
  },
] as const;

export interface BrandCell {
  color: (typeof brandTones)[number]["color"];
  x: number;
  y: number;
}

/** Pixel cells for a mark `size` units wide, with `pixel`-sized cells and `pad` margin (0–.5). */
export function brandCells(
  size: number,
  pixel: number,
  pad: number
): BrandCell[] {
  const inset = size * pad;
  const quadrant = (size - inset * 2) / 2;
  const cells = new Map<string, BrandCell>();
  brandTones.forEach((tone, index) => {
    const x0 = inset + (index % 2) * quadrant + quadrant * 0.16;
    const y0 = inset + Math.floor(index / 2) * quadrant + quadrant * 0.22;
    const width = quadrant * 0.62;
    const height = quadrant * 0.52;
    for (let segment = 0; segment < tone.points.length - 1; segment += 1) {
      const [ax, ay] = tone.points[segment];
      const [bx, by] = tone.points[segment + 1];
      for (let step = 0; step <= 60; step += 1) {
        const t = step / 60;
        const x =
          Math.round((x0 + (ax + (bx - ax) * t) * width) / pixel) * pixel;
        const y =
          Math.round((y0 + (ay + (by - ay) * t) * height) / pixel) * pixel;
        cells.set(`${x},${y}`, { x, y, color: tone.color });
      }
    }
  });
  return [...cells.values()];
}
