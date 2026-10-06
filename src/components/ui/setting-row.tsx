import type { ReactNode } from "react";

export type Tone = "ok" | "busy" | "warn" | "error" | "idle";

/** One line of the settings panel: what it is, its current state, and its action. */
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
    <section aria-labelledby={id} className="dx-set-row">
      <div className="dx-set-head">
        <h2 id={id}>{title}</h2>
        <p>{note}</p>
      </div>
      <p className="dx-set-status" data-tone={tone} role="status">
        <i aria-hidden="true" />
        <span>{status}</span>
      </p>
      {children ? <div className="dx-set-actions">{children}</div> : null}
    </section>
  );
}
