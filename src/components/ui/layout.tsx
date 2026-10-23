// The page frame every route shares: one width and gutter, one header, one empty state and one
// status line, so pages read as one app.
import type { ReactNode } from "react";

import { DitherGradient } from "../dither-kit/gradient";
import type { PixelColor } from "../dither-kit/pixel";
import { PixelLoader, Rule } from "./dither";

export function Page({ children }: { children: ReactNode }) {
  return <section className="dx-page">{children}</section>;
}

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
    <header className="dx-head">
      <Title className="dx-head-title">{title}</Title>
      {children ?? <Rule />}
      {meta ? <div className="dx-head-meta">{meta}</div> : null}
    </header>
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
    <div className="dx-empty">
      <span aria-hidden="true" className="dx-empty-mark">
        <DitherGradient cell={2} direction="up" from={tone} opacity={0.55} />
        <span className="font-hanzi" lang="zh-CN">
          {mark}
        </span>
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {children}
    </div>
  );
}

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
    <div className="dx-status" role={loading ? "status" : undefined}>
      {loading ? <PixelLoader label={title} size={5} /> : null}
      <p>{title}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="dx-error" role="alert">
      {children}
    </p>
  );
}
