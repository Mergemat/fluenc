import { describe, expect, test } from "bun:test";

import strokes from "../../assets/strokes/三.json";
import { gradeStroke, type Point } from "./stroke-match";

const medians = strokes.medians.map((median) =>
  median.map(([x, y]) => ({ x, y }))
);

/** A hand-drawn version of `median`: densely sampled, nudged and a little wobbly. */
function trace(median: Point[], nudge: Point = { x: 0, y: 0 }) {
  const points: Point[] = [];
  for (let index = 1; index < median.length; index += 1) {
    const from = median[index - 1];
    const to = median[index];
    for (let step = 0; step < 10; step += 1) {
      const along = step / 10;
      points.push({
        x: from.x + (to.x - from.x) * along + nudge.x + Math.sin(step) * 6,
        y: from.y + (to.y - from.y) * along + nudge.y + Math.cos(step) * 6,
      });
    }
  }
  points.push(median.at(-1) as Point);
  return points;
}

describe("gradeStroke", () => {
  test("accepts a traced stroke, even a little off", () => {
    expect(gradeStroke(trace(medians[0]), medians, 0).isMatch).toBe(true);
    expect(
      gradeStroke(trace(medians[1], { x: 40, y: -30 }), medians, 1).isMatch
    ).toBe(true);
  });

  test("flags a stroke drawn end to start", () => {
    expect(gradeStroke(trace(medians[0]).reverse(), medians, 0)).toEqual({
      isMatch: true,
      isBackwards: true,
    });
  });

  test("rejects the wrong stroke, a stray line and a tap", () => {
    expect(gradeStroke(trace(medians[2]), medians, 0).isMatch).toBe(false);
    const stray = [
      { x: 100, y: 800 },
      { x: 300, y: 600 },
    ];
    expect(gradeStroke(stray, medians, 0).isMatch).toBe(false);
    expect(gradeStroke([{ x: 500, y: 400 }], medians, 0).isMatch).toBe(false);
  });
});
