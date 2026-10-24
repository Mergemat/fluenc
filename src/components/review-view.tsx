import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { DashboardData } from "../lib/learner-views";
import { isLearning, nextReviews } from "../lib/review-schedule";
import { DitherButton } from "./dither-kit/button";
import { ReviewCard } from "./review-card";
import { DeckPile, DeckSlot, DeckTable } from "./ui/deck";
import { PageHeader } from "./ui/layout";

type DoneState = "waiting" | "finished" | "empty";

export function ReviewView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.reviewQueue[0]);
  // A learning step becoming due must not replace the card being answered.
  const active =
    data.reviewQueue.find(
      (item) =>
        item.type === selected?.type &&
        item.id === selected.id &&
        item.reps === selected.reps
    ) ?? data.reviewQueue[0];
  if (
    active?.type !== selected?.type ||
    active?.id !== selected?.id ||
    active?.reps !== selected?.reps
  ) {
    setSelected(active);
  }

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

  return (
    <section className="dx-deck-page">
      <PageHeader title="review" />
      {active ? (
        <ReviewCard
          item={active}
          key={`${active.type}:${active.id}:${active.reps}`}
          remaining={data.reviewQueue.length}
        />
      ) : (
        <ReviewDone
          coming={learning.length}
          data={data}
          nextLearningAt={nextLearningAt}
          state={state}
        />
      )}
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
}: {
  state: DoneState;
  data: DashboardData;
  coming: number;
  nextLearningAt: string | null;
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
      <div className="dx-deck" data-state="waiting" role="status">
        <DeckTable caption="back after a short break">
          <DeckPile under={coming - 1}>
            <DeckSlot state="down">
              <b className="dx-deck-timer">
                {countdown(Date.parse(nextLearningAt ?? "") - now)}
              </b>
              <small>
                {coming} {coming === 1 ? "card" : "cards"}
              </small>
            </DeckSlot>
          </DeckPile>
        </DeckTable>
        <footer className="dx-deck-actions" />
      </div>
    );
  }

  const [lesson] = data.buildQueue;
  let action = <span>start your first lesson</span>;
  if (state === "finished") {
    action = lesson ? (
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
    <div className="dx-deck" data-state={state}>
      <DeckTable>
        <DeckPile under={0}>
          <DeckSlot state="empty">
            {state === "finished" ? (
              <>
                <b className="dx-deck-verdict">done</b>
                <small>next · {nextReviews(data, now) ?? "tomorrow"}</small>
              </>
            ) : (
              <>
                <b className="dx-deck-verdict dx-deck-verdict-long">
                  start with a lesson
                </b>
                <small>reviews keep what you learn</small>
              </>
            )}
          </DeckSlot>
        </DeckPile>
      </DeckTable>
      <footer className="dx-deck-actions">
        <DitherButton
          className="dx-action"
          color="blue"
          onClick={next}
          variant="gradient"
        >
          {action}
          <kbd>↵</kbd>
        </DitherButton>
      </footer>
    </div>
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
