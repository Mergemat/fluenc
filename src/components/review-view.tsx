import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { Rating } from "ts-fsrs";
import type { DashboardData } from "../lib/learner-views";
import { isLearning, nextReviews } from "../lib/review-schedule";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { type Graded, ReviewCard } from "./review-card";
import { Empty, PageHeader, SectionHead } from "./ui/layout";

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

/** The one thing worth knowing once the queue is empty: when cards come back, and how many. */
function doneNext(
  data: DashboardData,
  waitingUntil: string | null,
  now: number
): [string, string] | null {
  if (waitingUntil) {
    return ["back in", countdown(Date.parse(waitingUntil) - now)];
  }
  const next = nextReviews(data, now);
  return next ? ["next reviews", next] : null;
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
  // This visit's grades, latest per card, for the summary once the queue is empty.
  const [graded, setGraded] = useState<ReadonlyMap<string, Graded>>(
    () => new Map()
  );
  const onGraded = useCallback(
    (entry: Graded) =>
      setGraded((previous) => new Map(previous).set(entry.key, entry)),
    []
  );
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
              {learning.length ? ` · ${learning.length} learning` : ""}
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
          onGraded={onGraded}
        />
      ) : (
        <ReviewDone
          data={data}
          graded={[...graded.values()]}
          learning={learning.length}
          nextLearningAt={nextLearningAt}
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
  graded,
  learning,
  nextLearningAt,
}: {
  state: "waiting" | "finished" | "empty";
  data: DashboardData;
  graded: Graded[];
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
  const nextUp = doneNext(data, waiting ? nextLearningAt : null, now);
  const nextLine = nextUp ? (
    <p className="dx-done-next">
      {nextUp[0]} <b>{nextUp[1]}</b>
    </p>
  ) : null;
  const [lesson] = data.buildQueue;
  const action =
    state === "finished" && lesson ? (
      <>
        learn{" "}
        <b className="font-hanzi" lang="zh-CN">
          {lesson.hanzi}
        </b>{" "}
        next
      </>
    ) : (
      copy.action
    );

  return (
    <div
      className="dx-done"
      data-state={state}
      role={state === "waiting" ? "status" : undefined}
    >
      {graded.length ? (
        <Recap graded={graded}>{nextLine}</Recap>
      ) : (
        <Empty
          detail={doneDetail(state, learning)}
          mark={copy.mark}
          title={copy.title}
          tone={state === "waiting" ? "orange" : "green"}
        >
          {nextLine}
        </Empty>
      )}
      {state === "waiting" ? null : (
        <footer className="dx-done-actions">
          <DitherButton
            className="dx-action"
            color="blue"
            onClick={next}
            variant="gradient"
          >
            <span>{action}</span>
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

/** What this visit reviewed: a count, the cards that slipped and when they return. */
function Recap({
  graded,
  children,
}: {
  graded: Graded[];
  children: ReactNode;
}) {
  const slipped = graded.filter(
    (entry) => entry.rating === Rating.Again || entry.rating === Rating.Hard
  );
  return (
    <div className="dx-recap">
      <h2>{graded.length} reviewed</h2>
      {slipped.length ? (
        <>
          <SectionHead label="look at these again" meta={slipped.length} />
          <ul className="dx-recap-slipped">
            {slipped.map((entry) => (
              <li key={entry.key}>
                <span className="font-hanzi" lang="zh-CN">
                  {entry.hanzi}
                  <i className="dx-recap-bar">
                    <DitherGradient
                      cell={2}
                      direction="right"
                      from={entry.rating === Rating.Again ? "red" : "orange"}
                    />
                  </i>
                </span>
                <small>{entry.after}</small>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {children}
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
