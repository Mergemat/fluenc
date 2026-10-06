import type { ReactNode } from "react";

import { Rule } from "./dither";

export function Page({ children }: { children: ReactNode }) {
  return <section className="study-page">{children}</section>;
}

export function PageHeader({
  title,
  meta,
}: {
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="page-header">
      <h1 className="page-title">{title}</h1>
      <Rule />
      {meta ? <div className="page-meta">{meta}</div> : null}
    </header>
  );
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-mark font-hanzi">
        休
      </span>
      <h2 className="m-0 font-semibold text-xl tracking-tight">{title}</h2>
      <p className="m-0 max-w-[420px] text-muted text-sm leading-relaxed">
        {detail}
      </p>
    </div>
  );
}

export function Status({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="status-panel">
      <p className="m-0 font-medium text-sm">{title}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 border-danger border-l-2 pt-0 pl-3 font-medium text-danger text-xs"
      role="alert"
    >
      {children}
    </p>
  );
}
