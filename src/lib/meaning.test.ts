import { expect, test } from "bun:test";

import { getItemMeaning } from "./meaning";

test("other senses leave out the keyword, however it is phrased, and repeats", () => {
  const meaning = getItemMeaning({
    keyword: "know",
    also: null,
    senses: ["to know", "to be aware", " To be aware! ", "know?", ""],
  });
  expect(meaning.alternatives).toEqual(["to be aware"]);
  expect(meaning.summary).toBe("know");
});

test("the second cue joins the summary only when it says something new", () => {
  expect(
    getItemMeaning({ meaning: "friend", also: "to be friends", senses: [] })
      .summary
  ).toBe("friend; to be friends");
  expect(
    getItemMeaning({ meaning: "to have", also: "have.", senses: [] }).also
  ).toBeNull();
});
