import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export type Tone = "ok" | "busy" | "warn" | "error" | "idle";

const dots: Record<Tone, string> = {
  ok: "bg-green",
  busy: "bg-blue animate-pulse-fast",
  warn: "bg-orange",
  error: "bg-red",
  idle: "bg-faint-foreground",
};

/**
 * One line of the settings panel: what it is, its current state, and its action. On a phone the
 * state goes under the rest. A group's rows are split by lines; the last one ends without one.
 */
export function SettingRow({
  id,
  title,
  note,
  tone,
  status,
  children,
}: {
  id: string;
  title: string;
  note: string;
  tone: Tone;
  status: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-setting items-center gap-x-4 gap-y-2 border-border not-last:border-b py-3 sm:grid-cols-setting-wide"
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <h2 className="type-heading m-0" id={id}>
          {title}
        </h2>
        <p className="type-body mt-1 mb-0 text-pretty text-muted-foreground">
          {note}
        </p>
      </div>
      <p
        className={cn(
          "type-control col-span-2 row-start-2 m-0 flex items-baseline gap-2 leading-wrap sm:col-span-1 sm:col-start-2 sm:row-start-1",
          tone === "idle" ? "text-muted-foreground" : "text-foreground"
        )}
        role="status"
      >
        <i
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 -translate-y-px rounded-xs",
            dots[tone]
          )}
        />
        <span>{status}</span>
      </p>
      {children ? (
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
