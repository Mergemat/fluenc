import { expect, test } from "bun:test";

import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressOperation,
} from "./learner-state";
import { deriveDashboard, deriveLibrary, derivePalace } from "./learner-views";

const enroll = (
  itemType: "character" | "word" | "sentence",
  itemId: string,
  enrolledAt: string
): ProgressOperation => ({
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
    (next, operation) => applyOperation(next, operation as ProgressOperation),
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
        eventId: crypto.randomUUID(),
        itemType: "sentence",
        itemId: "s02",
        rating: 3,
        durationMs: 0,
        reviewedAt: "2026-09-05T02:00:00.000Z",
      },
    })
  ).toBe(once);
});
