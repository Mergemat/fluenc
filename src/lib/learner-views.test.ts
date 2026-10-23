import { expect, test } from "bun:test";

import type { Word } from "../data/types";
import { createCatalog } from "./catalog";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressChange,
} from "./learner-state";
import { deriveDashboard, deriveLibrary, derivePalace } from "./learner-views";

const enroll = (
  itemType: "character" | "word" | "sentence",
  itemId: string,
  enrolledAt: string
): ProgressChange => ({
  kind: "enroll",
  data: { itemType, itemId, enrolledAt },
});

test("a device and the server derive the same queues however their cards are ordered", () => {
  const state = [
    enroll("sentence", "s02", "2026-09-01T02:00:00.000Z"),
    enroll("character", "我", "2026-09-01T02:00:00.000Z"),
    enroll("sentence", "s01", "2026-09-01T02:00:00.000Z"),
  ].reduce(
    (next, operation) => applyOperation(next, operation),
    emptyLearnerState
  );
  const reversed: LearnerState = {
    ...state,
    cards: Object.fromEntries(Object.entries(state.cards).reverse()),
  };
  const now = new Date("2026-09-02T00:00:00.000Z");
  expect(deriveDashboard(reversed, now)).toEqual(deriveDashboard(state, now));
  expect(
    deriveDashboard(state, now).reviewQueue.map((item) => item.id)
  ).toEqual(["我", "s01", "s02"]);
});

test("saved names reach the palace, the library and every lesson that uses them", () => {
  const state = [
    {
      kind: "movie",
      data: {
        characterId: "一",
        actorKey: "y",
        actorName: "Yara",
        finalKey: "ø",
        setName: "Garden",
        tone: 1,
        roomName: "",
        props: [{ component: "一", propName: "ruler" }],
      },
    },
    { kind: "livingLink", data: { wordId: "5", story: "we stand together" } },
  ].reduce(
    (next, operation) => applyOperation(next, operation as ProgressChange),
    emptyLearnerState
  );

  expect(derivePalace(state)).toMatchObject({
    actors: [{ key: "y", name: "Yara" }],
    sets: [{ key: "ø", name: "Garden" }],
    props: [{ key: "一", name: "ruler" }],
  });
  expect(derivePalace(state).rooms.find((room) => room.tone === 1)?.name).toBe(
    "Entrance hall"
  );
  expect(
    deriveLibrary(state).words.find((word) => word.id === "5")?.livingLink
  ).toBe("we stand together");
  const lesson = deriveDashboard(state, new Date()).buildQueue.find(
    (item) => item.id === "一"
  );
  expect(lesson?.type === "character" && lesson.movie).toMatchObject({
    actorName: "Yara",
    setName: "Garden",
    roomName: "Entrance hall",
    configured: true,
  });
});

test("enrolling twice or reviewing an unknown card leaves the state unchanged, like the server", () => {
  const once = applyOperation(
    emptyLearnerState,
    enroll("sentence", "s01", "2026-09-01T02:00:00.000Z")
  );
  expect(
    applyOperation(once, enroll("sentence", "s01", "2026-09-05T02:00:00.000Z"))
  ).toBe(once);
  expect(
    applyOperation(
      once,
      enroll("sentence", "missing", "2026-09-05T02:00:00.000Z")
    )
  ).toBe(once);
  expect(
    applyOperation(once, {
      kind: "review",
      data: {
        itemType: "sentence",
        itemId: "s02",
        rating: 3,
        durationMs: 0,
        reviewedAt: "2026-09-05T02:00:00.000Z",
      },
    })
  ).toBe(once);
});

test("a reviewed card keeps the moment it was introduced", () => {
  const enrolled = applyOperation(
    emptyLearnerState,
    enroll("sentence", "s01", "2026-09-01T02:00:00.000Z")
  );
  const reviewed = applyOperation(enrolled, {
    kind: "review",
    data: {
      itemType: "sentence",
      itemId: "s01",
      rating: 3,
      durationMs: 0,
      reviewedAt: "2026-09-05T02:00:00.000Z",
    },
  });
  expect(reviewed.cards["sentence:s01"]).toMatchObject({
    introducedAt: "2026-09-01T02:00:00.000Z",
    lastReview: "2026-09-05T02:00:00.000Z",
  });
});

test("reading offers the newest word's sentences first, and listening plays back read ones", () => {
  const word = (id: number, hanzi: string) =>
    ({ id, hanzi, rank: id, characterIds: [] }) as unknown as Word;
  const sentence = (id: string, hanzi: string, anchor: string) => ({
    id,
    hanzi,
    pinyin: "",
    meaning: id,
    words: Array.from(new Set(["我", anchor])),
    anchor,
    source: null,
  });
  const catalog = createCatalog(
    {
      version: "test",
      characters: [],
      words: [word(9001, "我"), word(9002, "吃饭"), word(9003, "喜欢")],
    },
    [
      sentence("about-eating", "我吃饭。", "吃饭"),
      sentence("about-liking", "我喜欢。", "喜欢"),
      sentence("about-me", "我。", "我"),
    ]
  );
  const state = [
    enroll("word", "9001", "2026-09-01T02:00:00.000Z"),
    enroll("word", "9002", "2026-09-02T02:00:00.000Z"),
    enroll("word", "9003", "2026-09-03T02:00:00.000Z"),
    enroll("sentence", "about-me", "2026-09-03T03:00:00.000Z"),
  ].reduce(
    (next, operation) => applyOperation(next, operation, catalog),
    emptyLearnerState
  );
  const dashboard = deriveDashboard(state, new Date(), catalog);
  expect(dashboard.getQueue.map((item) => item.id)).toEqual([
    "about-liking",
    "about-eating",
  ]);
});
