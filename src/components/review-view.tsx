import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { directCharacters } from "../lib/character-props";
import type { DashboardData } from "../lib/learner-views";
import { isLearning, REVIEW_TIME_ZONE } from "../lib/review-schedule";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { ReviewCard } from "./review-card";
import { Empty, PageHeader } from "./ui/layout";

function reviewTime(date: string, includeTime = false) {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: REVIEW_TIME_ZONE,
    day: "numeric",
    month: "long",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  });
}

type DoneState = "waiting" | "finished" | "empty";

const doneCopy: Record<
  DoneState,
  { crumb: string; mark: string; title: string; action: string }
> = {
  waiting: {
    crumb: "short break",
    mark: "等",
    title: "a short break",
    action: "",
  },
  finished: {
    crumb: "done for today",
    mark: "休",
    title: "reviews finished",
    action: "learn new characters",
  },
  empty: {
    crumb: "nothing yet",
    mark: "始",
    title: "start with a lesson",
    action: "start your first lesson",
  },
};

function doneDetail(state: DoneState, learning: number) {
  if (state === "waiting") {
    return `${learning} ${learning === 1 ? "card still needs" : "cards still need"} practice — they come back here by themselves`;
  }
  return state === "finished"
    ? "spend the rest on new characters, then reading"
    : "learn a character or word first — reviews keep what you already understand";
}

function doneStats(
  data: DashboardData,
  reviewed: number,
  waitingUntil: string | null,
  now: number
): [string, string][] {
  if (waitingUntil) {
    return [
      ["back in", countdown(Date.parse(waitingUntil) - now)],
      ["at · shanghai", reviewTime(waitingUntil, true).split(" ").at(-1) ?? ""],
    ];
  }
  const stats: [string, string][] = [];
  if (reviewed) {
    stats.push(["reviewed now", String(reviewed)]);
  }
  if (data.nextReviewAt) {
    stats.push(["next reviews", reviewDay(data.nextReviewAt, now)]);
  }
  stats.push(
    ["characters", String(data.progress.introducedCharacters)],
    ["new ready", String(data.buildQueue.length)]
  );
  return stats;
}

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
  // The session's high-water mark drives the progress bar as the queue drains.
  const [sessionSize, setSessionSize] = useState(data.reviewQueue.length);
  if (data.reviewQueue.length > sessionSize) {
    setSessionSize(data.reviewQueue.length);
  }

  const learning = data.scheduledQueue.filter((item) =>
    isLearning(item.card.state)
  );
  const nextLearningAt = learning.reduce<string | null>(
    (next, item) => (!next || item.card.due < next ? item.card.due : next),
    null
  );
  const hasCards = data.reviewQueue.length + data.scheduledQueue.length > 0;
  const done = sessionSize - data.reviewQueue.length;

  let state: DoneState = "empty";
  if (nextLearningAt) {
    state = "waiting";
  } else if (hasCards) {
    state = "finished";
  }

  return (
    <section className="dx-review">
      <PageHeader
        meta={
          active ? (
            <>
              <b>{data.reviewQueue.length}</b> ready
              {learning.length ? ` · ${learning.length} learning` : ""} ·{" "}
              {active.type === "character" && directCharacters.has(active.hanzi)
                ? "prop"
                : active.type}
            </>
          ) : (
            doneCopy[state].crumb
          )
        }
        title="review"
      >
        <div
          aria-label="Session progress"
          aria-valuemax={sessionSize}
          aria-valuemin={0}
          aria-valuenow={done}
          className="dx-progress"
          role="progressbar"
        >
          <DitherGradient
            cell={2}
            direction="right"
            from="grey"
            opacity={0.5}
          />
          <span
            className="dx-progress-fill"
            style={{
              width: `${sessionSize ? (done / sessionSize) * 100 : 100}%`,
            }}
          >
            <DitherGradient
              cell={2}
              direction="left"
              from={active ? "blue" : "green"}
            />
          </span>
        </div>
      </PageHeader>

      {active ? (
        <ReviewCard
          item={active}
          key={`${active.type}:${active.id}:${active.reps}`}
        />
      ) : (
        <ReviewDone
          data={data}
          learning={learning.length}
          nextLearningAt={nextLearningAt}
          reviewed={done}
          state={state}
        />
      )}
    </section>
  );
}

/** What to do when no card is due: a short break with a live countdown, or the next step. */
function ReviewDone({
  state,
  data,
  reviewed,
  learning,
  nextLearningAt,
}: {
  state: "waiting" | "finished" | "empty";
  data: DashboardData;
  reviewed: number;
  learning: number;
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

  const copy = doneCopy[state];
  const stats = doneStats(data, reviewed, waiting ? nextLearningAt : null, now);

  return (
    <div
      className="dx-done"
      data-state={state}
      role={state === "waiting" ? "status" : undefined}
    >
      <Empty
        detail={doneDetail(state, learning)}
        mark={copy.mark}
        title={copy.title}
        tone={state === "waiting" ? "orange" : "green"}
      >
        <dl className="dx-done-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Empty>
      {state === "waiting" ? null : (
        <footer className="dx-done-actions">
          <DitherButton
            className="dx-action"
            color="blue"
            onClick={next}
            variant="gradient"
          >
            <span>{copy.action}</span>
            <kbd>↵</kbd>
          </DitherButton>
          {state === "finished" && data.getQueue.length ? (
            <Link className="dx-chip" to="/reading">
              read sentences · {data.getQueue.length}
            </Link>
          ) : null}
        </footer>
      )}
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

/** "tomorrow", or a short weekday and date in Shanghai time ("thu 8"). */
function reviewDay(date: string, now: number) {
  const day = (time: number) =>
    new Date(time).toLocaleDateString("en-CA", { timeZone: REVIEW_TIME_ZONE });
  if (day(Date.parse(date)) === day(now + 86_400_000)) {
    return "tomorrow";
  }
  return new Date(date)
    .toLocaleDateString("en-GB", {
      timeZone: REVIEW_TIME_ZONE,
      weekday: "short",
      day: "numeric",
    })
    .toLowerCase();
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
