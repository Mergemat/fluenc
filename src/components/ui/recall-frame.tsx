import type { ReactNode } from "react";

import { SrsRatingButtons } from "../srs-rating-buttons";
import { Button } from "./button";

export function RecallFrame({
  children,
  revealed,
  pending,
  reveal,
  onRate,
}: {
  children: ReactNode;
  revealed: boolean;
  pending: boolean;
  reveal: () => void;
  onRate: (rating: number) => void;
}) {
  return (
    <article className={`recall-frame ${revealed ? "is-revealed" : ""}`}>
      <div className="recall-content">{children}</div>
      <footer className="recall-footer">
        <div aria-hidden={revealed} className="recall-reveal" inert={revealed}>
          <p>Recall it before checking.</p>
          <Button onClick={reveal} type="button">
            Reveal answer <span className="key-hint">Space</span>
          </Button>
        </div>
        <div
          aria-hidden={!revealed}
          className="recall-ratings"
          inert={!revealed}
        >
          <SrsRatingButtons onRate={onRate} pending={pending} />
        </div>
      </footer>
    </article>
  );
}
