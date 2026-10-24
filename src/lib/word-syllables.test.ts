import { expect, test } from "bun:test";

import { wordSyllables } from "./word-syllables";

test("splits a word reading into per-character syllables, keeping its tones", () => {
  expect(wordSyllables("这样", "zhèyàng")).toEqual(["zhè", "yàng"]);
  expect(wordSyllables("为什么", "wèishénme")).toEqual(["wèi", "shén", "me"]);
  expect(wordSyllables("东西", "dōngxi")).toEqual(["dōng", "xi"]);
  expect(wordSyllables("女儿", "nǚ’ér")).toEqual(["nǚ", "ér"]);
  expect(wordSyllables("哪儿", "nǎr")).toEqual(["nǎ", "r"]);
});

test("a character's own readings decide an otherwise ambiguous split", () => {
  // "xian" could be one syllable; 西安 has two characters, read xī and ān.
  expect(wordSyllables("西安", "xīān")).toEqual(["xī", "ān"]);
});

test("falls back when the reading does not line up with the characters", () => {
  expect(wordSyllables("这样", "zhèyàngle")).toBeNull();
  expect(wordSyllables("这样", "nàyàng")).toBeNull();
});
