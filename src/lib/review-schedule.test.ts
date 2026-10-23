import { expect, test } from "bun:test";
import { createEmptyCard, Rating, State } from "ts-fsrs";

import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
} from "./learner-state";
import { deriveDashboard } from "./learner-views";
import {
  compareReviewOrder,
  previewDue,
  reviewDueAt,
  scheduleReview,
  waitLabel,
} from "./review-schedule";

const review = (state: LearnerState, rating: number, reviewedAt: string) =>
  applyOperation(state, {
    kind: "review",
    data: {
      itemType: "sentence",
      itemId: "s01",
      rating,
      reviewedAt,
      durationMs: 100,
    },
  });
const at = (state: LearnerState, time: string) =>
  deriveDashboard(state, new Date(time));

test("a new card needs spaced recall before graduating, including after an offline reload", () => {
  const enrolled = applyOperation(emptyLearnerState, {
    kind: "enroll",
    data: {
      itemType: "sentence",
      itemId: "s01",
      enrolledAt: "2026-09-23T02:00:00.000Z",
    },
  });
  const first = review(enrolled, Rating.Good, "2026-09-23T02:00:00.000Z");
  expect(at(first, "2026-09-23T02:00:00.000Z").reviewQueue).toHaveLength(0);
  expect(
    at(first, "2026-09-23T02:00:00.000Z").scheduledQueue[0]?.card.state
  ).toBe(State.Learning);
  expect(at(first, "2026-09-23T02:00:00.000Z").nextReviewAt).toBe(
    "2026-09-23T02:10:00.000Z"
  );

  // The offline cache stores state by structured clone.
  const restored = structuredClone(first);
  expect(at(restored, "2026-09-23T02:09:59.000Z").reviewQueue).toHaveLength(0);
  expect(
    at(restored, "2026-09-23T02:10:00.000Z").reviewQueue.map((item) => item.id)
  ).toEqual(["s01"]);
  const graduated = review(restored, Rating.Good, "2026-09-23T02:10:00.000Z");
  expect(
    at(graduated, "2026-09-23T02:10:00.000Z").scheduledQueue[0]?.card.state
  ).toBe(State.Review);
  expect(at(graduated, "2026-09-23T02:10:00.000Z").nextReviewAt).toBe(
    "2026-09-23T16:00:00.000Z"
  );
  expect(at(graduated, "2026-09-23T15:59:59.000Z").reviewQueue).toHaveLength(0);
  expect(at(graduated, "2026-09-23T16:00:00.000Z").reviewQueue).toHaveLength(1);
});

test("a failed new card waits one minute, then still needs the ten-minute step", () => {
  const now = new Date("2026-09-23T15:59:30.000Z");
  const missed = scheduleReview(createEmptyCard(now), now, Rating.Again);
  expect(missed.due.toISOString()).toBe("2026-09-23T16:00:30.000Z");
  expect(missed.state).toBe(State.Learning);
  const recalled = scheduleReview(missed, missed.due, Rating.Good);
  expect(recalled.due.toISOString()).toBe("2026-09-23T16:10:30.000Z");
  expect(recalled.state).toBe(State.Learning);
});

test("a forgotten established card relearns after a pause; Hard cannot finish a failed recall", () => {
  const now = new Date("2026-09-23T02:00:00.000Z");
  const established = scheduleReview(createEmptyCard(now), now, Rating.Easy);
  const missed = scheduleReview(established, established.due, Rating.Again);
  expect(missed.state).toBe(State.Relearning);
  expect(missed.lapses).toBe(1);
  expect(missed.due.getTime() - established.due.getTime()).toBe(10 * 60_000);

  const hard = scheduleReview(missed, missed.due, Rating.Hard);
  expect(hard.state).toBe(State.Relearning);
  expect(hard.due.getTime()).toBeGreaterThan(missed.due.getTime());
  const recalled = scheduleReview(hard, hard.due, Rating.Good);
  expect(recalled.state).toBe(State.Review);
  expect(recalled.due.getTime()).toBeGreaterThan(hard.due.getTime());
});

test("long-term cards are available throughout their Shanghai review day, including year boundaries", () => {
  for (const due of [
    "2026-12-31T16:30:00.000Z",
    "2027-01-01T03:00:00.000Z",
    "2027-01-01T15:59:59.000Z",
  ]) {
    expect(reviewDueAt(new Date(due), State.Review).toISOString()).toBe(
      "2026-12-31T16:00:00.000Z"
    );
  }
  const overdue = applyOperation(emptyLearnerState, {
    kind: "enroll",
    data: {
      itemType: "sentence",
      itemId: "s01",
      enrolledAt: "2026-09-01T02:00:00.000Z",
    },
  });
  expect(at(overdue, "2026-09-23T02:00:00.000Z").reviewQueue).toHaveLength(1);
});

test("due learning steps precede established reviews, which precede newly introduced cards", () => {
  const cards = [
    { id: "new", state: State.New, due: "2026-09-01T00:00:00Z" },
    { id: "recent", state: State.Review, due: "2026-09-22T16:00:00Z" },
    { id: "old", state: State.Review, due: "2026-09-02T16:00:00Z" },
    { id: "learning", state: State.Learning, due: "2026-09-23T02:00:00Z" },
  ];
  expect(cards.sort(compareReviewOrder).map((card) => card.id)).toEqual([
    "learning",
    "old",
    "recent",
    "new",
  ]);
});

test("each grade's preview is where grading would actually put the card", () => {
  const start = new Date("2026-09-01T02:00:00.000Z");
  const established = scheduleReview(
    createEmptyCard(start),
    start,
    Rating.Easy
  );
  const now = new Date(established.due.getTime() + 3_600_000);
  const preview = previewDue(established, now);
  for (const grade of [
    Rating.Again,
    Rating.Hard,
    Rating.Good,
    Rating.Easy,
  ] as const) {
    expect(preview.get(grade)).toEqual(
      scheduleReview(established, now, grade).due
    );
  }
  expect(waitLabel(now, preview.get(Rating.Again) as Date)).toBe("10 min");
});

test("waits read in minutes, then hours within the day, then Shanghai calendar days", () => {
  const now = new Date("2026-09-23T02:00:00.000Z");
  const later = (ms: number) => new Date(now.getTime() + ms);
  expect(waitLabel(now, later(30_000))).toBe("1 min");
  expect(waitLabel(now, later(10 * 60_000))).toBe("10 min");
  expect(waitLabel(now, later(5 * 3_600_000))).toBe("5 h");
  // Due at the start of the next Shanghai day, 14 hours away, is tomorrow.
  expect(waitLabel(now, new Date("2026-09-23T16:00:00.000Z"))).toBe("1 day");
  expect(waitLabel(now, new Date("2026-10-04T16:00:00.000Z"))).toBe("12 days");
  expect(waitLabel(now, new Date("2026-12-23T16:00:00.000Z"))).toBe("3 mo");
});
