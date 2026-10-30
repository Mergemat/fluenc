// Hanzi building blocks: stroke glyph, movie-coded pinyin, audio, and usage examples.
// Each keeps a fixed footprint while it loads so nothing around it moves.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useMandarinSpeech } from "../../hooks/use-mandarin-speech";
import { glyphParts, SLOT_COLORS } from "../../lib/glyph-parts";
import { getToneDetail } from "../../lib/tones";
import { cn } from "../../lib/utils";
import { useLibrary } from "../../progress/views";
import { DitherGradient } from "../dither-kit/gradient";
import { PixelLoader } from "./dither";
import { partPixelColor } from "./part-colors";

// The parts font draws in a 1024-unit em with its baseline 900 units down. This places it in the
// SVG's 1024 box with a 55-unit margin.
const GLYPH_SCALE = (1024 - 2 * 55) / 1024;
const GLYPH_BASELINE = 55 + 900 * GLYPH_SCALE;
const GLYPH_TRANSFORM = `translate(55 ${GLYPH_BASELINE}) scale(${GLYPH_SCALE})`;
const PARTS_FONT = '"Fluenc Hanzi Parts"';
// Parts are drawn scaled far down from 1024, where Chrome snaps text to whole pixels and parts
// drift off their masks; geometricPrecision keeps the outlines where they are.
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

// The page draws the parts font with palettes of its own: plain, clear, one part left clear for its
// fill (the others fade with the text's opacity), and one part alone, for its fill's mask. Palette
// colours must be literal, so they're written from the theme's ink once a glyph first shows.
let palettesWritten = false;
function writePalettes() {
  if (palettesWritten) {
    return;
  }
  palettesWritten = true;
  const ink = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-foreground")
    .trim();
  const rule = (name: string, color: (slot: number) => string) =>
    `@font-palette-values --parts-${name} { font-family: ${PARTS_FONT}; override-colors: ${SLOT_COLORS.map((_, slot) => `${slot} ${color(slot)}`).join(", ")}; }`;
  const style = document.createElement("style");
  style.textContent = [
    rule("plain", () => ink),
    rule("clear", () => "transparent"),
    ...SLOT_COLORS.flatMap((_, lit) => [
      rule(`lit-${lit}`, (slot) => (slot === lit ? "transparent" : ink)),
      rule(`only-${lit}`, (slot) => (slot === lit ? "white" : "transparent")),
    ]),
  ].join("\n");
  document.head.append(style);
}

// Hit-testing is by ink: SVG text answers for its whole character box. On a canvas the parts font
// draws with its own palette, a colour per slot, so one small drawing tells the parts apart.
const MASK = 128;
const slotMaps = new Map<string, Int8Array>();

const nearestSlot = (pixels: Uint8ClampedArray, at: number) => {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (const [slot, [red, green, blue]] of SLOT_COLORS.entries()) {
    const away =
      ((pixels[at] ?? 0) - red) ** 2 +
      ((pixels[at + 1] ?? 0) - green) ** 2 +
      ((pixels[at + 2] ?? 0) - blue) ** 2;
    if (away < distance) {
      nearest = slot;
      distance = away;
    }
  }
  return nearest;
};

/** For each pixel of the character drawn `MASK` square, the slot of the part inked there, or -1. */
function slotMap(hanzi: string) {
  let map = slotMaps.get(hanzi);
  if (!map) {
    const context = new OffscreenCanvas(MASK, MASK).getContext("2d");
    if (!context) {
      return null;
    }
    const unit = MASK / 1024;
    context.font = `1024px ${PARTS_FONT}`;
    context.setTransform(
      unit * GLYPH_SCALE,
      0,
      0,
      unit * GLYPH_SCALE,
      55 * unit,
      GLYPH_BASELINE * unit
    );
    context.fillText(hanzi, 0, 0);
    const pixels = context.getImageData(0, 0, MASK, MASK).data;
    map = new Int8Array(MASK * MASK).fill(-1);
    for (let index = 0; index < map.length; index += 1) {
      if (pixels[index * 4 + 3]) {
        map[index] = nearestSlot(pixels, index * 4);
      }
    }
    slotMaps.set(hanzi, map);
  }
  return map;
}

// A pointer this close to a part's edge still points at it.
const REACH = 2;

/** The slot of the part under a pointer, by where its ink is: the nearest within `REACH`. */
function slotAtPoint(svg: SVGSVGElement, event: MouseEvent, hanzi: string) {
  const map = slotMap(hanzi);
  if (!map) {
    return -1;
  }
  const box = svg.getBoundingClientRect();
  const x = Math.floor(((event.clientX - box.left) / box.width) * MASK);
  const y = Math.floor(((event.clientY - box.top) / box.height) * MASK);
  let found = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (let dy = -REACH; dy <= REACH; dy += 1) {
    for (let dx = -REACH; dx <= REACH; dx += 1) {
      const px = x + dx;
      const py = y + dy;
      const slot =
        px >= 0 && py >= 0 && px < MASK && py < MASK
          ? (map[py * MASK + px] ?? -1)
          : -1;
      if (slot >= 0 && dx * dx + dy * dy < distance) {
        found = slot;
        distance = dx * dx + dy * dy;
      }
    }
  }
  return found;
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
 * loads, then the character in the parts font fades in on top of it — nothing moves. A palette
 * fades the other parts while one is lit, and a lit part is filled by a dither-kit gradient masked
 * to that part.
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
  // The parts font's slot order; drawn by parts only when every part of the character is in `parts`.
  const slots = useMemo(() => {
    const drawn = glyphParts(hanzi);
    return drawn?.every((part) => parts.includes(part)) ? drawn : null;
  }, [hanzi, parts]);
  const font = usePartsFont(slots ? hanzi : "");
  const ready = slots !== null && font.loaded;
  const lit = (code: string) => !concealed && (xray || highlighted === code);

  // Parts are picked and previewed by pointer; the lesson's clue inputs are the keyboard path.
  const pointedAt = (event: MouseEvent) =>
    svg.current && slots
      ? (slots[slotAtPoint(svg.current, event, hanzi)] ?? null)
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

  useLayoutEffect(() => {
    if (ready) {
      writePalettes();
    }
  }, [ready]);

  const state = glyphState(ready, slots === null || font.failed);
  const drawnWith = slots
    ? palette(slots, highlighted, xray, concealed)
    : "plain";
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
      {ready && slots ? (
        <svg
          aria-label={hanzi}
          className="size-full overflow-visible"
          ref={svg}
          role="img"
          viewBox="0 0 1024 1024"
        >
          <defs>
            {slots.map((code, slot) =>
              lit(code) ? (
                <mask
                  id={`${id}-m${slot}`}
                  key={code}
                  maskContentUnits="objectBoundingBox"
                >
                  <text
                    style={{ ...partText, fontPalette: `--parts-only-${slot}` }}
                    transform={`scale(${1 / 1024}) ${GLYPH_TRANSFORM}`}
                  >
                    {hanzi}
                  </text>
                </mask>
              ) : null
            )}
          </defs>
          <text
            className={cn(
              "transition-[font-palette,opacity] duration-180",
              drawnWith.startsWith("lit-") && "opacity-14"
            )}
            style={{ ...partText, fontPalette: `--parts-${drawnWith}` }}
            transform={GLYPH_TRANSFORM}
          >
            {hanzi}
          </text>
        </svg>
      ) : null}
      {ready && slots
        ? parts.map((code, index) =>
            lit(code) ? (
              // Without paint containment Chrome places a text mask up to a pixel off when the
              // box sits at a fractional position.
              <div
                className="pointer-events-none absolute inset-0 contain-paint"
                key={code}
                style={{ mask: `url(#${id}-m${slots.indexOf(code)})` }}
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

/** The palette the character is drawn with (see `writePalettes`). */
function palette(
  slots: string[],
  highlighted: string | null,
  xray: boolean,
  concealed: boolean
) {
  if (concealed) {
    return "plain";
  }
  if (xray) {
    return "clear";
  }
  const slot = highlighted ? slots.indexOf(highlighted) : -1;
  return slot >= 0 ? `lit-${slot}` : "plain";
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
        label && "type-control inline-flex h-7 w-auto gap-2 pr-3 pl-2.5",
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
