import { expect, test } from "bun:test";

import {
  activityCalendar,
  activityDensity,
  activityStreaks,
  countThisWeek,
  dayKey,
} from "./activity";

// Local times, so the tests hold in any time zone.
const at = (month: number, day: number, hours = 12) =>
  new Date(2026, month - 1, day, hours).toISOString();
const friday = new Date(2026, 9, 23, 18);

test("the calendar ends with this week and leaves the days after today blank", () => {
  const weeks = activityCalendar(
    [at(10, 21, 9), at(10, 21, 20), at(10, 12)],
    friday,
    2
  );
  const days = weeks.flat();

  expect(days.map((day) => day.key)[0]).toBe("2026-10-12");
  expect(days.at(-1)?.key).toBe("2026-10-25");
  expect(days.find((day) => day.key === "2026-10-21")?.count).toBe(2);
  expect(days.find((day) => day.key === "2026-10-12")?.count).toBe(1);
  expect(days.filter((day) => day.future).map((day) => day.key)).toEqual([
    "2026-10-24",
    "2026-10-25",
  ]);
});

test("a streak still counts while today is empty, and breaks on a missed day", () => {
  const run = [at(10, 20), at(10, 21), at(10, 22)];

  expect(activityStreaks(run, friday).current).toBe(3);
  expect(activityStreaks([...run, at(10, 23)], friday).current).toBe(4);
  expect(activityStreaks([at(10, 20), at(10, 21)], friday).current).toBe(0);
});

test("the longest streak and active days span every recorded day", () => {
  const dates = [
    ...[1, 2, 3, 4, 5].map((day) => at(9, day)),
    at(9, 5, 20),
    at(10, 22),
  ];

  expect(activityStreaks(dates, friday)).toEqual({
    current: 1,
    longest: 5,
    activeDays: 6,
  });
});

test("this week is the last seven days, today included", () => {
  expect(
    countThisWeek([at(10, 16), at(10, 17), at(10, 23), at(10, 23)], friday)
  ).toBe(3);
  expect(dayKey(new Date(2026, 0, 2))).toBe("2026-01-02");
});

test("a light day still shows next to the busiest one, and busier days are denser", () => {
  expect(activityDensity(0, 20)).toBe(0);
  expect(activityDensity(20, 20)).toBe(1);
  // A log scale: one item out of twenty is far denser than a twentieth.
  expect(activityDensity(1, 20)).toBeGreaterThan(0.25);
  expect(activityDensity(5, 20)).toBeGreaterThan(activityDensity(2, 20));
});
