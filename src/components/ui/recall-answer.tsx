import type { ReactNode } from "react";

export function RecallAnswer({
  revealed,
  hint,
  children,
}: {
  revealed: boolean;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="recall-answer">
      <div
        aria-hidden={!revealed}
        className="recall-answer-content"
        inert={!revealed}
      >
        {children}
      </div>
      {revealed ? null : <p className="recall-hint">{hint}</p>}
    </div>
  );
}
