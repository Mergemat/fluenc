import { expect, test } from "bun:test";

import { segmentSentence } from "./sentence-words";

const words = new Set(["我", "我们", "喜欢", "中国", "中国人", "你"]);

test("takes the longest curriculum word at each point", () => {
  expect(segmentSentence("我们喜欢中国人。", words)).toEqual([
    { text: "我们", word: true },
    { text: "喜欢", word: true },
    { text: "中国人", word: true },
  ]);
});

test("leaves uncovered hanzi as single characters and drops punctuation", () => {
  expect(segmentSentence("“你好吗？”我说。", words)).toEqual([
    { text: "你", word: true },
    { text: "好", word: false },
    { text: "吗", word: false },
    { text: "我", word: true },
    { text: "说", word: false },
  ]);
});
