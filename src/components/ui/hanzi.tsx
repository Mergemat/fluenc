// Hanzi building blocks: stroke glyph, movie-coded pinyin, audio, and usage examples.
// Each keeps a fixed footprint while it loads so nothing around it moves.
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useMandarinSpeech } from "../../hooks/use-mandarin-speech";
import { glyphParts, partCodePoint } from "../../lib/glyph-parts";
import { getToneDetail } from "../../lib/tones";
import { cn } from "../../lib/utils";
import { useLibrary } from "../../progress/views";
import { DitherGradient } from "../dither-kit/gradient";
import { PixelLoader } from "./dither";
import { partColor, partPixelColor } from "./part-colors";

// The parts font draws in a 1024-unit em with its baseline 900 units down. This places it in the
// SVG's 1024 box with a 55-unit margin.
const GLYPH_SCALE = (1024 - 2 * 55) / 1024;
const GLYPH_BASELINE = 55 + 900 * GLYPH_SCALE;
const GLYPH_TRANSFORM = `translate(55 ${GLYPH_BASELINE}) scale(${GLYPH_SCALE})`;
const PARTS_FONT = '"Fluenc Hanzi Parts"';
// Parts are drawn scaled far down from 1024, where Chrome snaps text to whole pixels and parts
// drift off their outlines and clips; geometricPrecision keeps the outlines where they are.
const partText = {
  fontFamily: PARTS_FONT,
  fontSize: 1024,
  textRendering: "geometricPrecision",
} as const;

// Without the font loading API the character stays the plain font glyph.
const fontSet = () =>
  typeof document === "undefined"
    ? undefined
    : (document.fonts as FontFaceSet | undefined);

const subscribeToFonts = (onChange: () => void) => {
  const fonts = fontSet();
  fonts?.addEventListener("loadingdone", onChange);
  fonts?.addEventListener("loadingerror", onChange);
  return () => {
    fonts?.removeEventListener("loadingdone", onChange);
    fonts?.removeEventListener("loadingerror", onChange);
  };
};

/** Whether the parts font can draw `text` now, asking for it when it can't yet. */
function usePartsFont(text: string) {
  const font = `16px ${PARTS_FONT}`;
  const loaded = useSyncExternalStore(
    subscribeToFonts,
    () => text !== "" && (fontSet()?.check(font, text) ?? false),
    () => false
  );
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const fonts = fontSet();
    if (!text || loaded) {
      return;
    }
    if (!fonts) {
      setFailed(text);
      return;
    }
    fonts.load(font, text).then(
      (faces) => {
        if (!faces.length) {
          setFailed(text);
        }
      },
      () => setFailed(text)
    );
  }, [font, text, loaded]);
  return { loaded, failed: failed === text };
}

// Hit-testing is by ink: SVG text answers for its whole character box, so each part is drawn once
// into a small mask, and a point belongs to the topmost part with ink there.
const MASK = 128;
const masks = new Map<string, Uint8ClampedArray[]>();

function partMasks(glyphs: string[]) {
  const key = glyphs.join("");
  let drawn = masks.get(key);
  if (!drawn) {
    const context = new OffscreenCanvas(MASK, MASK).getContext("2d");
    if (!context) {
      return [];
    }
    const unit = MASK / 1024;
    context.font = `1024px ${PARTS_FONT}`;
    drawn = glyphs.map((glyph) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, MASK, MASK);
      context.setTransform(
        unit * GLYPH_SCALE,
        0,
        0,
        unit * GLYPH_SCALE,
        55 * unit,
        GLYPH_BASELINE * unit
      );
      context.fillText(glyph, 0, 0);
      return context.getImageData(0, 0, MASK, MASK).data;
    });
    masks.set(key, drawn);
  }
  return drawn;
}

// A pointer this close to a part's edge still points at it, as the strokes' outline used to.
const REACH = 2;

/** The part under a pointer, by where its ink is. */
function partAtPoint(
  svg: SVGSVGElement,
  event: MouseEvent,
  glyphs: string[],
  parts: string[]
) {
  const box = svg.getBoundingClientRect();
  const x = Math.floor(((event.clientX - box.left) / box.width) * MASK);
  const y = Math.floor(((event.clientY - box.top) / box.height) * MASK);
  const drawn = partMasks(glyphs);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const mask = drawn[index];
    for (let dy = -REACH; mask && dy <= REACH; dy += 1) {
      for (let dx = -REACH; dx <= REACH; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (
          px >= 0 &&
          py >= 0 &&
          px < MASK &&
          py < MASK &&
          mask[(py * MASK + px) * 4 + 3]
        ) {
          return parts[index] ?? null;
        }
      }
    }
  }
  return null;
}

const NON_ID_CHARACTERS = /[^a-zA-Z0-9]/g;

/**
 * The room a glyph sizes itself to: as large as the box, up to `--glyph-max` (set with a
 * `glyph-max-*` utility on the box or above it).
 */
export const glyphBox =
  "@container-size grid min-h-0 w-full flex-1 place-items-center";

/** A character's meaning, its other meanings, and its sound row, as lessons and cards show them. */
export const ident =
  "grid max-w-full shrink-0 justify-items-center gap-1 text-center";
export const meaningText = "m-0 type-display text-2xl tracking-tight";
export const altText =
  "m-0 h-5 max-w-full truncate type-body text-muted-foreground text-sm leading-5";
export const soundRow = "mt-2 flex items-center gap-2";

const ghostState = {
  loading: "animate-pulse text-faint-foreground",
  ready: "pointer-events-none opacity-0",
  font: "",
} as const;

function glyphState(ready: boolean, failed: boolean) {
  if (ready) {
    return "ready";
  }
  return failed ? "font" : "loading";
}

/**
 * The character in a square box. The font glyph holds the exact footprint while the parts font
 * loads, then the character drawn part by part fades in on top of it — nothing moves. A lit part is
 * filled by a dither-kit gradient clipped to that part.
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
  const id = `g${useId().replace(NON_ID_CHARACTERS, "")}`;
  const svg = useRef<SVGSVGElement>(null);
  // Drawn by parts only when every part of the character is one of `parts`.
  const glyphs = useMemo(() => {
    const drawn = glyphParts(hanzi);
    if (!drawn?.every((part) => parts.includes(part))) {
      return null;
    }
    const codePoints = parts.map((part) => partCodePoint(hanzi, part));
    return codePoints.every((codePoint) => codePoint !== null)
      ? codePoints.map((codePoint) => String.fromCodePoint(codePoint))
      : null;
  }, [hanzi, parts]);
  const font = usePartsFont(glyphs?.join("") ?? "");
  const ready = glyphs !== null && font.loaded;
  const lit = (code: string) => !concealed && (xray || highlighted === code);

  // Parts are picked and previewed by pointer; the lesson's clue inputs are the keyboard path.
  const pointedAt = (event: MouseEvent) =>
    svg.current && glyphs
      ? partAtPoint(svg.current, event, glyphs, parts)
      : null;
  const select = useEffectEvent((event: MouseEvent) => {
    const code = pointedAt(event);
    if (code) {
      onSelect?.(code);
    }
  });
  const hover = useEffectEvent((event: PointerEvent) => {
    const code = pointedAt(event);
    if (svg.current) {
      svg.current.style.cursor = code ? "pointer" : "";
    }
    if (event.pointerType !== "touch") {
      onHover?.(code);
    }
  });
  // A touch leaves the moment it lifts, before its click; that would undo the part it picks.
  const leave = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType !== "touch") {
      onHover?.(null);
    }
  });
  useEffect(() => {
    const element = svg.current;
    if (!(element && ready) || concealed) {
      return;
    }
    element.addEventListener("click", select);
    element.addEventListener("pointermove", hover);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("click", select);
      element.removeEventListener("pointermove", hover);
      element.removeEventListener("pointerleave", leave);
    };
  }, [ready, concealed]);

  const state = glyphState(ready, glyphs === null || font.failed);
  return (
    <div
      className="relative grid size-glyph-box *:col-start-1 *:row-start-1"
      data-state={state}
    >
      <span
        aria-hidden={ready}
        className={cn(
          "grid select-none place-items-center font-hanzi text-foreground text-glyph-ghost leading-none",
          ghostState[state]
        )}
        lang="zh-CN"
      >
        {hanzi}
      </span>
      {ready && glyphs ? (
        <svg
          aria-label={hanzi}
          className="size-full overflow-visible"
          ref={svg}
          role="img"
          viewBox="0 0 1024 1024"
        >
          <defs>
            {parts.map((code, index) => (
              <clipPath
                clipPathUnits="objectBoundingBox"
                id={`${id}-c${index}`}
                key={code}
              >
                <text
                  style={partText}
                  transform={`scale(${1 / 1024}) ${GLYPH_TRANSFORM}`}
                >
                  {glyphs[index]}
                </text>
              </clipPath>
            ))}
          </defs>
          <g transform={GLYPH_TRANSFORM}>
            {parts.map((code, index) => (
              <g
                className={cn(
                  "transition-opacity duration-180",
                  !concealed &&
                    Boolean(highlighted) &&
                    highlighted !== code &&
                    !xray &&
                    "opacity-14"
                )}
                data-part={code}
                key={code}
                style={{ "--part": partColor(index) } as CSSProperties}
              >
                <text
                  className={cn(
                    "paint-stroke-first transition-colors duration-180",
                    lit(code)
                      ? "fill-transparent stroke-5 stroke-part"
                      : "fill-foreground stroke-7 stroke-transparent"
                  )}
                  style={partText}
                >
                  {glyphs[index]}
                </text>
              </g>
            ))}
          </g>
        </svg>
      ) : null}
      {ready
        ? parts.map((code, index) =>
            lit(code) ? (
              // Without paint containment Chrome places a text clip up to a pixel off when the
              // box sits at a fractional position.
              <div
                className="pointer-events-none absolute inset-0 contain-paint"
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

/** Pinyin set large, as a lesson and a card's answer show it. */
export const pinyinText = "inline-flex items-center type-pinyin tracking-snug";

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
    return (
      <span className={cn(pinyinText, "text-foreground", className)}>
        {pinyin}
      </span>
    );
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
      className={cn(pinyinText, className)}
      role="img"
      title={`${actorKey}- actor · -${finalKey} set`}
    >
      {actor ? (
        <span aria-hidden="true" className="text-blue" data-k="actor">
          {actor}
        </span>
      ) : null}
      {set ? (
        <span aria-hidden="true" className="text-purple" data-k="set">
          {set}
        </span>
      ) : null}
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
      className={cn(
        "tone-stroke h-tone-h w-tone overflow-visible fill-current stroke-current",
        className
      )}
      viewBox="0 0 20 15"
    >
      {points ? (
        <polyline
          className="fill-none"
          points={points.map((point) => point.join(",")).join(" ")}
        />
      ) : (
        <circle className="stroke-none" cx="10" cy="11" r="2.2" />
      )}
    </svg>
  );
}

const audioBars = ["h-1.5", "h-3", "h-2", "h-1"];

export function AudioButton({
  text,
  pinyin,
  label,
  className,
}: {
  text: string;
  pinyin: string;
  label?: string;
  className?: string;
}) {
  const speech = useMandarinSpeech();
  const { speak } = speech;
  const play = useCallback(() => {
    speak(text, pinyin);
  }, [speak, text, pinyin]);
  const speaking = speech.status === "speaking";
  return (
    <button
      aria-label={`Play ${text}`}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-progress disabled:opacity-100",
        label && "type-control inline-flex w-auto gap-2 pr-3 pl-2.5",
        speaking &&
          "border-blue/50 text-blue hover:border-blue/50 hover:text-blue",
        speech.status === "error" && "text-red hover:text-red",
        className
      )}
      data-status={speech.status}
      disabled={speech.status === "loading"}
      onClick={play}
      type="button"
    >
      {speech.status === "loading" ? (
        <PixelLoader label="Loading audio" size={3} />
      ) : (
        <span aria-hidden="true" className="flex h-3 items-center gap-0.5">
          {audioBars.map((height, bar) => (
            <i
              className={cn(
                "w-0.5 rounded-xs bg-current",
                height,
                speaking && "animate-eq"
              )}
              key={height}
              style={bar % 2 ? { animationDelay: "-0.25s" } : undefined}
            />
          ))}
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
  const library = useLibrary();
  return useMemo(() => {
    const known = new Set(
      library.characters
        .filter((entry) => entry.status !== "new")
        .map((entry) => entry.hanzi)
    );
    for (const char of alsoKnown) {
      known.add(char);
    }
    const words: UsageWord[] = library.words
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
  }, [library, hanzi, alsoKnown]);
}

export function UsageHanzi({ chars }: { chars: UsageWord["chars"] }) {
  return (
    <span
      className="whitespace-nowrap font-hanzi text-xl leading-none"
      lang="zh-CN"
    >
      {chars.map((entry) => (
        <span
          className={cn(
            entry.target && "text-blue text-shadow-blue/60 text-shadow-glow-sm",
            !entry.known &&
              "text-faint-foreground underline decoration-dotted underline-offset-4"
          )}
          key={entry.position}
        >
          {entry.char}
        </span>
      ))}
    </span>
  );
}
