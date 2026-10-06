import { expect, test } from "bun:test";

import { wordSyllables } from "./word-syllables";

test("splits a word reading into per-character syllables, keeping curriculum tones", () => {
  expect(wordSyllables("这样", "zhèyàng")).toEqual(["zhè", "yàng"]);
  expect(wordSyllables("为什么", "wèishénme")).toEqual(["wèi", "shén", "me"]);
  expect(wordSyllables("东西", "dōngxi")).toEqual(["dōng", "xi"]);
  expect(wordSyllables("女儿", "nǚ’ér")).toEqual(["nǚ", "ér"]);
});

test("falls back when the reading does not line up with the characters", () => {
  expect(wordSyllables("这样", "zhèyàngle")).toBeNull();
  expect(wordSyllables("这样", "nàyàng")).toBeNull();
});
