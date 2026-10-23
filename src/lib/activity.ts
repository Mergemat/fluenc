// Days the learner met something new, by the device's own calendar: the GitHub-style graph, the
// streak and what this week added. Only introductions are dated, so review-only days stay empty.

/** A local calendar day as YYYY-MM-DD. */
export const dayKey = (date: Date) => date.toLocaleDateString("en-CA");

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

function countByDay(dates: readonly string[]) {
  const counts = new Map<string, number>();
  for (const at of dates) {
    const key = dayKey(new Date(at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface ActivityDay {
  count: number;
  date: Date;
  /** After today: the rest of this week, left blank. */
  future: boolean;
  key: string;
}

/** `weeks` columns of Monday-to-Sunday days, the last holding today. */
export function activityCalendar(
  dates: readonly string[],
  today: Date,
  weeks: number
): ActivityDay[][] {
  const counts = countByDay(dates);
  const todayKey = dayKey(today);
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const first = addDays(monday, -(weeks - 1) * 7);
  let future = false;
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_unused, weekday) => {
      const date = addDays(first, week * 7 + weekday);
      const key = dayKey(date);
      const day = { key, date, count: counts.get(key) ?? 0, future };
      future ||= key === todayKey;
      return day;
    })
  );
}

/**
 * The current streak of days with something new, counted back from today, or from yesterday
 * while today is still empty; the longest streak ever; and how many days had anything.
 */
export function activityStreaks(dates: readonly string[], today: Date) {
  const active = new Set(countByDay(dates).keys());
  let cursor = active.has(dayKey(today)) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  for (const key of active) {
    // Count only from the first day of each run.
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
    if (active.has(dayKey(addDays(date, -1)))) {
      continue;
    }
    let length = 1;
    while (active.has(dayKey(addDays(date, length)))) {
      length += 1;
    }
    longest = Math.max(longest, length);
  }
  return { current, longest, activeDays: active.size };
}

/** How many of `dates` fall in the last seven days, today included. */
export function countThisWeek(dates: readonly string[], today: Date) {
  const from = dayKey(addDays(today, -6));
  const to = dayKey(today);
  return dates.filter((at) => {
    const key = dayKey(new Date(at));
    return key >= from && key <= to;
  }).length;
}
