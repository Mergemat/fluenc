import { useNavigate } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { Grade } from "ts-fsrs";
import type { DashboardData, ReviewItem } from "../lib/learner-views";
import { isLearning, nextReviews } from "../lib/review-schedule";
import { saveReview } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { DitherButton } from "./dither-kit/button";
import { ReviewCard, ThrownCard, throwSide } from "./review-card";
import { DeckPile, DeckSlot, DeckTable } from "./ui/deck";
import { PageHeader } from "./ui/layout";

type DoneState = "waiting" | "finished" | "empty";

// A thrown card goes when its throw ends; this only clears it where no animation runs.
const THROWN_FALLBACK_MS = 600;

const cardKey = (item: ReviewItem) => `${item.type}:${item.id}:${item.reps}`;

interface Thrown {
  id: number;
  item: ReviewItem;
  side: "left" | "right";
}

/**
 * A grade deals the next card at once: the graded card leaves the queue and flies off over the
 * pile while its save runs. A save that fails puts the card back.
 */
function useGrading() {
  const { mutateAsync } = useProgressMutation(saveReview);
  const [graded, setGraded] = useState<ReadonlySet<string>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const [thrown, setThrown] = useState<Thrown[]>([]);
  const lastThrow = useRef(0);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) {
        window.clearTimeout(timer);
      }
    };
  }, []);
  const drop = useCallback(
    (id: number) =>
      setThrown((previous) => previous.filter((card) => card.id !== id)),
    []
  );
  const grade = useCallback(
    (item: ReviewItem, rating: Grade, durationMs: number) => {
      const key = cardKey(item);
      lastThrow.current += 1;
      const id = lastThrow.current;
      setGraded((previous) => new Set(previous).add(key));
      setFailed(false);
      setThrown((previous) => [
        ...previous,
        { id, item, side: throwSide(rating) },
      ]);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        drop(id);
      }, THROWN_FALLBACK_MS);
      timers.current.add(timer);
      mutateAsync({
        itemType: item.type,
        itemId: item.id,
        rating,
        durationMs,
      }).catch(() => {
        setGraded((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
        setFailed(true);
      });
    },
    [mutateAsync, drop]
  );
  const flying = thrown.map((card) => (
    <ThrownCard
      id={card.id}
      item={card.item}
      key={card.id}
      onGone={drop}
      side={card.side}
    />
  ));
  return { graded, failed, flying, grade };
}

export function ReviewView({ data }: { data: DashboardData }) {
  const { graded, failed, flying, grade } = useGrading();
  // Graded cards wait for their save outside the queue.
  const queue = data.reviewQueue.filter((item) => !graded.has(cardKey(item)));
  const saving = queue.length < data.reviewQueue.length;
  const [selected, setSelected] = useState(() => queue[0]);
  // A learning step becoming due must not replace the card being answered.
  const active =
    queue.find(
      (item) =>
        item.type === selected?.type &&
        item.id === selected.id &&
        item.reps === selected.reps
    ) ?? queue[0];
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

  let body: ReactNode;
  if (active) {
    body = (
      <ReviewCard
        failed={failed}
        item={active}
        key={cardKey(active)}
        onGrade={grade}
        remaining={queue.length}
        thrown={flying}
      />
    );
  } else if (saving) {
    // The last grade is still saving: an empty pile until it says what comes next.
    body = (
      <div className="dx-deck">
        <DeckTable>
          <DeckPile over={flying} under={0} />
        </DeckTable>
        <footer className="dx-deck-actions" />
      </div>
    );
  } else {
    body = (
      <ReviewDone
        coming={learning.length}
        data={data}
        nextLearningAt={nextLearningAt}
        state={state}
        thrown={flying}
      />
    );
  }

  return (
    <section className="dx-deck-page">
      <PageHeader title="review" />
      {body}
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
  thrown,
}: {
  state: DoneState;
  data: DashboardData;
  coming: number;
  nextLearningAt: string | null;
  /** The last card, still flying off. */
  thrown: ReactNode;
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
          <DeckPile over={thrown} under={coming - 1}>
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
        <DeckPile over={thrown} under={0}>
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
