// Grades a drawn stroke against a character's stroke medians. A port of hanzi-writer's matcher
// (distance, start and end, direction, shape and length checks) so the writing pad can own its
// input and drawing. Points are in the 1024-unit makemeahanzi space the medians use.

export interface Point {
  x: number;
  y: number;
}

export interface StrokeGrade {
  isBackwards: boolean;
  /** Drawn in the right place and shape, possibly end to start. */
  isMatch: boolean;
}

// bigger = more lenient
const AVERAGE_DISTANCE_THRESHOLD = 175;
const START_AND_END_DISTANCE_THRESHOLD = 250;
const FRECHET_THRESHOLD = 0.4;
// smaller = more lenient
const MIN_LENGTH_RATIO = 0.35;
const SHAPE_FIT_ROTATIONS = [
  Math.PI / 16,
  Math.PI / 32,
  0,
  -Math.PI / 32,
  -Math.PI / 16,
];
const OUTLINE_POINTS = 30;
const SUBDIVIDE_LENGTH = 0.05;

const subtract = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const magnitude = (point: Point) => Math.hypot(point.x, point.y);
const distance = (a: Point, b: Point) => magnitude(subtract(a, b));
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function curveLength(points: Point[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index], points[index - 1]);
  }
  return total;
}

function edges(points: Point[]) {
  return points.slice(1).map((point, index) => subtract(point, points[index]));
}

/** The point `along` of the way from `from` to `to`. */
const lerp = (from: Point, to: Point, along: number): Point => ({
  x: from.x + (to.x - from.x) * along,
  y: from.y + (to.y - from.y) * along,
});

/** The curve redrawn as `count` points spaced evenly along it. */
function resample(curve: Point[], count: number) {
  const step = curveLength(curve) / (count - 1);
  const [first] = curve;
  const points = [first];
  let segment = 1;
  let start = first;
  for (let index = 1; index < count - 1; index += 1) {
    let remaining = step;
    while (segment < curve.length) {
      const span = distance(start, curve[segment]);
      if (span >= remaining && span > 0) {
        start = lerp(start, curve[segment], remaining / span);
        points.push(start);
        break;
      }
      remaining -= span;
      start = curve[segment];
      segment += 1;
    }
  }
  points.push(curve.at(-1) as Point);
  return points;
}

/** Long segments broken up so the Fréchet distance compares like with like. */
function subdivide(curve: Point[]) {
  const points = [curve[0]];
  for (const point of curve.slice(1)) {
    const previous = points.at(-1) as Point;
    const pieces = Math.ceil(distance(point, previous) / SUBDIVIDE_LENGTH);
    for (let piece = 1; piece <= pieces; piece += 1) {
      points.push(lerp(previous, point, piece / pieces));
    }
  }
  return points;
}

/** Centred on its mean and scaled by its ends, so only the shape is left to compare. */
function normalize(curve: Point[]) {
  const outline = resample(curve, OUTLINE_POINTS);
  const mean = {
    x: average(outline.map((point) => point.x)),
    y: average(outline.map((point) => point.y)),
  };
  const centred = outline.map((point) => subtract(point, mean));
  const scale = Math.sqrt(
    average([
      magnitude(centred[0]) ** 2,
      magnitude(centred.at(-1) as Point) ** 2,
    ])
  );
  return subdivide(
    centred.map((point) => ({ x: point.x / scale, y: point.y / scale }))
  );
}

const rotate = (curve: Point[], theta: number) =>
  curve.map((point) => ({
    x: Math.cos(theta) * point.x - Math.sin(theta) * point.y,
    y: Math.sin(theta) * point.x + Math.cos(theta) * point.y,
  }));

/** Discrete Fréchet distance, one column of the table at a time. */
function frechet(a: Point[], b: Point[]) {
  let previous: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    const current: number[] = [];
    for (let j = 0; j < b.length; j += 1) {
      const gap = distance(a[i], b[j]);
      if (i === 0 && j === 0) {
        current.push(gap);
      } else if (j === 0) {
        current.push(Math.max(previous[0], gap));
      } else if (i === 0) {
        current.push(Math.max(current[j - 1], gap));
      } else {
        current.push(
          Math.max(Math.min(previous[j], previous[j - 1], current[j - 1]), gap)
        );
      }
    }
    previous = current;
  }
  return previous.at(-1) as number;
}

function averageDistance(points: Point[], median: Point[]) {
  return average(
    points.map((point) =>
      Math.min(...median.map((target) => distance(point, target)))
    )
  );
}

function fits(points: Point[], median: Point[], leniency: number) {
  const ends =
    distance(points[0], median[0]) <=
      START_AND_END_DISTANCE_THRESHOLD * leniency &&
    distance(points.at(-1) as Point, median.at(-1) as Point) <=
      START_AND_END_DISTANCE_THRESHOLD * leniency;
  if (!ends) {
    return false;
  }
  const targets = edges(median);
  const direction = average(
    edges(points).map((edge) =>
      Math.max(
        ...targets.map(
          (target) =>
            (edge.x * target.x + edge.y * target.y) /
            (magnitude(edge) * magnitude(target))
        )
      )
    )
  );
  if (direction <= 0) {
    return false;
  }
  if (
    (leniency * (curveLength(points) + 25)) / (curveLength(median) + 25) <
    MIN_LENGTH_RATIO
  ) {
    return false;
  }
  const drawn = normalize(points);
  const expected = normalize(median);
  const shape = Math.min(
    ...SHAPE_FIT_ROTATIONS.map((theta) =>
      frechet(drawn, rotate(expected, theta))
    )
  );
  return shape <= FRECHET_THRESHOLD * leniency;
}

/** Whether `points` match `median`, and how close they came on average. */
function match(points: Point[], median: Point[], leniency: number) {
  const gap = averageDistance(points, median);
  if (gap > AVERAGE_DISTANCE_THRESHOLD * leniency) {
    return { gap, isMatch: false, isBackwards: false };
  }
  if (fits(points, median, leniency)) {
    return { gap, isMatch: true, isBackwards: false };
  }
  const isBackwards = fits([...points].reverse(), median, leniency);
  return { gap, isMatch: isBackwards, isBackwards };
}

function withoutRepeats(points: Point[]) {
  return points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y
  );
}

/**
 * Grade `drawn` as stroke `strokeNum` of a character with these `medians`. A stroke that fits a
 * later stroke better is held to a stricter standard, so strokes can't be drawn out of order.
 */
export function gradeStroke(
  drawn: Point[],
  medians: Point[][],
  strokeNum: number,
  leniency = 1
): StrokeGrade {
  const points = withoutRepeats(drawn);
  if (points.length < 2) {
    return { isMatch: false, isBackwards: false };
  }
  const result = match(points, medians[strokeNum], leniency);
  if (!result.isMatch) {
    return { isMatch: false, isBackwards: false };
  }
  let closest = result.gap;
  for (const later of medians.slice(strokeNum + 1)) {
    const other = match(points, later, leniency);
    if (other.isMatch && !other.isBackwards && other.gap < closest) {
      closest = other.gap;
    }
  }
  if (closest < result.gap) {
    const stricter = match(
      points,
      medians[strokeNum],
      (leniency * 0.6 * (closest + result.gap)) / (2 * result.gap)
    );
    return { isMatch: stricter.isMatch, isBackwards: stricter.isBackwards };
  }
  return { isMatch: true, isBackwards: result.isBackwards };
}
