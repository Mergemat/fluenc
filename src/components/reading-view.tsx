import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import type { DashboardData } from "../lib/learner-views";
import { cn } from "../lib/utils";
import { ReadingLesson } from "./reading-lesson";
import { ActionButton } from "./ui/button";
import {
  DeckPile,
  DeckSlot,
  DeckTable,
  deck,
  deckAction,
  deckActions,
  deckPage,
  slotFigure,
  slotNote,
} from "./ui/deck";
import { PageHeader } from "./ui/layout";

export function ReadingView({ data }: { data: DashboardData }) {
  const [sentence] = data.getQueue;

  return (
    <section className={deckPage}>
      <PageHeader title="read" />
      {sentence ? (
        <ReadingLesson
          item={sentence}
          key={sentence.id}
          remaining={data.getQueue.length}
        />
      ) : (
        <ReadingEmpty />
      )}
    </section>
  );
}

/** No sentence is readable yet: the empty place on the table, as review shows it, and the way on. */
function ReadingEmpty() {
  const navigate = useNavigate();
  const next = useCallback(() => {
    navigate({ to: "/lessons" });
  }, [navigate]);
  useWindowKeys((event) => {
    if (
      event.key === "Enter" &&
      isShortcut(event, "input, textarea, button, a")
    ) {
      next();
    }
  });

  return (
    <div className={deck}>
      <DeckTable>
        <DeckPile under={0}>
          <DeckSlot state="empty">
            <b
              className={slotFigure(
                "text-balance text-center text-verdict-long"
              )}
            >
              nothing to read yet
            </b>
            <small className={slotNote}>sentences unlock as you learn</small>
          </DeckSlot>
        </DeckPile>
      </DeckTable>
      <footer className={deckActions()}>
        <ActionButton
          className={cn(deckAction, "h-14")}
          color="blue"
          hint="↵"
          onClick={next}
          variant="gradient"
        >
          learn new characters
        </ActionButton>
      </footer>
    </div>
  );
}
