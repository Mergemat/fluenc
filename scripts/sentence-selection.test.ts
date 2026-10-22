import { expect, test } from "bun:test";
import curriculumJson from "../src/data/curriculum.generated.json";
import authored from "../src/data/sentences.authored.json";
import type { Curriculum } from "../src/data/types";
import { findSentenceConflicts } from "./sentence-diversity";
import { type ReviewedSentences, selectSentences } from "./sentence-selection";

const curriculum = curriculumJson as Curriculum;
const he = {
  id: "t4874056",
  hanzi: "他什么都不知道。",
  pinyin: "Tā shénme dōu bù zhīdào.",
  meaning: "He knows nothing.",
  source: 4_874_056,
  review: {
    decision: "include" as const,
    reason:
      "Useful standalone example of 什么都不, with matching reading and translation.",
  },
};
const she = {
  ...he,
  id: "t4878797",
  hanzi: "她什么都不知道。",
  meaning: "She knows nothing.",
  source: 4_878_797,
};
function corpus(...sentences: ReviewedSentences["sentences"]) {
  return { version: 1, sentences };
}
function conflicts(first: string, second: string) {
  return findSentenceConflicts([
    { id: "a", hanzi: first },
    { id: "b", hanzi: second },
  ]);
}

test("flags pronoun swaps and small speaking-frame changes from the corpus", () => {
  expect(conflicts(he.hanzi, she.hanzi)).toEqual([
    { first: "a", second: "b", kind: "template" },
  ]);
  expect(conflicts("你想对我说什么？", "你想跟我说什么？")).toHaveLength(1);
  expect(conflicts("我不知道。", "我们不知道。")).toHaveLength(1);
  expect(conflicts("你必须马上行动。", "您必须马上行动。")).toHaveLength(1);
  expect(
    conflicts("欢迎回来。我们想你了!", "欢迎回来。我们想您了!")
  ).toHaveLength(1);
});

test("normalizes punctuation, width, and quantity changes without erasing lexical 一", () => {
  expect(conflicts("你知道吗？", " “你知道吗?” ")).toEqual([
    { first: "a", second: "b", kind: "exact" },
  ]);
  expect(conflicts("他有三个孩子。", "她有两个孩子。")).toHaveLength(1);
  expect(conflicts("他有３个孩子。", "她有2个孩子。")).toHaveLength(1);
  expect(conflicts("我们一定去。", "我们一起去。")).toEqual([]);
});

test("retains meaningful polarity, reference, and valid word reduplication distinctions", () => {
  expect(conflicts("你能让我看看吗？", "你能让我看吗？")).toEqual([]);
  expect(conflicts("人人都知道。", "人都知道。")).toEqual([]);
  expect(conflicts("我知道。", "我不知道。")).toEqual([]);
  expect(conflicts("他告诉他了。", "他告诉她了。")).toEqual([]);
});

test("pins only reviewed imports, preserving authored pinyin and calculating current anchors", () => {
  const selected = selectSentences(curriculum, authored, corpus(he));
  expect(
    selected
      .slice(0, authored.length)
      .map(({ id, hanzi, pinyin, meaning }) => ({ id, hanzi, pinyin, meaning }))
  ).toEqual(authored);
  expect(selected.at(-1)).toEqual({
    id: he.id,
    hanzi: he.hanzi,
    pinyin: he.pinyin,
    meaning: he.meaning,
    source: he.source,
    words: ["他", "什么", "都", "不", "知道"],
    anchor: "都",
  });
  expect(selected).toHaveLength(authored.length + 1);
});

test("requires an explicit quality review rather than admitting a recursive candidate by its shape", () => {
  const unreviewed = {
    id: "t765609",
    hanzi: "我知道你知道我知道。",
    pinyin: "Wǒ zhīdào nǐ zhīdào wǒ zhīdào.",
    meaning: "I know that you know that I know.",
    source: 765_609,
  };
  expect(() =>
    selectSentences(curriculum, [], { version: 1, sentences: [unreviewed] })
  ).toThrow();
  expect(() =>
    selectSentences(curriculum, [], {
      version: 1,
      sentences: [
        {
          ...he,
          hanzi: "我知道你知道我知道。",
          review: {
            decision: "exclude",
            reason: "Repetitive teaching content.",
          },
        },
      ],
    })
  ).toThrow();
});

test("keeps a reviewed neutral-tone reduplication instead of guessing its pinyin", () => {
  const look = {
    ...he,
    id: "t5558621",
    source: 5_558_621,
    hanzi: "你能让我看看吗？",
    pinyin: "Nǐ néng ràng wǒ kànkan ma?",
    meaning: "Could you let me take a look?",
    review: {
      decision: "include" as const,
      reason:
        "Natural standalone request with reviewed neutral-tone verb reduplication and matching English.",
    },
  };
  const selected = selectSentences(curriculum, [], corpus(look));
  expect(selected[0]?.pinyin).toBe("Nǐ néng ràng wǒ kànkan ma?");
  expect(selected[0]?.words).toContain("看看");
  expect(selected[0]?.anchor).toBe("看看");
});

test("rejects duplicate templates unless an explicit teaching contrast names the earlier sentence", () => {
  expect(() => selectSentences(curriculum, [], corpus(she, he))).toThrow(
    "t4874056 / t4878797 (template)"
  );
  const reviewedShe = {
    ...she,
    allowSimilarTo: [
      {
        id: he.id,
        reason: "Deliberate contrast in written gender for a focused exercise.",
      },
    ],
  };
  const selected = selectSentences(curriculum, [], corpus(reviewedShe, he));
  expect(selected.map((sentence) => sentence.id)).toEqual([he.id, she.id]);
  expect(selectSentences(curriculum, [], corpus(he, reviewedShe))).toEqual(
    selected
  );
  expect(() =>
    selectSentences(curriculum, [], corpus({ ...reviewedShe, hanzi: he.hanzi }))
  ).toThrow("Stale");
  expect(() =>
    selectSentences(
      curriculum,
      [],
      corpus(he, { ...reviewedShe, hanzi: `“${he.hanzi}”` })
    )
  ).toThrow("exact");
});

test("fails when the curriculum changes instead of silently dropping reviewed content", () => {
  const changed = {
    ...curriculum,
    characters: curriculum.characters.filter(
      (character) => character.hanzi !== "知"
    ),
  };
  expect(() => selectSentences(changed, [], corpus(he))).toThrow(
    "non-curriculum characters: 知"
  );
  const uncovered = {
    ...curriculum,
    words: curriculum.words.filter(
      (word) => !["知道", "知", "道", "不"].includes(word.hanzi)
    ),
  };
  expect(() => selectSentences(uncovered, [], corpus(he))).toThrow(
    "curriculum coverage bounds"
  );
});

test("rejects source identity loss and forged imported ids", () => {
  expect(() =>
    selectSentences(curriculum, [], corpus(he, { ...she, source: he.source }))
  ).toThrow("Duplicate Tatoeba source");
  expect(() =>
    selectSentences(curriculum, [], corpus({ ...he, id: "s11" }))
  ).toThrow("must match its Tatoeba source");
  expect(() =>
    selectSentences(
      curriculum,
      [{ id: he.id, hanzi: he.hanzi, pinyin: he.pinyin, meaning: he.meaning }],
      corpus()
    )
  ).toThrow("Authored sentence cannot use a Tatoeba id");
});
