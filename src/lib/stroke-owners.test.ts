import { expect, test } from "bun:test";

import { remapStrokeOwners } from "./stroke-owners";

const strokes: Record<string, number> = { 月: 4, 疋: 5, 日: 4, 止: 4, 一: 1 };
const strokesOf = (part: string) => strokes[part];

test("a stroke-file fragment hands its strokes to the prop that replaces it", () => {
  expect(
    remapStrokeOwners(
      ["𠂇", "𠂇", "⺝", "⺝", "⺝", "⺝"],
      ["𠂇", "月"],
      strokesOf
    )
  ).toEqual(["𠂇", "𠂇", "月", "月", "月", "月"]);
});

test("several new props share the loose strokes in writing order by stroke count", () => {
  const previous = ["日", "日", "日", "日", "𤴓", "𤴓", "𤴓", "𤴓", "𤴓"];
  expect(remapStrokeOwners(previous, ["日", "一", "止"], strokesOf)).toEqual([
    "日",
    "日",
    "日",
    "日",
    "一",
    "止",
    "止",
    "止",
    "止",
  ]);
});

test("a whole-shape lesson owns every stroke", () => {
  expect(remapStrokeOwners(["丿", "㇏"], ["人"], strokesOf)).toEqual([
    "人",
    "人",
  ]);
});

test("stroke counts that do not add up leave the owners undecided", () => {
  const previous = ["日", "日", "日", "日", "𤴓", "𤴓", "𤴓", "𤴓", "𤴓"];
  expect(remapStrokeOwners(previous, ["日", "一", "疋"], strokesOf)).toBeNull();
});

test("a prop that no longer draws anything cannot be invented", () => {
  expect(
    remapStrokeOwners(["日", "日", "日", "日"], ["日", "月"], strokesOf)
  ).toBeNull();
});
