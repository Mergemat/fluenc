import { useNavigate } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import type { DashboardData } from "../lib/learner-views";
import { isLearning, nextReviews } from "../lib/review-schedule";
import { cn } from "../lib/utils";
import { DitherButton } from "./dither-kit/button";
import { ReviewDeck } from "./review-card";
import { action, actionKey } from "./ui/buttons";
import {
  DeckPile,
  DeckSlot,
  DeckTable,
  deck,
  deckAction,
  deckActions,
  deckPage,
  slotNote,
} from "./ui/deck";
import { PageHeader } from "./ui/layout";

/** The figure on a card lying on the table, at its size: a timer or a verdict. */
const slotFigure = (size: string) =>
  cn("type-display relative", size, "leading-none");
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
  const now = useNow(waiting);
  const next = useCallback(() => {
    navigate({ to: "/lessons" });
  }, [navigate]);
  // Enter continues to lessons once there is nothing left to wait for.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key !== "Enter" ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, button, a")
    ) {
      return;
    }
    next();
  });
  useEffect(() => {
    if (waiting) {
      return;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [waiting]);

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
  let label = <span>start your first lesson</span>;
  if (state === "finished") {
    label = lesson ? (
      <span>
        learn{" "}
        <b className="font-hanzi" lang="zh-CN">
          {lesson.hanzi}
        </b>{" "}
        next
      </span>
    ) : (
      <span>learn new characters</span>
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
          <DitherButton
            className={cn(action, deckAction, "h-14")}
            color="blue"
            onClick={next}
            variant="gradient"
          >
            {label}
            <kbd className={actionKey}>↵</kbd>
          </DitherButton>
        </footer>
      </div>
    </>
  );
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
