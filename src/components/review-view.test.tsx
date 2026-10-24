import { afterAll, beforeAll, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { Window } from "happy-dom";
import { act } from "react";
import type { Root } from "react-dom/client";
import { Rating } from "ts-fsrs";

import { type Catalog, createCatalog } from "../lib/catalog";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
} from "../lib/learner-state";
import { type DashboardData, deriveDashboard } from "../lib/learner-views";
import { expectDefined } from "../test/expect-defined";

const browser = new Window();
const globals = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;
const originals = new Map(
  globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
);
const client = new QueryClient();
const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
});
let root: Root;
let host: HTMLDivElement;
let ReviewView: typeof import("./review-view")["ReviewView"];

const globalValue = (key: (typeof globals)[number]) => {
  if (key === "IS_REACT_ACT_ENVIRONMENT") {
    return true;
  }
  return key === "window" ? browser : browser[key];
};

beforeAll(async () => {
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: globalValue(key),
    });
  }
  const { createRoot } = await import("react-dom/client");
  ({ ReviewView } = await import("./review-view"));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterAll(async () => {
  await act(async () => root?.unmount());
  client.clear();
  await browser.happyDOM.close();
  for (const key of globals) {
    const original = originals.get(key);
    if (original) {
      Object.defineProperty(globalThis, key, original);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

const NEXT_REVIEWS = /next · \S/;

interface Course {
  catalog: Catalog;
  now: string;
  state: LearnerState;
}

function fixture(count = 1): Course {
  const sentences = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    hanzi: "你好。",
    pinyin: "Nǐ hǎo.",
    meaning: `Sentence ${index}`,
    words: ["你", "好"],
    anchor: "好",
    source: null,
  }));
  const catalog = createCatalog(
    { version: "test", characters: [], words: [] },
    sentences
  );
  const enrolledAt = "2026-09-01T02:00:00.000Z";
  const state = sentences.reduce(
    (next, item) =>
      applyOperation(
        next,
        {
          kind: "enroll",
          data: {
            itemType: "sentence",
            itemId: item.id,
            enrolledAt,
          },
        },
        catalog
      ),
    emptyLearnerState
  );
  return { catalog, state, now: enrolledAt };
}

const dashboard = (course: Course): DashboardData =>
  deriveDashboard(course.state, new Date(course.now), course.catalog);

async function show(course: Course, session: string) {
  await act(async () =>
    root.render(
      <RouterContextProvider router={router}>
        <QueryClientProvider client={client}>
          <ReviewView data={dashboard(course)} key={session} />
        </QueryClientProvider>
      </RouterContextProvider>
    )
  );
}

async function reveal() {
  const button = expectDefined(
    [...host.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("show answer")
    )
  );
  await act(() => button.click());
}

function rate(
  course: Course,
  id: string,
  rating: number,
  reviewedAt = "2026-09-23T02:00:00.000Z"
): Course {
  return {
    ...course,
    now: reviewedAt,
    state: applyOperation(
      course.state,
      {
        kind: "review",
        data: {
          itemType: "sentence",
          itemId: id,
          rating,
          reviewedAt,
          durationMs: 100,
        },
      },
      course.catalog
    ),
  };
}

/** The answer side is only filled in once the card has been flipped. */
const answerShown = () => host.querySelector(".dx-deck-back .dx-deck-answer");

test("a last missed card waits face down and returns unflipped instead of falsely completing the reviews", async () => {
  let data = fixture();
  await show(data, "miss");
  expect(answerShown()).toBeNull();
  await reveal();
  expect(answerShown()).not.toBeNull();
  data = rate(data, "s0", Rating.Again);
  await show(data, "miss");
  expect(host.querySelector('[data-state="waiting"]')?.textContent).toContain(
    "1 card"
  );
  expect(host.querySelector(".dx-deck-verdict")).toBeNull();
  expect(host.textContent).not.toContain("learn new characters");
  data = {
    ...data,
    state: structuredClone(data.state),
    now: "2026-09-23T02:01:00.000Z",
  };
  await show(data, "miss");
  expect(answerShown()).toBeNull();
  expect(host.textContent).toContain("show answer");
});

/** Rate each card Easy in turn, showing the session after every rating. */
async function rateEach(course: Course, ids: string[]): Promise<Course> {
  const [id, ...rest] = ids;
  if (!id) {
    return course;
  }
  const next = rate(course, id, Rating.Easy);
  await show(next, "all-due");
  return rateEach(next, rest);
}

test("all overdue cards remain in one session beyond twenty reviews", async () => {
  let data = fixture(26);
  await show(data, "all-due");
  expect(host.textContent).toContain("26 left");
  data = await rateEach(
    data,
    Array.from({ length: 20 }, (_, index) => `s${index}`)
  );
  expect(host.textContent).toContain("6 left");
  expect(host.textContent).toContain("Sentence 20");
  expect(host.querySelector(".dx-deck-verdict")).toBeNull();
  for (let index = 20; index < 26; index += 1) {
    data = rate(data, `s${index}`, Rating.Easy);
  }
  await show(data, "all-due");
  expect(host.querySelector(".dx-deck-verdict")?.textContent).toBe("done");
  expect(host.textContent).toContain("learn new characters");
  expect(host.querySelector(".dx-deck-card")).toBeNull();
});

test("a learning step becoming due does not replace the currently revealed card", async () => {
  let data = rate(fixture(2), "s0", Rating.Again);
  await show(data, "stable");
  expect(host.textContent).toContain("Sentence 1");
  await reveal();
  data = { ...data, now: "2026-09-23T02:01:00.000Z" };
  expect(dashboard(data).reviewQueue.map((item) => item.id)).toEqual([
    "s0",
    "s1",
  ]);
  await show(data, "stable");
  expect(host.textContent).toContain("Sentence 1");
  expect(answerShown()).not.toBeNull();
  data = rate(data, "s1", Rating.Easy, "2026-09-23T02:01:00.000Z");
  await show(data, "stable");
  expect(host.textContent).toContain("Sentence 0");
  expect(answerShown()).toBeNull();
});

test("no introduced material leads to learning rather than an invented review session", async () => {
  await show(fixture(0), "empty");
  expect(host.textContent).toContain("start with a lesson");
  expect(host.textContent).toContain("start your first lesson");
  expect(host.querySelector(".dx-deck-card")).toBeNull();
});

test("a finished review says when the next reviews come, not which cards were reviewed", async () => {
  let data = fixture();
  await show(data, "finished");
  await reveal();
  data = rate(data, "s0", Rating.Easy);
  await show(data, "finished");
  const slot = expectDefined(host.querySelector('[data-state="finished"]'));
  expect(slot.querySelector(".dx-deck-verdict")?.textContent).toBe("done");
  expect(slot.textContent).toMatch(NEXT_REVIEWS);
  expect(slot.textContent).not.toContain("你好");
});
