// The screens and states ui-check compares. Selectors go by role, text and data attributes, never
// by class, so a scenario keeps working while the styling underneath it changes.
import type { Page } from "playwright-core";

import type { LearnerName } from "./learners";

export interface Viewport {
  height: number;
  name: string;
  touch: boolean;
  width: number;
}

export const viewports: Viewport[] = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "phone-short", width: 375, height: 640, touch: true },
  { name: "tablet", width: 834, height: 1112, touch: true },
  { name: "small-laptop", width: 980, height: 720, touch: false },
  { name: "laptop", width: 1280, height: 800, touch: false },
  { name: "desktop", width: 1600, height: 1000, touch: false },
];

export interface Scenario {
  act?: (page: Page, viewport: Viewport) => Promise<void>;
  /** Who is signed in: the seeded demo learner by default, or nobody. */
  learner?: LearnerName | null;
  name: string;
  path: string;
  /** Limit to these viewport names. */
  viewports?: string[];
  /** The first-run reel counts as seen unless false. */
  welcomeSeen?: boolean;
}

// Accessible names the scenarios click by.
const ANY_TEXT = /./;
const NEXT_SLIDE = /^(next|start learning)/;
const WORDS_WITH = /^Words with/;
const WRITE = /^Write /;
const MORE = /more$/;
const CREATE_ACCOUNT = /create an account/;
const LIBRARY = /library/;
const WORDS_CHIP = /^words/;

const DESKTOP = ["small-laptop", "laptop", "desktop"];
const SOME = ["phone", "phone-short", "small-laptop", "desktop"];

const pause = (ms = 400) => Bun.sleep(ms);

/** Answer review cards (Good) until the top card is of `type`. */
async function gradeUntil(page: Page, type: string) {
  for (let card = 0; card < 80; card += 1) {
    const deck = page.locator("[data-revealed][data-type]").first();
    // biome-ignore lint/performance/noAwaitInLoops: each card is answered after the one before.
    if ((await deck.getAttribute("data-type")) === type) {
      return;
    }
    await page.keyboard.press("Space");
    await pause(450);
    await page.keyboard.press("3");
    await pause(700);
  }
  throw new Error(`no ${type} card in the queue`);
}

/** Answer every card, so the deck is face down waiting for its learning steps. */
async function gradeAll(page: Page) {
  for (let card = 0; card < 120; card += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each card is answered after the one before.
    if (!(await page.getByRole("button", { name: "Show answer" }).count())) {
      return;
    }
    await page.keyboard.press("Space");
    await pause(450);
    await page.keyboard.press("3");
    await pause(650);
  }
}

const flip = async (page: Page) => {
  await page.keyboard.press("Space");
  await pause(700);
};

const welcomeSlide = (slide: number): Scenario => ({
  name: `welcome-${slide}`,
  path: "/welcome",
  learner: null,
  welcomeSeen: false,
  viewports: slide === 0 ? undefined : SOME,
  act: async (page) => {
    for (let step = 0; step < slide; step += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: slides advance one at a time.
      await page.getByRole("button", { name: NEXT_SLIDE }).click();
      await pause(150);
    }
    await pause(500);
  },
});

export const scenarios: Scenario[] = [
  // Pages as they open.
  { name: "today", path: "/today" },
  { name: "today-lesson-next", path: "/today", learner: "pair" },
  { name: "today-fresh", path: "/today", learner: null },
  { name: "lessons-word", path: "/lessons" },
  { name: "lessons-pair", path: "/lessons", learner: "pair" },
  { name: "lessons-dense", path: "/lessons", learner: "dense" },
  { name: "lessons-note", path: "/lessons", learner: "note" },
  { name: "lessons-first", path: "/lessons", learner: null },
  { name: "review", path: "/review" },
  { name: "review-empty", path: "/review", learner: null },
  { name: "reading", path: "/reading" },
  { name: "reading-empty", path: "/reading", learner: null },
  { name: "library", path: "/library" },
  { name: "library-fresh", path: "/library", learner: null },
  { name: "entry-character", path: "/library/characters/好" },
  {
    name: "entry-character-dense",
    path: "/library/characters/候",
    learner: "dense",
  },
  { name: "entry-character-note", path: "/library/characters/发" },
  { name: "entry-word", path: "/library/words/9" },
  { name: "entry-missing", path: "/library/words/no-such-word" },
  { name: "profile", path: "/profile" },
  { name: "profile-fresh", path: "/profile", learner: null },
  { name: "palace", path: "/profile/palace" },
  { name: "palace-props", path: "/profile/palace?tab=props", viewports: SOME },
  { name: "palace-areas", path: "/profile/palace?tab=areas", viewports: SOME },
  {
    name: "palace-sets-open",
    path: "/profile/palace?tab=sets&show=open",
    viewports: SOME,
  },
  {
    name: "palace-nothing",
    path: "/profile/palace?q=zzzz",
    viewports: ["phone", "laptop"],
  },
  {
    name: "palace-clue-unnamed",
    path: "/profile/palace?tab=props&show=open",
    learner: "note",
    viewports: SOME,
    act: async (page) => {
      await page.locator('a[href*="/profile/palace/props/"]').first().click();
      await pause(800);
    },
  },
  { name: "settings", path: "/settings" },
  { name: "settings-signed-out", path: "/settings", learner: null },
  { name: "account", path: "/account" },
  { name: "account-signed-out", path: "/account", learner: null },
  { name: "not-found", path: "/no-such-page" },

  // Study states.
  { name: "review-flipped", path: "/review", act: flip },
  {
    name: "review-word",
    path: "/review",
    viewports: SOME,
    act: (page) => gradeUntil(page, "word"),
  },
  {
    name: "review-word-flipped",
    path: "/review",
    viewports: SOME,
    act: async (page) => {
      await gradeUntil(page, "word");
      await flip(page);
    },
  },
  {
    name: "review-sentence",
    path: "/review",
    viewports: SOME,
    act: (page) => gradeUntil(page, "sentence"),
  },
  {
    name: "review-sentence-flipped",
    path: "/review",
    viewports: SOME,
    act: async (page) => {
      await gradeUntil(page, "sentence");
      await flip(page);
    },
  },
  {
    name: "review-waiting",
    path: "/review",
    learner: "pair",
    viewports: ["phone", "laptop"],
    act: gradeAll,
  },
  {
    name: "review-part-pinned",
    path: "/review",
    learner: "pair",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await flip(page);
      await page
        .getByRole("button", { pressed: false })
        .filter({ hasText: ANY_TEXT })
        .last()
        .click();
      await pause();
    },
  },
  { name: "reading-flipped", path: "/reading", act: flip },
  {
    name: "lessons-focused",
    path: "/lessons",
    learner: "dense",
    viewports: SOME,
    act: async (page) => {
      await page.getByRole("textbox").nth(3).focus();
      await pause();
    },
  },
  {
    name: "lessons-typed",
    path: "/lessons",
    learner: "note",
    viewports: SOME,
    act: async (page) => {
      await page.getByRole("textbox").first().fill("Yoda");
      await page.getByRole("textbox").nth(1).focus();
      await pause();
    },
  },
  {
    name: "lessons-note-open",
    path: "/lessons",
    learner: "note",
    viewports: SOME,
    act: async (page) => {
      await page.getByRole("button", { name: "How the parts fit" }).click();
      await pause();
    },
  },
  {
    name: "lessons-words-open",
    path: "/lessons",
    learner: "dense",
    viewports: SOME,
    act: async (page) => {
      await page.getByRole("button", { name: WORDS_WITH }).click();
      await pause();
    },
  },
  {
    name: "lessons-xray",
    path: "/lessons",
    learner: "dense",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.keyboard.press("x");
      await pause();
    },
  },
  {
    name: "lessons-writing",
    path: "/lessons",
    learner: "dense",
    viewports: SOME,
    act: async (page) => {
      await page.getByRole("button", { name: WRITE }).click();
      await page.getByRole("dialog").waitFor();
      await pause(800);
    },
  },
  {
    name: "lessons-writing-miss",
    path: "/lessons",
    learner: "pair",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.getByRole("button", { name: WRITE }).click();
      const pad = page.getByRole("dialog").locator("svg").first();
      await pad.waitFor();
      await pause(800);
      const box = await pad.boundingBox();
      if (box) {
        await page.mouse.move(
          box.x + box.width * 0.9,
          box.y + box.height * 0.9
        );
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width * 0.8,
          box.y + box.height * 0.95,
          { steps: 6 }
        );
        await page.mouse.up();
      }
      await pause(900);
    },
  },
  {
    name: "lessons-word-short-link",
    path: "/lessons",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.getByRole("textbox", { name: "Memory link" }).fill("ab");
      await pause();
    },
  },

  // Library and palace states.
  { name: "library-words", path: "/library?kind=words", viewports: SOME },
  { name: "library-sound", path: "/library?group=sound", viewports: SOME },
  {
    name: "library-learning",
    path: "/library?status=learning",
    viewports: SOME,
  },
  { name: "library-search", path: "/library?q=hao", viewports: SOME },
  {
    name: "library-nothing",
    path: "/library?q=zzzzzz",
    viewports: ["phone", "laptop"],
  },
  {
    name: "library-jump",
    path: "/library",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page
        .getByRole("navigation", { name: "Jump to section" })
        .getByRole("button")
        .nth(3)
        .click();
      await pause(600);
    },
  },
  {
    name: "entry-senses-open",
    path: "/library/characters/发",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.getByRole("button", { name: MORE }).click();
      await pause();
    },
  },
  {
    name: "entry-parts",
    path: "/library/characters/候",
    learner: "dense",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.getByRole("button", { name: "parts" }).click();
      await pause();
    },
  },
  {
    name: "palace-clue",
    path: "/profile/palace",
    viewports: SOME,
    act: async (page) => {
      await page.locator('a[href*="/profile/palace/cast/"]').first().click();
      await pause(800);
    },
  },
  {
    name: "palace-prop-clue",
    path: "/profile/palace?tab=props",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.locator('a[href*="/profile/palace/props/"]').first().click();
      await pause(800);
    },
  },
  {
    name: "palace-area-clue",
    path: "/profile/palace?tab=areas",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.locator('a[href*="/profile/palace/areas/"]').first().click();
      await pause(800);
    },
  },
  {
    name: "account-sign-up",
    path: "/account",
    learner: null,
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page.getByRole("button", { name: CREATE_ACCOUNT }).click();
      await page.getByRole("textbox", { name: "email" }).focus();
      await pause();
    },
  },
  {
    name: "account-error",
    path: "/account",
    learner: null,
    viewports: ["phone", "laptop"],
    act: async (page) => {
      await page
        .getByRole("textbox", { name: "email" })
        .fill("nobody@example.com");
      await page.getByLabel("password").fill("wrong-password");
      await page.getByRole("button", { name: "sign in", exact: true }).click();
      await page.getByRole("alert").waitFor();
      await pause();
    },
  },
  {
    name: "toast",
    path: "/lessons",
    learner: "pair",
    viewports: ["phone", "laptop"],
    act: async (page) => {
      for (const box of await page.getByRole("textbox").all()) {
        // biome-ignore lint/performance/noAwaitInLoops: fields are filled one at a time.
        if (!(await box.inputValue())) {
          await box.fill("a name");
        }
      }
      await page.getByRole("textbox").first().focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("status")
        .filter({ hasText: "added to reviews" })
        .waitFor();
      await pause(300);
    },
  },

  // Pointer and keyboard states.
  {
    name: "hover-nav",
    path: "/today",
    viewports: DESKTOP,
    act: async (page) => {
      await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: LIBRARY })
        .hover();
      await pause();
    },
  },
  {
    name: "hover-later",
    path: "/today",
    viewports: ["laptop"],
    act: async (page) => {
      await page.getByRole("link", { name: "Read", exact: true }).hover();
      await pause();
    },
  },
  {
    name: "hover-tile",
    path: "/library?status=new",
    viewports: ["laptop"],
    act: async (page) => {
      await page.locator('a[href*="/library/characters/"]').nth(2).hover();
      await pause();
    },
  },
  {
    name: "hover-palace-row",
    path: "/profile/palace",
    viewports: ["laptop"],
    act: async (page) => {
      await page.locator('a[href*="/profile/palace/cast/"]').nth(1).hover();
      await pause();
    },
  },
  {
    name: "hover-card",
    path: "/review",
    viewports: ["laptop"],
    act: async (page) => {
      await page
        .getByRole("button", { name: "Show answer", exact: true })
        .first()
        .hover();
      await pause();
    },
  },
  {
    name: "hover-chip",
    path: "/library",
    viewports: ["laptop"],
    act: async (page) => {
      await page.getByRole("button", { name: WORDS_CHIP }).hover();
      await pause();
    },
  },
  {
    name: "focus-ring",
    path: "/today",
    viewports: ["laptop"],
    act: async (page) => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await pause();
    },
  },

  // The first-run reel, slide by slide.
  ...[0, 1, 2, 3, 4, 5].map(welcomeSlide),
];
