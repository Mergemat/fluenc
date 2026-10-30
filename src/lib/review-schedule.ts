import { type Card, fsrs, type Grade, Rating, State } from "ts-fsrs";

import type { DashboardData } from "./learner-views";

export const REVIEW_TIME_ZONE = "Asia/Shanghai";

const dayMs = 86_400_000;
// Shanghai is UTC+8. Use UTC arithmetic so server and offline devices agree.
const shanghaiOffsetMs = 8 * 3_600_000;

export function reviewDay(date: Date) {
  return Math.floor((date.getTime() + shanghaiOffsetMs) / dayMs);
}

const scheduler = fsrs({
  request_retention: 0.95,
  enable_short_term: true,
  enable_fuzz: false,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

export function isLearning(state: number) {
  return state === State.Learning || state === State.Relearning;
}

export function reviewDueAt(due: Date, state: number): Date {
  // Long-term reviews belong to a calendar day; short learning steps keep their exact time.
  return state === State.Review
    ? new Date(reviewDay(due) * dayMs - shanghaiOffsetMs)
    : due;
}

/** Learning steps first, then established reviews, then newly introduced cards. */
export function reviewPriority(state: number) {
  if (isLearning(state)) {
    return 0;
  }
  return state === State.Review ? 1 : 2;
}

export function compareReviewOrder(
  left: { due: Date | string; state: number },
  right: { due: Date | string; state: number }
) {
  return (
    reviewPriority(left.state) - reviewPriority(right.state) ||
    new Date(left.due).getTime() - new Date(right.due).getTime()
  );
}

export function scheduleReview(
  card: Card,
  reviewedAt: Date,
  rating: Grade
): Card {
  const next = scheduler.next(card, reviewedAt, rating).card;
  return { ...next, due: reviewDueAt(next.due, next.state) };
}

const grades: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

/** When the card would come back after each grade, if it were graded at `at`. */
export function previewDue(card: Card, at: Date) {
  const preview = scheduler.repeat(card, at);
  return new Map(
    grades.map((grade) => {
      const next = preview[grade].card;
      return [grade, reviewDueAt(next.due, next.state)] as const;
    })
  );
}

/** How long until `due`, short: "10 min", "5 h", "1 day", "12 days", "3 mo", "2 yr". */
export function waitLabel(from: Date, due: Date) {
  const minutes = Math.round((due.getTime() - from.getTime()) / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }
  // Long-term cards are due on a Shanghai calendar day, so count days by the calendar.
  const days = reviewDay(due) - reviewDay(from);
  if (days < 1) {
    return `${Math.round(minutes / 60)} h`;
  }
  if (days < 45) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  return days < 365
    ? `${Math.round(days / 30)} mo`
    : `${Math.round(days / 365)} yr`;
}

/** "tomorrow", or a short weekday and date in Shanghai time ("thu 8"). */
function reviewDayLabel(date: string, now: number) {
  const day = (time: number) =>
    new Date(time).toLocaleDateString("en-CA", { timeZone: REVIEW_TIME_ZONE });
  if (day(Date.parse(date)) === day(now + dayMs)) {
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

/** When reviews come back and how many that day: "tomorrow · 14", or "in 8 min · 2" today. */
export function nextReviews(
  data: Pick<DashboardData, "nextReviewAt" | "scheduledQueue">,
  now: number
) {
  if (!data.nextReviewAt) {
    return null;
  }
  const at = new Date(data.nextReviewAt);
  const day = reviewDay(at);
  const count = data.scheduledQueue.filter(
    (item) => reviewDay(new Date(item.card.due)) === day
  ).length;
  const when =
    day === reviewDay(new Date(now))
      ? `in ${waitLabel(new Date(now), at)}`
      : reviewDayLabel(data.nextReviewAt, now);
  return `${when} · ${count}`;
}
