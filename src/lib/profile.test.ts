import { expect, test } from "bun:test";
import { State } from "ts-fsrs";

import { catalog } from "./catalog";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
} from "./learner-state";
import { deriveProfile } from "./profile";

const hour = (index: number) =>
  new Date(Date.UTC(2026, 8, 1, index)).toISOString();

function introduce(
  items: { itemType: "character" | "word" | "sentence"; itemId: string }[]
): LearnerState {
  return items.reduce(
    (next, item, index) =>
      applyOperation(next, {
        kind: "enroll",
        data: { ...item, enrolledAt: hour(index) },
      }),
    emptyLearnerState
  );
}

const track = (state: LearnerState, id: string) => {
  const found = deriveProfile(state).tracks.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No ${id} track`);
  }
  return found;
};

const twoCharacterWord = catalog.uniqueWords.find(
  (word) => word.characterIds.length === 2
);

test("a character that is also a word divides both tracks by review state", () => {
  const state = introduce([
    { itemType: "character", itemId: "我" },
    { itemType: "character", itemId: "你" },
  ]);
  const remembered: LearnerState = {
    ...state,
    cards: {
      ...state.cards,
      "character:我": { ...state.cards["character:我"], state: State.Review },
    },
  };

  expect(track(remembered, "characters")).toMatchObject({
    learned: 1,
    learning: 1,
  });
  expect(track(remembered, "words")).toMatchObject({ learned: 1, learning: 1 });
});

test("a single-character word is met when its character is", () => {
  const state = introduce([
    { itemType: "character", itemId: "我" },
    { itemType: "word", itemId: String(twoCharacterWord?.id) },
  ]);

  expect(track(state, "characters").introducedAt).toEqual([hour(0)]);
  expect(track(state, "words").introducedAt.toSorted()).toEqual([
    hour(0),
    hour(1),
  ]);
  expect(deriveProfile(state).introductions).toHaveLength(2);
});

test("progress saved before dates were recorded counts but has no dates", () => {
  const state = introduce([{ itemType: "character", itemId: "我" }]);
  const { introducedAt: _, ...undated } = state.cards["character:我"];
  const legacy = {
    ...state,
    cards: { "character:我": undated },
  } as LearnerState;

  expect(track(legacy, "characters")).toMatchObject({
    learning: 1,
    introducedAt: [],
  });
  expect(deriveProfile(legacy).introductions).toEqual([]);
});
