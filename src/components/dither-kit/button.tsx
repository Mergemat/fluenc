import { type ComponentProps, useEffect, useRef } from "react";
import { cn } from "./lib";
import { rgb } from "./palette";
import {
  BAYER4,
  clamp01,
  fillOf,
  type PixelBloom,
  type PixelColor,
  pixelBloomStyle,
  pixelPrefersReducedMotion,
} from "./pixel";

const CELL = 2; // css px per dither cell — same chunk as the charts

export type ButtonVariant = "gradient" | "dotted" | "hatched" | "solid";

export type DitherButtonProps = ComponentProps<"button"> & {
  /** Fill colour — a palette name or a hue (0–360). */
  color?: PixelColor;
  /** Fill texture — the same four variants the charts use. */
  variant?: ButtonVariant;
  /** Glow on the dither fill. */
  bloom?: PixelBloom;
};

interface PaintState {
  fill: [number, number, number];
  variant: ButtonVariant;
}

// Row density for the flat textures; "gradient" ramps up toward the bottom instead.
const FLAT_DENSITY: Record<Exclude<ButtonVariant, "gradient">, number> = {
  dotted: 0.5,
  hatched: 0.75,
  solid: 0.75,
};

// The glow's time constant: what a 0.16 step per frame gave on a 60Hz screen.
const GLOW_MS = 96;

/** The glow `elapsedMs` closer to `target`, by time rather than by frame, so 120Hz isn't faster. */
export const glowToward = (
  intensity: number,
  target: number,
  elapsedMs: number
) => intensity + (target - intensity) * (1 - Math.exp(-elapsedMs / GLOW_MS));

const rowDensity = (variant: ButtonVariant, y: number, rows: number) =>
  variant === "gradient"
    ? 0.25 + 0.75 * ((y + 0.5) / rows)
    : FLAT_DENSITY[variant];

/** One cell's alpha, or null when the texture leaves it empty. */
function cellAlpha(
  variant: ButtonVariant,
  x: number,
  y: number,
  density: number,
  intensity: number
) {
  if (variant === "hatched" && (x + y) % 4 >= 2) {
    return null;
  }
  const bias = variant === "dotted" ? 0.12 : 0;
  const lit =
    variant === "solid" ||
    density > BAYER4[y % 4][x % 4] - 0.1 * intensity - bias;
  if (variant === "dotted" && !lit) {
    return null;
  }
  const k = (0.3 + density * 0.7) * (1 + 0.22 * intensity);
  return clamp01(lit ? k : k * 0.4);
}

/**
 * Paint one frame of the button fill: the ordered-dither texture (dense at the
 * bottom, dissolving upward for "gradient") capped by a soft border outline,
 * with `intensity` (0 rest, 1 hover, ~1.5 pressed) lifting density and alpha —
 * the same lift the charts do on hover.
 */
function paintButton(
  ctx: CanvasRenderingContext2D,
  bloomCtx: CanvasRenderingContext2D | null,
  cols: number,
  rows: number,
  { fill, variant }: PaintState,
  intensity: number
): void {
  ctx.clearRect(0, 0, cols, rows);
  for (let y = 0; y < rows; y += 1) {
    const density = rowDensity(variant, y, rows);
    for (let x = 0; x < cols; x += 1) {
      const alpha = cellAlpha(variant, x, y, density, intensity);
      if (alpha !== null) {
        ctx.fillStyle = rgb(fill, 1, alpha);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Soft outline in the fill colour, brightening a touch on hover.
  ctx.fillStyle = rgb(fill, 1, clamp01(0.5 + 0.25 * intensity));
  ctx.fillRect(0, 0, cols, 1);
  ctx.fillRect(0, rows - 1, cols, 1);
  ctx.fillRect(0, 0, 1, rows);
  ctx.fillRect(cols - 1, 0, 1, rows);
  if (bloomCtx) {
    bloomCtx.clearRect(0, 0, cols, rows);
    bloomCtx.drawImage(ctx.canvas, 0, 0);
  }
}

/**
 * Dithered button — a native `<button>` whose background is the charts'
 * ordered-dither fill on a low-res canvas. Hover eases the dither denser and
 * brighter; pressing lifts it further. Standalone: shares only the pixel
 * primitives and palette with the rest of the kit.
 */
export function DitherButton({
  color = "blue",
  variant = "gradient",
  bloom = "off",
  className,
  children,
  ...props
}: DitherButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(button && canvas && ctx)) {
      return;
    }
    // The glow canvas only exists while bloom is on.
    const bloomCanvas = bloom === "off" ? null : bloomRef.current;
    const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
    const state: PaintState = { fill: fillOf(color), variant };
    const reduce = pixelPrefersReducedMotion();

    let cols = 0;
    let rows = 0;
    let intensity = 0;
    let target = 0;
    let hovered = false;
    let raf = 0;
    let last = 0;

    const paint = () =>
      paintButton(ctx, bloomCtx, cols, rows, state, intensity);

    const tick = (now: number) => {
      if (Math.abs(target - intensity) < 0.01) {
        intensity = target;
        paint();
        raf = 0;
        return;
      }
      intensity = glowToward(intensity, target, Math.max(0, now - last));
      last = now;
      paint();
      raf = requestAnimationFrame(tick);
    };

    // Ease toward the new lift target — the loop only runs while settling.
    const setTarget = (t: number) => {
      target = t;
      if (reduce) {
        intensity = t;
        paint();
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const resize = () => {
      const box = button.getBoundingClientRect();
      cols = Math.max(4, Math.round(box.width / CELL));
      rows = Math.max(4, Math.round(box.height / CELL));
      canvas.width = cols;
      canvas.height = rows;
      if (bloomCanvas) {
        bloomCanvas.width = cols;
        bloomCanvas.height = rows;
      }
      paint();
    };
    resize();

    const enter = () => {
      hovered = true;
      setTarget(1);
    };
    const leave = () => {
      hovered = false;
      setTarget(0);
    };
    const down = () => setTarget(1.5);
    const up = () => setTarget(hovered ? 1 : 0);
    button.addEventListener("pointerenter", enter);
    button.addEventListener("pointerleave", leave);
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);

    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    ro?.observe(button);

    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      button.removeEventListener("pointerenter", enter);
      button.removeEventListener("pointerleave", leave);
      button.removeEventListener("pointerdown", down);
      button.removeEventListener("pointerup", up);
      button.removeEventListener("pointercancel", up);
      ro?.disconnect();
    };
  }, [color, variant, bloom]);

  const bloomStyle = pixelBloomStyle(bloom);

  return (
    <button
      className={cn(
        "relative isolate overflow-hidden rounded-md px-4 py-2 font-mono text-foreground text-xs transition-[opacity,scale] duration-160 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 active:not-disabled:scale-97 disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      ref={buttonRef}
      type="button"
      {...props}
    >
      <canvas
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full"
        ref={canvasRef}
        style={{ imageRendering: "pixelated" }}
      />
      {bloomStyle && (
        <canvas
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          ref={bloomRef}
          style={bloomStyle}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
