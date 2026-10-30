import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback } from "react";
import { useNow } from "../hooks/use-now";
import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import type { DashboardData } from "../lib/learner-views";
import { isLearning, nextReviews } from "../lib/review-schedule";
import { cn } from "../lib/utils";
import { ReviewDeck } from "./review-card";
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

const verdict = slotFigure("text-center text-verdict");

type DoneState = "waiting" | "finished" | "empty";

export function ReviewView({ data }: { data: DashboardData }) {
  const learning = data.scheduledQueue.filter((item) =>
    isLearning(item.card.state)
  );
  const nextLearningAt = learning.reduce<string | null>(
    (next, item) => (!next || item.card.due < next ? item.card.due : next),
    null
  );
  const hasCards = data.reviewQueue.length + data.scheduledQueue.length > 0;

  let state: DoneState = "empty";
  if (nextLearningAt) {
    state = "waiting";
  } else if (hasCards) {
    state = "finished";
  }

  const coming = learning.length;
  const done = useCallback(
    (arrived: boolean, back: ReactNode) => (
      <ReviewDone
        arrived={arrived}
        back={back}
        coming={coming}
        data={data}
        nextLearningAt={nextLearningAt}
        state={state}
      />
    ),
    [coming, data, nextLearningAt, state]
  );

  return (
    <section className={deckPage}>
      <ReviewDeck done={done} queue={data.reviewQueue} />
    </section>
  );
}

/**
 * The deck is empty, and that answers one question: are cards coming back after a break (face
 * down, with a timer), or is review done for now (when it fills again)? No recap.
 */
function ReviewDone({
  state,
  data,
  coming,
  nextLearningAt,
  arrived,
  back,
}: {
  state: DoneState;
  data: DashboardData;
  coming: number;
  nextLearningAt: string | null;
  /** The last card of a deck just left, so the slot settles in rather than standing there. */
  arrived: boolean;
  /** Takes the last review back, when there is one. */
  back: ReactNode;
}) {
  const navigate = useNavigate();
  const waiting = state === "waiting";
  const now = useNow(1000, waiting);
  const next = useCallback(() => {
    navigate({ to: "/lessons" });
  }, [navigate]);
  // Enter continues to lessons once there is nothing left to wait for.
  useWindowKeys((event) => {
    if (
      event.key === "Enter" &&
      isShortcut(event, "input, textarea, button, a")
    ) {
      next();
    }
  }, !waiting);

  if (waiting) {
    // The dashboard refetches when the first card is due, which deals the deck back in.
    return (
      <>
        <PageHeader
          meta={
            <>
              {back}
              <span>back after a short break</span>
            </>
          }
          title="review"
        />
        <div className={deck} data-state="waiting" role="status">
          <DeckTable>
            <DeckPile under={coming - 1}>
              <DeckSlot arrive={arrived} state="down">
                <b className={slotFigure("text-timer tabular-nums")}>
                  {countdown(Date.parse(nextLearningAt ?? "") - now)}
                </b>
                <small className={slotNote}>
                  {coming} {coming === 1 ? "card" : "cards"}
                </small>
              </DeckSlot>
            </DeckPile>
          </DeckTable>
          <footer className={deckActions()} />
        </div>
      </>
    );
  }

  const [lesson] = data.buildQueue;
  let label: ReactNode = "start your first lesson";
  if (state === "finished") {
    label = lesson ? (
      <>
        learn{" "}
        <b className="font-hanzi" lang="zh-CN">
          {lesson.hanzi}
        </b>{" "}
        next
      </>
    ) : (
      "learn new characters"
    );
  }
  return (
    <>
      <PageHeader meta={back} title="review" />
      <div className={deck} data-state={state}>
        <DeckTable>
          <DeckPile under={0}>
            <DeckSlot arrive={arrived} state="empty">
              {state === "finished" ? (
                <>
                  <b className={cn(verdict, arrived && "animate-rise")}>done</b>
                  <small className={slotNote}>
                    next · {nextReviews(data, now) ?? "tomorrow"}
                  </small>
                </>
              ) : (
                <>
                  <b
                    className={slotFigure(
                      "text-balance text-center text-verdict-long"
                    )}
                  >
                    start with a lesson
                  </b>
                  <small className={slotNote}>
                    reviews keep what you learn
                  </small>
                </>
              )}
            </DeckSlot>
          </DeckPile>
        </DeckTable>
        <footer className={deckActions()}>
          <ActionButton
            className={deckAction}
            color="blue"
            hint="↵"
            onClick={next}
            variant="gradient"
          >
            {label}
          </ActionButton>
        </footer>
      </div>
    </>
  );
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
