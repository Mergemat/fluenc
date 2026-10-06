// Writing practice: a quick, one-time write of the character in a modal. Ink follows the pen
// directly; a stroke in the right place turns into the real stroke, painted in the colour of
// the prop it belongs to. The next stroke's start is marked, a miss brings up a hint, and the
// modal closes by itself once the character is written.
import { X } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { gradeStroke, type Point } from "../lib/stroke-match";
import { DitherGradient } from "./dither-kit/gradient";
import { PixelLoader } from "./ui/dither";
import { useStrokes } from "./ui/hanzi";
import { partColor, partPixelColor } from "./ui/part-colors";

export interface WritingPart {
  code: string;
  /** The learner's prop name, or the component's meaning when unnamed. */
  label: string;
}

// Generous grading: this is a quick write, not a test.
const LENIENCY = 1.3;
// After this many misses the stroke is drawn for you.
const MISSES_BEFORE_DRAWN = 3;
const DONE_HOLD_MS = 800;
const NON_ID_CHARACTERS = /[^a-zA-Z0-9]/g;
// Stroke ends reach past the median; painting along it this much further covers them.
const PAINT_OVERRUN = 120;

const toPoints = (median: [number, number][]) =>
  median.map(([x, y]) => ({ x, y }));

/** `from` pushed `by` units further along the direction from `toward` to it. */
function extend(from: Point, toward: Point, by: number): Point {
  const length = Math.hypot(from.x - toward.x, from.y - toward.y) || 1;
  return {
    x: from.x + ((from.x - toward.x) / length) * by,
    y: from.y + ((from.y - toward.y) / length) * by,
  };
}

/** The median as a path running past both ends, for the paint that reveals a stroke. */
function paintPath(median: Point[]) {
  const start = extend(median[0], median[1] ?? median[0], PAINT_OVERRUN);
  const end = extend(
    median.at(-1) as Point,
    median.at(-2) ?? (median.at(-1) as Point),
    PAINT_OVERRUN
  );
  return `M${[start, ...median, end].map((point) => `${point.x} ${point.y}`).join("L")}`;
}

/** Pen points as a smooth path: a curve through the midpoints of the raw samples. */
function inkPath(points: Point[]) {
  const [first] = points;
  if (points.length < 3) {
    return `M${first.x} ${first.y}${points.map((point) => `L${point.x} ${point.y}`).join("")}`;
  }
  let path = `M${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    path += `Q${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = points.at(-1) as Point;
  return `${path}L${last.x} ${last.y}`;
}

/** One pip per stroke, filled in its prop's colour once written; the next one is outlined. */
function StrokePips({
  owners,
  codes,
  written,
}: {
  owners: string[];
  codes: string[];
  written: number;
}) {
  // A stroke's position is its identity: the list never reorders.
  const pips = owners.map((owner, stroke) => ({
    id: `${stroke}:${owner}`,
    stroke,
    part: codes.indexOf(owner),
  }));
  return (
    <span aria-hidden="true" className="dx-writing-pips">
      {pips.map((pip) => (
        <i data-next={pip.stroke === written} key={pip.id}>
          {pip.stroke < written ? (
            <DitherGradient
              cell={1}
              from={pip.part >= 0 ? partPixelColor(pip.part) : "grey"}
            />
          ) : null}
        </i>
      ))}
    </span>
  );
}

/** Which prop the next stroke belongs to, in that prop's colour. */
function NextPart({
  done,
  part,
  index,
}: {
  done: boolean;
  part: WritingPart | undefined;
  index: number;
}) {
  if (done) {
    return (
      <p className="dx-writing-part" data-done="true">
        written
      </p>
    );
  }
  if (!part) {
    return <p className="dx-writing-part">write each stroke in order</p>;
  }
  return (
    <p
      className="dx-writing-part"
      style={{ "--part": partColor(index) } as CSSProperties}
    >
      <b className="dx-writing-code font-hanzi-props" lang="zh-CN">
        {part.code}
      </b>
      {part.label}
    </p>
  );
}

/** The 米字格 practice grid: a cross and both diagonals, under the strokes. */
function PracticeGrid() {
  return (
    <g className="dx-writing-grid">
      <path d="M512 0V1024M0 512H1024" vectorEffect="non-scaling-stroke" />
      <path
        className="dx-writing-grid-diagonal"
        d="M0 0L1024 1024M1024 0L0 1024"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export function WritingModal({
  hanzi,
  parts,
  onClose,
}: {
  hanzi: string;
  parts: WritingPart[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const glyph = useRef<SVGGElement>(null);
  const ink = useRef<SVGPathElement>(null);
  const id = `w${useId().replace(NON_ID_CHARACTERS, "")}`;
  const shape = useStrokes(hanzi);
  const { data } = shape;
  const [written, setWritten] = useState(0);
  const [misses, setMisses] = useState(0);
  const closed = useEffectEvent(() => onClose());
  const close = useCallback(() => dialog.current?.close(), []);

  const medians = useMemo(() => data?.medians.map(toPoints), [data]);
  const total = data?.strokes.length ?? 0;
  const done = total > 0 && written >= total;
  const codes = parts.map((part) => part.code);
  const colorOf = (stroke: number) => {
    const part = codes.indexOf(data?.owners[stroke] ?? "");
    return part >= 0 ? partColor(part) : "var(--dx-fg)";
  };

  // A modal dialog: Escape and a tap on the backdrop close it.
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === element) {
        element.close();
      }
    };
    element.addEventListener("close", closed);
    element.addEventListener("mousedown", closeOnBackdrop);
    if (!element.open) {
      element.showModal();
    }
    return () => {
      element.removeEventListener("close", closed);
      element.removeEventListener("mousedown", closeOnBackdrop);
    };
  }, []);

  useEffect(() => {
    if (!done) {
      return;
    }
    const timer = setTimeout(() => dialog.current?.close(), DONE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [done]);

  // A finished stroke: the next one if it fits, otherwise a miss — and enough misses draw it.
  const finish = useEffectEvent((points: Point[]) => {
    const path = ink.current;
    if (!(medians && path) || done) {
      return;
    }
    const { isMatch } = gradeStroke(points, medians, written, LENIENCY);
    if (isMatch || misses + 1 >= MISSES_BEFORE_DRAWN) {
      path.dataset.result = "hit";
      setWritten(written + 1);
      setMisses(0);
    } else {
      path.dataset.result = "miss";
      setMisses(misses + 1);
    }
  });

  // The pen: one pointer at a time, its ink drawn straight onto the pad without a React render.
  useEffect(() => {
    const element = svg.current;
    const group = glyph.current;
    const path = ink.current;
    if (!(element && group && path)) {
      return;
    }
    let pointer: number | null = null;
    let points: Point[] = [];
    let toGlyph: DOMMatrix | null = null;
    const at = (event: PointerEvent) => {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        toGlyph ?? undefined
      );
      return { x: point.x, y: point.y };
    };
    const down = (event: PointerEvent) => {
      if (pointer !== null || event.button !== 0) {
        return;
      }
      event.preventDefault();
      pointer = event.pointerId;
      element.setPointerCapture(pointer);
      toGlyph = group.getScreenCTM()?.inverse() ?? null;
      points = [at(event)];
      delete path.dataset.result;
      path.setAttribute("d", inkPath(points));
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) {
        return;
      }
      // A pen reports more samples than frames; the coalesced ones keep fast curves smooth.
      for (const sample of event.getCoalescedEvents?.() ?? [event]) {
        points.push(at(sample));
      }
      path.setAttribute("d", inkPath(points));
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) {
        return;
      }
      pointer = null;
      if (event.type === "pointercancel" || points.length < 2) {
        path.dataset.result = "miss";
        return;
      }
      finish(points);
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, []);

  const current = !done && medians ? medians[written] : undefined;
  const nextIndex = done ? -1 : codes.indexOf(data?.owners[written] ?? "");

  return (
    <dialog
      aria-label={`Write ${hanzi}`}
      className="dx-writing-modal"
      ref={dialog}
    >
      <section className="dx-writing">
        <header>
          <span>
            write <b className="dx-writing-hanzi font-hanzi">{hanzi}</b>
          </span>
          <span className="dx-writing-count">
            {total ? `${Math.min(written, total)}/${total}` : ""}
          </span>
          <button
            aria-label="Close"
            className="dx-icon-button"
            onClick={close}
            type="button"
          >
            <X size={16} />
          </button>
        </header>
        <div className="dx-writing-pad" data-done={done}>
          <svg aria-hidden="true" ref={svg} viewBox="0 0 1024 1024">
            <PracticeGrid />
            <g ref={glyph} transform={data?.transform}>
              {data?.strokes.map((stroke) => (
                <path className="dx-writing-outline" d={stroke} key={stroke} />
              ))}
              {current && misses > 0 ? (
                <path
                  className="dx-writing-hint"
                  d={data?.strokes[written]}
                  key={`hint-${written}`}
                  style={{ "--part": colorOf(written) } as CSSProperties}
                />
              ) : null}
              {data?.strokes.slice(0, written).map((stroke, index) => (
                <g key={stroke}>
                  <clipPath id={`${id}-${index}`}>
                    <path d={stroke} />
                  </clipPath>
                  <path
                    className="dx-writing-paint"
                    clipPath={`url(#${id}-${index})`}
                    d={medians ? paintPath(medians[index]) : undefined}
                    pathLength={1}
                    style={{ "--part": colorOf(index) } as CSSProperties}
                  />
                </g>
              ))}
              {current ? (
                <circle
                  className="dx-writing-start"
                  cx={current[0].x}
                  cy={current[0].y}
                  key={`start-${written}`}
                  r={30}
                  style={{ "--part": colorOf(written) } as CSSProperties}
                />
              ) : null}
              <path className="dx-writing-ink" ref={ink} />
            </g>
          </svg>
          {data || shape.isError ? null : (
            <span className="dx-writing-loader">
              <PixelLoader label="Loading strokes" size={5} />
            </span>
          )}
        </div>
        {data ? (
          <StrokePips codes={codes} owners={data.owners} written={written} />
        ) : null}
        {shape.isError ? (
          <p className="dx-writing-part">strokes unavailable offline</p>
        ) : (
          <NextPart
            done={done}
            index={nextIndex}
            part={nextIndex >= 0 ? parts[nextIndex] : undefined}
          />
        )}
      </section>
    </dialog>
  );
}
