import { expect, test } from "bun:test";

import { applyOperation, emptyLearnerState } from "./learner-state";
import { needsWelcome } from "./welcome";

const started = applyOperation(emptyLearnerState, {
  kind: "enroll",
  data: {
    itemType: "character",
    itemId: "好",
    enrolledAt: "2026-10-24T08:00:00.000Z",
  },
});

test("a new learner sees the reel until they watch or skip it", () => {
  expect(needsWelcome(emptyLearnerState, false)).toBe(true);
  expect(needsWelcome(emptyLearnerState, true)).toBe(false);
});

test("a learner whose progress arrived by sync never sees it, even on a new device", () => {
  expect(Object.keys(started.cards)).toEqual(["character:好"]);
  expect(needsWelcome(started, false)).toBe(false);
});
