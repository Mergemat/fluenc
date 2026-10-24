// Hanzi building blocks: stroke glyph, movie-coded pinyin, audio, and usage examples.
// Each keeps a fixed footprint while it loads so nothing around it moves.
import { useQuery } from "@tanstack/react-query";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
} from "react";

import { useMandarinSpeech } from "../../hooks/use-mandarin-speech";
import { getToneDetail } from "../../lib/tones";
import { libraryQueryOptions } from "../../offline/queries";
import { DitherGradient } from "../dither-kit/gradient";
import { PixelLoader } from "./dither";
import { partColor, partPixelColor } from "./part-colors";

// Stroke outlines use a 1024-unit box whose y axis points up from -124 to 900. This flips them
// into the SVG's 1024 box with a 55-unit margin.
const STROKE_SCALE = (1024 - 2 * 55) / 1024;
const STROKE_TRANSFORM = `translate(55, ${55 + 900 * STROKE_SCALE}) scale(${STROKE_SCALE}, ${-STROKE_SCALE})`;

export function useStrokes(hanzi: string) {
  return useQuery({
    queryKey: ["character-strokes", hanzi],
    queryFn: async () => {
      const response = await fetch(`/hanzi/${hanzi}.json`);
      if (!response.ok) {
        throw new Error("Character strokes unavailable");
      }
      const data = (await response.json()) as {
        strokes: string[];
        /** Each stroke's centre line, start to end, in the strokes' 1024-unit space. */
        medians: [number, number][][];
        owners: string[];
      };
      return { ...data, transform: STROKE_TRANSFORM };
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

const NON_ID_CHARACTERS = /[^a-zA-Z0-9]/g;

/** The part code under a pointer event, from the nearest part group. */
const partAt = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest<SVGGElement>("[data-part]")?.dataset.part ?? null)
    : null;

function glyphState(ready: boolean, failed: boolean) {
  if (ready) {
    return "ready";
  }
  return failed ? "font" : "loading";
}

/**
 * The character in a square box. The font glyph holds the exact footprint while strokes load,
 * then the stroke SVG fades in on top of it — nothing moves. A lit part is filled by a
 * dither-kit gradient clipped to that part's strokes.
 */
export function HanziGlyph({
  hanzi,
  parts,
  highlighted = null,
  xray = false,
  concealed = false,
  onSelect,
  onHover,
}: {
  hanzi: string;
  parts: string[];
  highlighted?: string | null;
  xray?: boolean;
  concealed?: boolean;
  onSelect?: (code: string) => void;
  onHover?: (code: string | null) => void;
}) {
  const shape = useStrokes(hanzi);
  const id = `g${useId().replace(NON_ID_CHARACTERS, "")}`;
  const { data } = shape;
  const svg = useRef<SVGSVGElement>(null);
  const ready = useMemo(() => {
    if (!data || data.owners.length !== data.strokes.length) {
      return false;
    }
    const known = new Set(parts);
    return data.owners.every((code) => known.has(code));
  }, [data, parts]);
  const lit = (code: string) => !concealed && (xray || highlighted === code);

  // Parts are picked and previewed by pointer; the lesson's clue inputs are the keyboard path.
  const select = useEffectEvent((event: MouseEvent) => {
    const code = partAt(event.target);
    if (code) {
      onSelect?.(code);
    }
  });
  const hover = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType !== "touch") {
      onHover?.(partAt(event.target));
    }
  });
  const leave = useEffectEvent(() => onHover?.(null));
  useEffect(() => {
    const element = svg.current;
    if (!(element && ready) || concealed) {
      return;
    }
    element.addEventListener("click", select);
    element.addEventListener("pointerover", hover);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("click", select);
      element.removeEventListener("pointerover", hover);
      element.removeEventListener("pointerleave", leave);
    };
  }, [ready, concealed]);
  const partPath = (code: string) =>
    data?.strokes.filter((_, index) => data.owners[index] === code).join(" ") ??
    "";

  return (
    <div
      className="dx-glyph"
      data-state={glyphState(ready, shape.isError || Boolean(data))}
    >
      <span
        aria-hidden={ready}
        className="dx-glyph-ghost font-hanzi"
        lang="zh-CN"
      >
        {hanzi}
      </span>
      {ready && data ? (
        <svg aria-label={hanzi} ref={svg} role="img" viewBox="0 0 1024 1024">
          <defs>
            {parts.map((code, index) => (
              <clipPath
                clipPathUnits="objectBoundingBox"
                id={`${id}-c${index}`}
                key={code}
              >
                <path
                  d={partPath(code)}
                  transform={`scale(${1 / 1024}) ${data.transform}`}
                />
              </clipPath>
            ))}
          </defs>
          <g transform={data.transform}>
            {parts.map((code, index) => (
              <g
                className="dx-part"
                data-dim={
                  !concealed &&
                  Boolean(highlighted) &&
                  highlighted !== code &&
                  !xray
                }
                data-lit={lit(code)}
                data-part={code}
                key={code}
                style={{ "--part": partColor(index) } as CSSProperties}
              >
                <path d={partPath(code)} />
              </g>
            ))}
          </g>
        </svg>
      ) : null}
      {ready
        ? parts.map((code, index) =>
            lit(code) ? (
              <div
                className="dx-part-fill"
                key={code}
                style={{ clipPath: `url(#${id}-c${index})` }}
              >
                <DitherGradient
                  bloom="low"
                  cell={2}
                  direction="up"
                  from={partPixelColor(index)}
                />
              </div>
            ) : null
          )
        : null}
    </div>
  );
}

const SYLLABLE_SEPARATOR = /[\s,/]+/;

/** How many leading letters belong to the actor; with the Ø set the actor takes them all. */
function actorLetters(total: number, actorKey: string, finalKey?: string) {
  if (finalKey === "ø") {
    return total;
  }
  return actorKey === "ø" ? 0 : Math.min(total, Array.from(actorKey).length);
}

/**
 * Pinyin coloured by Hanzi Movie Method codes: the actor part (e.g. ti- in tīng) and the set
 * part (-eng). With the Ø set the actor carries the whole syllable (yī → y-/Ø).
 */
export function MoviePinyin({
  pinyin,
  tone,
  actorKey,
  finalKey,
  className = "",
}: {
  pinyin: string;
  tone: number;
  actorKey?: string;
  finalKey?: string;
  className?: string;
}) {
  if (!(tone >= 1 && tone <= 5 && actorKey)) {
    return <span className={`dx-py dx-py-plain ${className}`}>{pinyin}</span>;
  }
  const syllable = pinyin.split(SYLLABLE_SEPARATOR)[0] ?? pinyin;
  const letters = Array.from(syllable);
  const actorLength = actorLetters(letters.length, actorKey, finalKey);
  const actor = letters.slice(0, actorLength).join("");
  const set = letters.slice(actorLength).join("");
  const detail = getToneDetail(tone);
  return (
    <span
      aria-label={`${pinyin}, ${detail?.label ?? ""} tone`}
      className={`dx-py ${className}`}
      role="img"
      title={`${actorKey}- actor · -${finalKey} set`}
    >
      {actor ? (
        <span aria-hidden="true" data-k="actor">
          {actor}
        </span>
      ) : null}
      {set ? (
        <span aria-hidden="true" data-k="set">
          {set}
        </span>
      ) : null}
      <ToneContour className="dx-py-tone" tone={tone} />
    </span>
  );
}

// Pitch shapes: high level, rising, dipping (a V, like the ˇ mark — a dip-and-rise reads as a ✓), falling.
const contours: Record<number, [number, number][]> = {
  1: [
    [2, 2],
    [18, 2],
  ],
  2: [
    [2, 10],
    [18, 2],
  ],
  3: [
    [3, 3],
    [10, 13],
    [17, 3],
  ],
  4: [
    [2, 2],
    [18, 13],
  ],
};

/** The tone drawn as its pitch shape instead of a number; neutral is a light dot. */
export function ToneContour({
  tone,
  className = "",
}: {
  tone: number;
  className?: string;
}) {
  const points = contours[tone];
  return (
    <svg
      aria-hidden="true"
      className={`dx-tone ${className}`.trim()}
      viewBox="0 0 20 15"
    >
      {points ? (
        <polyline points={points.map((point) => point.join(",")).join(" ")} />
      ) : (
        <circle cx="10" cy="11" r="2.2" />
      )}
    </svg>
  );
}

export function AudioButton({
  text,
  pinyin,
  label,
}: {
  text: string;
  pinyin: string;
  label?: string;
}) {
  const speech = useMandarinSpeech();
  const { speak } = speech;
  const play = useCallback(() => {
    speak(text, pinyin);
  }, [speak, text, pinyin]);
  return (
    <button
      aria-label={`Play ${text}`}
      className={`dx-audio ${label ? "dx-audio-labeled" : ""}`.trim()}
      data-status={speech.status}
      disabled={speech.status === "loading"}
      onClick={play}
      type="button"
    >
      {speech.status === "loading" ? (
        <PixelLoader label="Loading audio" size={3} />
      ) : (
        <span aria-hidden="true" className="dx-audio-bars">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export interface UsageWord {
  chars: { position: number; char: string; target: boolean; known: boolean }[];
  hanzi: string;
  id: string;
  meaning: string;
  pinyin: string;
  unknown: number;
}

/** Words that use the character, preferring ones built from characters you know. */
const noExtraKnown: ReadonlySet<string> = new Set();
export function useUsage(hanzi: string, alsoKnown = noExtraKnown) {
  const library = useQuery(libraryQueryOptions);
  const result = useMemo(() => {
    if (!library.data) {
      return null;
    }
    const known = new Set(
      library.data.characters
        .filter((entry) => entry.status !== "new")
        .map((entry) => entry.hanzi)
    );
    for (const char of alsoKnown) {
      known.add(char);
    }
    const words: UsageWord[] = library.data.words
      .filter((word) => word.hanzi !== hanzi && word.hanzi.includes(hanzi))
      .map((word) => {
        const chars = Array.from(word.hanzi).map((char, position) => ({
          position,
          char,
          target: char === hanzi,
          known: char === hanzi || known.has(char),
        }));
        return {
          id: word.id,
          hanzi: word.hanzi,
          pinyin: word.pinyin,
          meaning: word.meaning,
          chars,
          unknown: chars.filter((entry) => !entry.known).length,
          rank: word.rank,
        };
      })
      .sort((a, b) => a.unknown - b.unknown || a.rank - b.rank)
      .slice(0, 3);
    return { words };
  }, [library.data, hanzi, alsoKnown]);
  const { refetch } = library;
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);
  return {
    data: result,
    pending: library.isPending,
    error: library.isError,
    retry,
  };
}

export function UsageHanzi({ chars }: { chars: UsageWord["chars"] }) {
  return (
    <span className="dx-usage-hanzi font-hanzi" lang="zh-CN">
      {chars.map((entry) => (
        <span
          data-known={entry.known}
          data-target={entry.target}
          key={entry.position}
        >
          {entry.char}
        </span>
      ))}
    </span>
  );
}
