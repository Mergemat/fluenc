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
      candidate.textContent?.includes("Reveal answer")
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
          eventId: crypto.randomUUID(),
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

test("a last missed card waits and returns concealed instead of falsely completing the reviews", async () => {
  let data = fixture();
  await show(data, "miss");
  await reveal();
  expect(host.querySelector(".sentence-answer")?.closest("[inert]")).toBeNull();
  data = rate(data, "s0", Rating.Again);
  await show(data, "miss");
  expect(host.textContent).toContain("1 card still needs practice");
  expect(host.textContent).not.toContain("reviews finished");
  expect(host.textContent).not.toContain("learn new characters");
  data = {
    ...data,
    state: structuredClone(data.state),
    now: "2026-09-23T02:01:00.000Z",
  };
  await show(data, "miss");
  expect(
    host.querySelector(".sentence-answer")?.closest("[inert]")
  ).not.toBeNull();
  expect(host.textContent).toContain("Reveal answer");
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
  expect(host.textContent).toContain("26 ready");
  data = await rateEach(
    data,
    Array.from({ length: 20 }, (_, index) => `s${index}`)
  );
  expect(host.textContent).toContain("6 ready");
  expect(host.textContent).toContain("Sentence 20");
  expect(host.textContent).not.toContain("reviews finished");
  for (let index = 20; index < 26; index += 1) {
    data = rate(data, `s${index}`, Rating.Easy);
  }
  await show(data, "all-due");
  expect(host.textContent).toContain("reviews finished");
  expect(host.textContent).toContain("learn new characters");
  // Every sentence is already in reviews, so there is nothing new to read.
  expect(dashboard(data).getQueue).toHaveLength(0);
  expect(host.querySelector('a[href="/reading"]')).toBeNull();
  expect(host.querySelector(".recall-frame")).toBeNull();
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
  expect(host.querySelector(".sentence-answer")?.closest("[inert]")).toBeNull();
  data = rate(data, "s1", Rating.Easy, "2026-09-23T02:01:00.000Z");
  await show(data, "stable");
  expect(host.textContent).toContain("Sentence 0");
  expect(
    host.querySelector(".sentence-answer")?.closest("[inert]")
  ).not.toBeNull();
});

test("no introduced material leads to learning rather than an invented review session", async () => {
  await show(fixture(0), "empty");
  expect(host.textContent).toContain("start with a lesson");
  expect(host.textContent).toContain("start your first lesson");
  expect(host.querySelector(".recall-frame")).toBeNull();
});
