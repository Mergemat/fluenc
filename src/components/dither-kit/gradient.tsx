"use client";

import { useEffect, useRef } from "react";
import { cn } from "./lib";
import type { Rgb } from "./palette";
import {
  BAYER4,
  cachedTexture,
  fillOf,
  type PixelBloom,
  type PixelColor,
  pixelBloomStyle,
  setCell,
} from "./pixel";

// Backing-resolution caps — a background wash never needs more cells than this.
const MAX_COLS = 960;
const MAX_ROWS = 600;

export type GradientDirection = "up" | "down" | "left" | "right";

export interface DitherGradientProps {
  /** Glow on the dither fill. */
  bloom?: PixelBloom;
  /** CSS px per dither cell — bigger is chunkier. */
  cell?: number;
  className?: string;
  /** Flat density (0–1) in place of the ramp: every cell is lit against the same
   * level, like the button's flat textures. Higher lights more cells, brighter. */
  density?: number;
  /** Where `to` ends up — "up" reads as a glow rising from the bottom edge. */
  direction?: GradientDirection;
  /** The colour the gradient starts solid as — a palette name or a hue. */
  from: PixelColor;
  /** Overall opacity multiplier. */
  opacity?: number;
  /** What it dissolves into: another colour for a two-tone dither blend, or
   * "transparent" (default) so the background shows through. */
  to?: PixelColor | "transparent";
}

interface PaintSpec {
  cell: number;
  density: number | undefined;
  direction: GradientDirection;
  from: PixelColor;
  opacity: number;
  to: PixelColor | "transparent";
}

// Where a cell sits along the ramp: 0 at the `from` edge → 1 at the `to` edge.
const RAMP: Record<
  GradientDirection,
  (x: number, y: number, cols: number, rows: number) => number
> = {
  up: (_x, y, _cols, rows) => 1 - (y + 0.5) / rows,
  down: (_x, y, _cols, rows) => (y + 0.5) / rows,
  left: (x, _y, cols) => 1 - (x + 0.5) / cols,
  right: (x, _y, cols) => (x + 0.5) / cols,
};

/** One cell's colour and alpha, or null when it stays clear. */
function cellPaint(
  lit: boolean,
  density: number,
  fromFill: Rgb,
  toFill: Rgb | null,
  opacity: number
) {
  if (toFill) {
    // Two-tone: every cell is painted, the dither decides which colour.
    return { fill: lit ? fromFill : toFill, alpha: opacity };
  }
  // Dissolve to transparent: lit cells carry the ramp, off cells keep a
  // faint tint that also fades out, so the falloff reads smooth.
  const alpha = (lit ? 0.35 + 0.65 * density : 0.12 * density) * opacity;
  return alpha > 0.004 ? { fill: fromFill, alpha } : null;
}

/** The ordered-dither ramp, one pixel per cell. */
function gradientTexture(cols: number, rows: number, spec: PaintSpec) {
  const texture = new ImageData(cols, rows);
  const fromFill = fillOf(spec.from);
  const toFill = spec.to === "transparent" ? null : fillOf(spec.to);
  const ramp = RAMP[spec.direction];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const density = spec.density ?? 1 - ramp(x, y, cols, rows);
      const lit = density > BAYER4[y % 4][x % 4];
      const paint = cellPaint(lit, density, fromFill, toFill, spec.opacity);
      if (paint) {
        setCell(texture.data, y * cols + x, paint.fill, paint.alpha);
      }
    }
  }
  return texture;
}

const gridOf = (width: number, height: number, cell: number) => ({
  cols: Math.min(MAX_COLS, Math.max(4, Math.round(width / cell))),
  rows: Math.min(MAX_ROWS, Math.max(4, Math.round(height / cell))),
});

/**
 * Paint the ordered-dither ramp onto a low-res backing canvas sized from the
 * wrapper's box. Static — one paint per prop/size change, no animation loop,
 * so it's free to use as a page-wide background.
 */
function paintGradient(
  canvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement | null,
  cols: number,
  rows: number,
  spec: PaintSpec
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  canvas.width = cols;
  canvas.height = rows;
  ctx.putImageData(
    cachedTexture(
      `gradient ${cols}x${rows} ${spec.from} ${spec.to} ${spec.direction} ${spec.density} ${spec.opacity}`,
      () => gradientTexture(cols, rows, spec)
    ),
    0,
    0
  );

  const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
  if (bloomCanvas && bloomCtx) {
    bloomCanvas.width = cols;
    bloomCanvas.height = rows;
    bloomCtx.drawImage(canvas, 0, 0);
  }
}

/**
 * Dithered gradient wash — the charts' ordered-dither texture as a background.
 * Fills its nearest positioned ancestor (footer glows, section fades, card
 * backdrops). Dissolves to transparent by default, or dither-blends between
 * two colours when `to` is set.
 */
export function DitherGradient({
  from,
  to = "transparent",
  direction = "up",
  cell = 3,
  density,
  opacity = 1,
  bloom = "off",
  className,
}: DitherGradientProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!(wrap && canvas)) {
      return;
    }
    // The glow canvas only exists while bloom is on.
    const bloomCanvas = bloom === "off" ? null : bloomRef.current;
    // A resize that keeps the same cells keeps the same picture.
    let painted = "";
    const paint = (width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const { cols, rows } = gridOf(width, height, cell);
      if (painted === `${cols}x${rows}`) {
        return;
      }
      painted = `${cols}x${rows}`;
      paintGradient(canvas, bloomCanvas, cols, rows, {
        from,
        to,
        direction,
        cell,
        density,
        opacity,
      });
    };
    if (typeof ResizeObserver === "undefined") {
      const box = wrap.getBoundingClientRect();
      paint(box.width, box.height);
      return;
    }
    // It reports the box once observed, so the first paint needs no layout read of its own.
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        paint(entry.contentRect.width, entry.contentRect.height);
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [from, to, direction, cell, density, opacity, bloom]);

  const bloomStyle = pixelBloomStyle(bloom);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      ref={wrapRef}
    >
      <canvas
        className="absolute inset-0 h-full w-full"
        ref={canvasRef}
        style={{ imageRendering: "pixelated" }}
      />
      {bloomStyle && (
        <canvas
          className="absolute inset-0 h-full w-full"
          ref={bloomRef}
          style={bloomStyle}
        />
      )}
    </div>
  );
}
