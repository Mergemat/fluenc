import { expect, test } from "bun:test";

import type { FocusEntry } from "../data/types";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressChange,
} from "./learner-state";
import { deriveDashboard, deriveLibrary } from "./learner-views";

const now = new Date("2026-10-14T08:00:00.000Z");

const entry = (
  kind: FocusEntry["kind"],
  hanzi: string,
  pinyin: string,
  meaning: string,
  addedAt = "2026-10-13T18:00:00.000Z"
): FocusEntry => ({
  kind,
  hanzi,
  pinyin,
  meaning,
  label: "HSK 1 · Lesson 3",
  addedAt,
});

const learnAt = (
  enrolledAt: string,
  state: LearnerState,
  itemType: "character" | "word" | "sentence",
  ...ids: string[]
) =>
  ids.reduce(
    (next, itemId) =>
      applyOperation(next, {
        kind: "enroll",
        data: { itemType, itemId, enrolledAt },
      } satisfies ProgressChange),
    state
  );
const learn = (
  state: LearnerState,
  itemType: "character" | "word" | "sentence",
  ...ids: string[]
) => learnAt(now.toISOString(), state, itemType, ...ids);

const build = (state: LearnerState) =>
  deriveDashboard(state, now).buildQueue.map((item) => item.hanzi);

test("a focus word's characters come before the usual first lessons, then the word itself", () => {
  const state = {
    ...emptyLearnerState,
    focus: [entry("word", "名字", "míngzi", "name")],
  };
  expect(build(emptyLearnerState).slice(0, 2)).not.toContain("名");
  expect(build(state).slice(0, 2).toSorted()).toEqual(["名", "字"].toSorted());
  expect(deriveDashboard(state, now).buildQueue[0]?.focus).toBe(
    "HSK 1 · Lesson 3"
  );

  // Another word is ready too, but the focus word is taught first.
  const known = learn(state, "character", "名", "字", "我", "们");
  expect(build(known)[0]).toBe("名字");
  expect(build(known)).toContain("我们");
});

test("focus is taught in the order it was added", () => {
  const state = {
    ...emptyLearnerState,
    focus: [
      entry("word", "老师", "lǎoshī", "teacher", "2026-10-13T18:00:00.000Z"),
      entry("word", "学生", "xuésheng", "student", "2026-10-13T18:00:00.001Z"),
    ],
  };
  const queue = build(state);
  const lastTeacherPart = Math.max(queue.indexOf("老"), queue.indexOf("师"));
  const firstStudentPart = Math.min(queue.indexOf("学"), queue.indexOf("生"));
  expect(lastTeacherPart).toBeLessThan(firstStudentPart);
});

test("a word missing from the course becomes the learner's own word when its characters are in it", () => {
  const state = {
    ...emptyLearnerState,
    // The server splits the pinyin per character before a device sees the entry.
    focus: [
      {
        ...entry("word", "中国", "zhōngguó", "China"),
        syllables: ["zhōng", "guó"],
      },
    ],
  };
  expect(build(state).slice(0, 2).toSorted()).toEqual(["中", "国"].toSorted());

  const known = learn(state, "character", "中", "国");
  const [lesson] = deriveDashboard(known, now).buildQueue;
  expect(lesson).toMatchObject({
    type: "word",
    id: "中国",
    meaning: "China",
    syllables: ["zhōng", "guó"],
  });

  const learned = learn(known, "word", "中国");
  expect(learned.cards["word:中国"]).toBeDefined();
  expect(build(learned)).not.toContain("中国");
  expect(
    deriveLibrary(learned).words.find((word) => word.id === "中国")?.status
  ).toBe("learning");
});

test("an entry with a character the course lacks is left out", () => {
  const state = {
    ...emptyLearnerState,
    focus: [
      entry("word", "北京", "běijīng", "Beijing"),
      entry(
        "sentence",
        "我是北京人。",
        "wǒ shì běijīng rén.",
        "I'm from Beijing."
      ),
    ],
  };
  expect(build(state)).toEqual(build(emptyLearnerState));
  expect(deriveLibrary(state).words.some((word) => word.hanzi === "北京")).toBe(
    false
  );
  expect(learn(state, "word", "北京")).toBe(state);
});

test("a focus sentence is read before sentences for a newer word", () => {
  const sentence = "你叫什么名字？";
  const state = {
    ...emptyLearnerState,
    focus: [
      entry(
        "sentence",
        sentence,
        "Nǐ jiào shénme míngzi?",
        "What's your name?"
      ),
    ],
  };
  const reading = (next: LearnerState) =>
    deriveDashboard(next, now).getQueue.map((item) => item.hanzi);
  expect(reading(state)).not.toContain(sentence);

  const earlier = "2026-10-01T08:00:00.000Z";
  const known = learn(
    learnAt(
      earlier,
      learnAt(
        earlier,
        state,
        "character",
        "你",
        "叫",
        "什",
        "么",
        "名",
        "字",
        "我",
        "是"
      ),
      "word",
      "9",
      "183"
    ),
    // Learned since, so its sentences would otherwise be read first.
    "character",
    "不"
  );
  expect(reading(known).slice(0, 2)).toEqual([sentence, "你不是我。"]);

  const read = learn(known, "sentence", sentence);
  expect(reading(read)).not.toContain(sentence);
  expect(
    deriveDashboard(read, now).listenQueue.map((item) => item.hanzi)
  ).toContain(sentence);
});
