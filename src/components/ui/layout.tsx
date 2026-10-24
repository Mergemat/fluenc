// The page frame every route shares: one width and gutter, one header, one empty state and one
// status line, so pages read as one app.
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { DitherGradient } from "../dither-kit/gradient";
import type { PixelColor } from "../dither-kit/pixel";
import { PixelLoader, Rule } from "./dither";

/** The page column: one width and gutter for every page, so nothing jumps between them. */
export const pageFrame = "mx-auto w-full max-w-frame px-gutter pt-page-top";

/** The header sits apart from the body; inside the body, content spaces itself. */
export function Page({
  head,
  children,
}: {
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(pageFrame, "flex min-h-full flex-col gap-group pb-section")}
    >
      {head}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** A link or button back up the trail, in a page title. */
export const crumb =
  "inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground";

export function CrumbSlash() {
  return (
    <span aria-hidden="true" className="text-faint-foreground">
      /
    </span>
  );
}

/** One row of a header: title, rule and meta, centred on one line. */
export const headRow = "flex min-h-8 min-w-0 shrink-0 items-center gap-item";
/** Mono meta at a header's end. */
export const headMeta =
  "flex shrink-0 items-center gap-tight whitespace-nowrap type-label text-muted-foreground tabular-nums";

/**
 * Pixel title, a rule (or whatever stands in for it, like a progress bar) and mono meta on the
 * right. Pages whose content has its own `h1` pass `heading={false}`.
 */
export function PageHeader({
  title,
  meta,
  children,
  heading = true,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  heading?: boolean;
}) {
  const Title = heading ? "h1" : "p";
  return (
    <header className={headRow}>
      <Title className="type-title m-0 inline-flex shrink-0 items-center gap-tight whitespace-nowrap text-foreground">
        {title}
      </Title>
      {children ?? <Rule className="min-w-10" />}
      {meta ? (
        <div className={cn(headMeta, "max-md:ml-auto")}>{meta}</div>
      ) : null}
    </header>
  );
}

const tones = { todo: "text-orange", done: "text-green" } as const;

/** A mono label row: what section heads, kickers and small captions are set in. */
export const label =
  "flex h-4 items-center gap-tight type-label text-muted-foreground";

/**
 * Names a group of content: a mono label with its meta beside it. Space does the grouping, so
 * there is no rule or box; the page header keeps the only rule. `tone` colours the meta for a
 * state (to do, done); `children` sit at the far end, like a legend or a toggle.
 */
export function SectionHead({
  label: text,
  meta,
  tone,
  className,
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  tone?: "todo" | "done";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <h2
      className={cn(
        label,
        "mb-tight h-auto self-stretch whitespace-nowrap",
        className
      )}
    >
      <span className="min-w-0 truncate text-foreground">{text}</span>
      {meta === undefined || meta === null ? null : (
        <span className={cn("dot-before", tone && tones[tone])}>{meta}</span>
      )}
      {children ? (
        <span className="ml-auto flex items-center gap-tight">{children}</span>
      ) : null}
    </h2>
  );
}

/** A dithered tile with a character in it, over a title and a line of detail. */
export function Empty({
  title,
  detail,
  mark = "休",
  tone = "green",
  children,
}: {
  title: string;
  detail: ReactNode;
  mark?: string;
  tone?: PixelColor;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-item py-page text-center">
      <span
        aria-hidden="true"
        className="relative mb-2 grid size-23 place-items-center overflow-hidden rounded-4xl border border-border"
      >
        <DitherGradient cell={2} direction="up" from={tone} opacity={0.55} />
        <span
          className="relative font-hanzi text-56 text-foreground leading-none"
          lang="zh-CN"
        >
          {mark}
        </span>
      </span>
      <h2 className="type-display m-0 tracking-tight">{title}</h2>
      <p className="type-body m-0 max-w-measure-narrow text-muted-foreground">
        {detail}
      </p>
      {children}
    </div>
  );
}

/** A quiet bordered button or link: secondary actions, ways out. */
export const chip =
  "inline-flex h-7 items-center gap-1.75 rounded-chip border border-border px-2.5 type-control text-muted-foreground transition-colors hover:not-disabled:border-border-strong hover:not-disabled:text-foreground";

/** The way out of a status line: a chip, a size up. */
export const statusAction = cn(chip, "h-9 px-3.5");

/** A one-line state (loading, missing, failed) with an optional way out. */
export function Status({
  title,
  action,
  loading = false,
}: {
  title: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div
      className="grid min-h-50 flex-1 place-content-center justify-items-center gap-item py-section text-center text-muted-foreground"
      role={loading ? "status" : undefined}
    >
      {loading ? <PixelLoader label={title} size={5} /> : null}
      <p className="type-body m-0 max-w-measure">{title}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      className="type-label m-0 border-destructive border-l-2 pl-2.5 text-destructive leading-wrap"
      role="alert"
    >
      {children}
    </p>
  );
}
