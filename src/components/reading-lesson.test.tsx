import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { act } from "react";
import type { Root } from "react-dom/client";

import { expectDefined } from "../test/expect-defined";

const spoken: string[] = [];
mock.module("../hooks/use-mandarin-speech", () => ({
  useMandarinSpeech: () => ({
    status: "idle",
    stop: () => undefined,
    speak: (text: string) => {
      spoken.push(text);
      return Promise.resolve(true);
    },
  }),
}));

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
let root: Root;
let host: HTMLDivElement;

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
  const { ReadingLesson } = await import("./reading-lesson");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <ReadingLesson
          item={{
            id: "s01",
            hanzi: "你好。",
            pinyin: "Nǐ hǎo.",
            meaning: "Hi.",
            words: ["你", "好"],
            anchor: "好",
            source: null,
            coverage: 1,
            missingWords: [],
            missingCharacters: [],
          }}
        />
      </QueryClientProvider>
    )
  );
});

afterAll(async () => {
  await act(async () => root?.unmount());
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

const button = (label: string) =>
  [...host.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label)
  );

test("a sentence joins review only after it has been shadowed three times", async () => {
  expect(button("add to review")).toBeUndefined();
  await act(() => expectDefined(button("check meaning")).click());

  const shadowOnce = async (rep: number) => {
    expect(button("add to review")).toBeUndefined();
    await act(async () => {
      expectDefined(button(`listen & repeat · ${rep}/5`)).click();
      await Promise.resolve();
    });
  };
  await shadowOnce(0);
  await shadowOnce(1);
  await shadowOnce(2);

  expect(spoken).toEqual(["你好。", "你好。", "你好。"]);
  expect(button("add to review")).toBeDefined();
  expect(button("listen & repeat · 3/5")).toBeDefined();
});
