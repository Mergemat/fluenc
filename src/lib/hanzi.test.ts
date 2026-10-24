import { expect, test } from "bun:test";

import { groupHanziComponents } from "./hanzi";

test("a repeated prop is listed once with its count, in first-seen order", () => {
  expect(groupHanziComponents(["木", "日", "木"])).toEqual([
    { hanzi: "木", count: 2 },
    { hanzi: "日", count: 1 },
  ]);
});
