import { type DitherColor, PALETTE, type Rgb } from "./palette";

// 4×4 ordered (Bayer) matrix, normalized to 0–1 thresholds — the same matrix
// the charts dither with.
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** A named palette colour or a raw hue (0–360). */
export type PixelColor = DitherColor | number;

/** Hue (0–360) → an rgb fill tuned to sit alongside the chart palette. */
export function hueFill(hue: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.85;
  const l = 0.58;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  // The colour wheel in six 60° sectors, each a different order of the same three channels.
  const sectors: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = sectors[Math.min(5, Math.floor(h / 60))];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Resolve a {@link PixelColor} to its rgb fill. */
export function fillOf(color: PixelColor): Rgb {
  return typeof color === "number" ? hueFill(color) : PALETTE[color].fill;
}

// Bloom — same recipe as the charts: a blurred copy of the crisp canvas,
// composited additively so the glow stays in the dither's own colour.
export type PixelBloom = "off" | "low" | "high" | "aura";

const BLOOM_PRESET: Record<
  Exclude<PixelBloom, "off">,
  { blur: number; brightness: number; opacity: number; saturate: number }
> = {
  low: { blur: 3, brightness: 1.35, opacity: 0.7, saturate: 1.4 },
  high: { blur: 5, brightness: 1.5, opacity: 0.78, saturate: 1.5 },
  aura: { blur: 15, brightness: 2.9, opacity: 0.1, saturate: 3 },
};

export interface PixelBloomStyle {
  filter: string;
  imageRendering: "auto";
  mixBlendMode: "plus-lighter";
  opacity: number;
}

/** Style for the bloom layer canvas. null when off. */
export function pixelBloomStyle(bloom: PixelBloom): PixelBloomStyle | null {
  if (bloom === "off") {
    return null;
  }
  const cfg = BLOOM_PRESET[bloom];
  return {
    filter: `blur(${cfg.blur}px) brightness(${cfg.brightness}) saturate(${cfg.saturate})`,
    opacity: cfg.opacity,
    mixBlendMode: "plus-lighter",
    imageRendering: "auto",
  };
}

/** Whether the OS asks for reduced motion (skip entrances). */
export function pixelPrefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  );
}
