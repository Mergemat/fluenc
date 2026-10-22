import { expect, test } from "bun:test";

import curriculum from "../data/curriculum.generated.json";
import dictionary from "../data/dictionary.source.json";
import secondaryMeanings from "../data/secondary-meanings.reviewed.json";
import { expectDefined } from "../test/expect-defined";
import { samePronunciation } from "./curriculum-readings";
import { getItemMeaning } from "./meaning";

const character = (hanzi: string) =>
  expectDefined(curriculum.characters.find((item) => item.hanzi === hanzi));
const word = (hanzi: string) =>
  expectDefined(curriculum.words.find((item) => item.hanzi === hanzi));

test("pronunciation, spelling, antonym and noun-classifier notes are not translations", () => {
  for (const hanzi of ["谁", "誰", "血", "年", "马", "蠢"]) {
    const meaning = getItemMeaning(character(hanzi));
    expect(meaning.also).toBeNull();
    expect(meaning.alternatives).toEqual(
      hanzi === "马"
        ? ["horse or cavalry piece in Chinese chess", "knight in Western chess"]
        : []
    );
    expect(meaning.summary).toBe(character(hanzi).keyword);
  }
  expect(getItemMeaning(character("明")).alternatives).not.toContain(
    "opposite: dark 暗[an4]"
  );
  expect(getItemMeaning(word("干吗")).alternatives).not.toContain(
    "variant of 幹嘛|干嘛[gan4 ma2]"
  );
  expect(getItemMeaning(word("干嘛")).also).toBe("what are you doing?");
  expect(getItemMeaning(word("朋友")).alternatives).toEqual([]);
});

test("punctuation and infinitive prefixes cannot create extra senses", () => {
  for (const hanzi of ["为什么", "哪里", "闭嘴", "失去", "写"]) {
    const meaning = getItemMeaning(word(hanzi));
    expect(meaning.also).toBeNull();
    expect(meaning.summary).toBe(word(hanzi).meaning);
  }
  expect(getItemMeaning(character("知")).alternatives).toEqual(["to be aware"]);
  expect(getItemMeaning(character("是")).also).toBe("correct");
  expect(getItemMeaning(character("有")).also).toBe("there is");
  expect(getItemMeaning(word("什么")).also).toBe("something");
});

test("compact senses are reviewed choices, independent of dictionary order", () => {
  for (const [item, expected] of [
    [character("找"), "to give change"],
    [character("借"), "to lend (with 给 or 出)"],
    [word("个人"), "an individual"],
    [word("先生"), "husband"],
    [word("容易"), "likely"],
    [word("从来"), "never (with a negative)"],
  ] as const) {
    expect(getItemMeaning(item).also).toBe(expected);
    expect(
      getItemMeaning({
        ...item,
        dictionaryMeanings: [...item.dictionaryMeanings].reverse(),
      }).also
    ).toBe(expected);
  }
});

test("dictionary senses retain usage, domain and pronunciation restrictions", () => {
  const nested =
    "we or us (including both the speaker and the person(s) spoken to)";
  expect(getItemMeaning(word("咱们")).alternatives).toContain(nested);
  expect(getItemMeaning(word("咱们")).also).toBeNull();
  expect(getItemMeaning(character("听")).alternatives).toContain(
    "to let be; to allow (Taiwan pr. [ting4])"
  );
  expect(getItemMeaning(character("听")).also).toBe("to heed");
  expect(getItemMeaning(character("本")).alternatives).toContain(
    "classifier for books, periodicals, files etc"
  );
  expect(getItemMeaning(word("黑体")).also).toBe("black body (physics)");
});

test("reviewed cues require the matching pronunciation and exact sense evidence", () => {
  expect(getItemMeaning(character("喂")).also).toBe("to feed");
  expect(getItemMeaning(word("喂")).also).toBeNull();
  expect(getItemMeaning(word("长")).also).toBe("chief");
  expect(getItemMeaning(character("长")).also).toBeNull();
  expect(
    getItemMeaning({ ...word("个人"), dictionaryMeanings: [] }).also
  ).toBeNull();
  expect(getItemMeaning({ ...word("个人"), pinyin: "gérén" }).also).toBeNull();
  expect(
    getItemMeaning({
      hanzi: "新词",
      pinyin: "xīncí",
      meaning: "new word",
      dictionaryMeanings: ["also pr. [xin1ci5]", "unreviewed gloss"],
    }).also
  ).toBeNull();
});

test("duplicate dictionary entries do not repeat in Library details", () => {
  expect(
    getItemMeaning({
      ...character("知"),
      dictionaryMeanings: ["to know", "to be aware", " To be aware! ", "know?"],
    }).alternatives
  ).toEqual(["to be aware"]);
});

test("every reviewed alternate has evidence under its own spelling and pronunciation", () => {
  const identities = new Set<string>();
  const items = [...curriculum.characters, ...curriculum.words];
  const readings = dictionary.entries as Record<
    string,
    { pinyin: string; senses: string[] }[]
  >;
  for (const review of secondaryMeanings) {
    const identity = `${review.hanzi}:${review.pinyin}`;
    expect(identities.has(identity), identity).toBeFalse();
    identities.add(identity);
    expect(
      items.some(
        (item) =>
          item.hanzi === review.hanzi &&
          item.pinyin === review.pinyin &&
          item.dictionaryMeanings.includes(review.sourceSense)
      ),
      identity
    ).toBeTrue();
    expect(
      readings[review.hanzi]?.some(
        (reading) =>
          samePronunciation(review.pinyin, reading.pinyin) &&
          reading.senses.includes(review.sourceSense)
      ),
      identity
    ).toBeTrue();
  }
});
