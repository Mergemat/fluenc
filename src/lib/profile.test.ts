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

function introduce(ids: string[], state = emptyLearnerState): LearnerState {
  return ids.reduce(
    (next, itemId, index) =>
      applyOperation(next, {
        kind: "enroll",
        data: { itemType: "character", itemId, enrolledAt: hour(index) },
      }),
    state
  );
}

const track = (state: LearnerState, id: string) => {
  const found = deriveProfile(state).tracks.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No ${id} track`);
  }
  return found;
};
const milestone = (state: LearnerState, key: string) =>
  deriveProfile(state)
    .tracks.flatMap((item) => item.milestones)
    .find((item) => item.key === key);

test("a character that is also a word divides both tracks by review state", () => {
  const state = introduce(["我", "你"]);
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

test("a milestone is dated by the introduction that reached it", () => {
  const ids = catalog.characters.slice(0, 12).map((item) => item.id);
  const state = introduce(ids);

  expect(milestone(state, "characters:10")).toMatchObject({
    reached: true,
    reachedAt: hour(9),
  });
  expect(milestone(state, "characters:50")).toMatchObject({
    reached: false,
    progress: 12,
    reachedAt: null,
  });
});

test("progress saved before dates were recorded still reaches its milestones", () => {
  const ids = catalog.characters.slice(0, 10).map((item) => item.id);
  const state = introduce(ids);
  const withoutDates = (count: number): LearnerState => ({
    ...state,
    cards: Object.fromEntries(
      Object.entries(state.cards).map(([key, card], index) => {
        const { introducedAt: _, ...undated } = card;
        return [key, index < count ? undated : card];
      })
    ),
  });

  expect(milestone(withoutDates(3), "characters:10")).toMatchObject({
    reached: true,
    reachedAt: hour(9),
  });
  expect(milestone(withoutDates(10), "characters:10")).toMatchObject({
    reached: true,
    reachedAt: null,
  });
  expect(deriveProfile(withoutDates(3)).since).toBe(hour(3));
});
