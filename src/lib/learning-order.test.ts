import { expect, test } from "bun:test";

import { learningOrder } from "./learning-order";

test("a slightly rarer item the course uses everywhere comes before a frequent one it barely uses", () => {
  // Forty items whose usage falls with frequency, except 她 (rank 12, rarely used) and
  // 一 (rank 26, used everywhere).
  const items = Array.from({ length: 40 }, (_, index) => ({
    rank: index + 1,
    usage: 100 - index * 2,
  }));
  items[11] = { rank: 12, usage: 3 };
  items[25] = { rank: 26, usage: 500 };
  const order = learningOrder(items);
  expect(order[25]).toBeLessThan(order[11] ?? 0);
  expect(order[25]).toBeLessThan(26);
  expect(order[11]).toBeGreaterThan(12);
});

test("with equal usage, frequency decides", () => {
  expect(
    learningOrder([
      { rank: 30, usage: 5 },
      { rank: 10, usage: 5 },
      { rank: 20, usage: 5 },
    ])
  ).toEqual([3, 1, 2]);
});

test("frequency still matters: heavy use does not pull a rare item to the front", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    rank: index + 1,
    usage: 20 - index,
  }));
  items.push({ rank: 900, usage: 1000 });
  const order = learningOrder(items);
  expect(order.at(-1)).toBeGreaterThan(5);
  expect(order.at(-1)).toBeLessThan(items.length);
});
