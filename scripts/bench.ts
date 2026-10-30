// How fast fluenc feels on a phone: the production build in Chromium with a 4× slower CPU, a learner
// three months into the course, and no server.
//
//   bun run bench              build, then measure
//   bun run bench --no-build   measure the last build
//   bun run bench --runs 5     more runs, steadier medians
//   bun run bench --profile    an unminified build, and where each phase spends its time
//
// Bytes are as the CDN sends them: the preview server compresses like Vercel does.
//
// Each run starts from a fresh browser profile, so startup is a first open with the learner's
// progress already on the device. Interactions are timed with the Event Timing API: from input to
// the next frame painted, like INP.
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { brotliCompressSync } from "node:zlib";
import {
  type Browser,
  type CDPSession,
  chromium,
  type Page,
} from "playwright-core";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressChange,
  type ProgressOperation,
} from "../src/lib/learner-state";
import { deriveDashboard } from "../src/lib/learner-views";
import { allRows } from "../src/progress/rows";

const { values } = parseArgs({
  options: {
    "no-build": { type: "boolean", default: false },
    runs: { type: "string", default: "3" },
    port: { type: "string", default: "4173" },
    json: { type: "string" },
    profile: { type: "boolean", default: false },
  },
});
const RUNS = Number(values.runs);
const PORT = Number(values.port);
const ORIGIN = `http://localhost:${PORT}`;
const CPU_SLOWDOWN = 4;
const REVIEWS = 25;
const DAY_MS = 86_400_000;
const CHROMIUM =
  process.env.BENCH_CHROMIUM ??
  join(
    homedir(),
    "Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
  );

/** A learner who has studied every day for three months, as `bun run db:seed` does for two weeks. */
function learner(): LearnerState {
  let state = emptyLearnerState;
  let count = 0;
  const record = (at: Date, change: ProgressChange) => {
    count += 1;
    const operation: ProgressOperation = {
      id: `bench-${count}`,
      at: at.toISOString(),
      ...change,
    };
    state = applyOperation(state, operation);
  };
  const rating = (index: number) => {
    const roll = index % 20;
    if (roll < 2) {
      return 1;
    }
    return roll > 17 ? 4 : 3;
  };
  const now = Date.now();
  for (let daysAgo = 90; daysAgo > 0; daysAgo -= 1) {
    const day = now - daysAgo * DAY_MS;
    let minute = 0;
    const tick = (minutes = 1) => {
      minute += minutes;
      return new Date(day + minute * 60_000);
    };
    // Leave the last day's reviews for the benchmark to answer.
    if (daysAgo > 1) {
      for (const item of deriveDashboard(state, new Date(day)).reviewQueue) {
        const at = tick();
        record(at, {
          kind: "review",
          data: {
            itemType: item.type,
            itemId: item.id,
            rating: rating(count),
            durationMs: 4000,
            reviewedAt: at.toISOString(),
          },
        });
      }
    }
    for (let taught = 0; taught < 12; taught += 1) {
      const [next] = deriveDashboard(state, new Date(day)).buildQueue;
      if (!next) {
        break;
      }
      if (next.type === "character") {
        const { movie } = next;
        record(tick(), {
          kind: "movie",
          data: {
            characterId: next.id,
            actorKey: movie.actorKey,
            actorName: `actor ${movie.actorKey}`,
            finalKey: movie.finalKey,
            setName: `set ${movie.finalKey}`,
            tone: movie.tone,
            roomName: movie.roomName,
            props: movie.components.map(({ hanzi }) => ({
              component: hanzi,
              propName: `prop ${hanzi}`,
            })),
          },
        });
      }
      const enrolledAt = tick();
      record(enrolledAt, {
        kind: "enroll",
        data: {
          itemType: next.type,
          itemId: next.id,
          enrolledAt: enrolledAt.toISOString(),
        },
      });
    }
    const sentence = deriveDashboard(state, new Date(day)).getQueue.find(
      (item) => item.coverage === 1
    );
    if (sentence) {
      const enrolledAt = tick();
      record(enrolledAt, {
        kind: "enroll",
        data: {
          itemType: "sentence",
          itemId: sentence.id,
          enrolledAt: enrolledAt.toISOString(),
        },
      });
    }
  }
  return state;
}

/** Put progress on the device the way the app stores it, before the app first opens. */
async function seed(page: Page, rows: ReturnType<typeof allRows>) {
  // A file from the app's origin that does not start the app.
  await page.goto(`${ORIGIN}/manifest.webmanifest`);
  await page.evaluate(async (stored) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fluenc", 2);
      request.onupgradeneeded = () => {
        const next = request.result;
        next.createObjectStore("meta");
        next.createObjectStore("queue", {
          keyPath: "sequence",
          autoIncrement: true,
        });
        next.createObjectStore("base");
        next.createObjectStore("state");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["base", "state"], "readwrite");
    for (const { table, key, row } of stored) {
      transaction.objectStore("base").put(row, [table, key]);
      transaction.objectStore("state").put(row, [table, key]);
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    localStorage.setItem("fluenc-welcome-seen", "1");
  }, rows);
}

// Collected in the page from its first script: long tasks and interaction timings.
const observe = () => {
  const perf = {
    longTasks: [] as { start: number; duration: number }[],
    events: [] as {
      name: string;
      id: number;
      start: number;
      duration: number;
    }[],
  };
  Object.assign(window, { __bench: perf });
  // Every file the session loads, not the first 250.
  performance.setResourceTimingBufferSize(10_000);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      perf.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }
  }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.interactionId) {
        perf.events.push({
          name: entry.name,
          id: entry.interactionId,
          start: entry.startTime,
          duration: entry.duration,
        });
      }
    }
    // The shortest threshold the API takes; anything faster is not worth reporting.
  }).observe({
    type: "event",
    durationThreshold: 16,
    buffered: true,
  } as PerformanceObserverInit);
};

interface Perf {
  events: { name: string; id: number; start: number; duration: number }[];
  longTasks: { start: number; duration: number }[];
}

const readPerf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __bench: Perf }).__bench);

/** Total blocking time between two moments: what long tasks held the main thread past 50 ms. */
const blocking = (perf: Perf, from: number, to = Number.POSITIVE_INFINITY) =>
  perf.longTasks
    .filter((task) => task.start >= from && task.start < to)
    .reduce((total, task) => total + Math.max(0, task.duration - 50), 0);

/** The slowest event of each interaction after `from`, in ms. */
function interactions(perf: Perf, from: number, to = Number.POSITIVE_INFINITY) {
  const byId = new Map<number, number>();
  for (const event of perf.events) {
    if (event.start >= from && event.start < to) {
      byId.set(event.id, Math.max(byId.get(event.id) ?? 0, event.duration));
    }
  }
  return [...byId.values()];
}

const now = (page: Page) => page.evaluate(() => performance.now());

const COURSE_DATA = /^\/assets\/(curriculum|sentences)-/;

/** What a download is for, by where it comes from. */
function kindOf(url: string) {
  const { pathname } = new URL(url);
  if (pathname.startsWith("/offline/")) {
    return "offline packs";
  }
  if (pathname.startsWith("/strokes/") || pathname.startsWith("/audio/")) {
    return "strokes and audio";
  }
  if (COURSE_DATA.test(pathname)) {
    return "course data";
  }
  if (pathname.endsWith(".js")) {
    return "code";
  }
  if (pathname.endsWith(".css")) {
    return "css";
  }
  if (pathname.endsWith(".woff2")) {
    return "fonts";
  }
  return "other";
}

/** KB downloaded before `until`, compressed as sent, by kind. */
async function downloads(page: Page, until = Number.POSITIVE_INFINITY) {
  const files = await page.evaluate(() =>
    [
      ...performance.getEntriesByType("navigation"),
      ...performance.getEntriesByType("resource"),
    ].map((entry) => ({
      url: entry.name,
      start: entry.startTime,
      bytes: (entry as PerformanceResourceTiming).encodedBodySize,
    }))
  );
  const kb: Record<string, number> = {};
  for (const file of files) {
    if (file.start < until) {
      const kind = kindOf(file.url);
      kb[kind] = (kb[kind] ?? 0) + file.bytes / 1024;
    }
  }
  return kb;
}

/** MB of JavaScript heap in use. */
async function heap(cdp: CDPSession) {
  await cdp.send("Performance.enable");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const used = metrics.find((metric) => metric.name === "JSHeapUsedSize");
  return (used?.value ?? 0) / 1024 / 1024;
}

interface ProfileNode {
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
  id: number;
}

const frameName = (frame: ProfileNode["callFrame"]) =>
  `${frame.functionName || "(anonymous)"} ${frame.url.split("/").at(-1)?.split("-")[0] ?? ""}:${frame.lineNumber + 1}`;

const addTime = (times: Map<string, number>, name: string, ms: number) =>
  times.set(name, (times.get(name) ?? 0) + ms);

/** The functions a phase spent the most time in, itself and below, from a CPU profile. */
function hottest(profile: {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
}) {
  const parent = new Map<number, number>();
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parent.set(child, node.id);
    }
  }
  const total = new Map<string, number>();
  const self = new Map<string, number>();
  for (const [index, sample] of profile.samples.entries()) {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    const leaf = byId.get(sample)?.callFrame;
    if (leaf) {
      addTime(self, frameName(leaf), ms);
    }
    // Each function once per sample, however deep it recursed; only the app's own chunks.
    const stack = new Set<string>();
    for (
      let id: number | undefined = sample;
      id !== undefined;
      id = parent.get(id)
    ) {
      const frame = byId.get(id)?.callFrame;
      if (frame?.functionName && frame.url.includes("/assets/")) {
        stack.add(frameName(frame));
      }
    }
    for (const name of stack) {
      addTime(total, name, ms);
    }
  }
  const top = (times: Map<string, number>, count: number) =>
    [...times]
      .sort((left, right) => right[1] - left[1])
      .slice(0, count)
      .map(([name, time]) => `${time.toFixed(0).padStart(6)} ms  ${name}`);
  return [...top(total, 12), "  self:", ...top(self, 10)];
}

const tabs = {
  today: "/today",
  review: "/review",
  learn: "/lessons",
  read: "/reading",
  library: "/library",
} as const;
type Tab = keyof typeof tabs;
const nav = (page: Page, tab: Tab) =>
  page.locator(`nav[aria-label="Main tabs"] a[href="${tabs[tab]}"]`);

const LEFT = /(\d+) left/;
const nextFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );

interface Session {
  cdp: CDPSession;
  page: Page;
  profiles: Record<string, string[]>;
  result: Record<string, number | number[]>;
}

/**
 * Do `work` and record its interactions as `name`, and the main thread time it blocked as
 * `name` + "Blocking"; with `--profile`, also where it spent its time.
 */
async function measure(
  session: Session,
  name: string,
  work: () => Promise<void>
) {
  const { cdp, page, profiles, result } = session;
  if (values.profile) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }
  const from = await now(page);
  await work();
  const to = await now(page);
  if (values.profile) {
    const { profile } = await cdp.send("Profiler.stop");
    profiles[name] = hottest(profile as Parameters<typeof hottest>[0]);
  }
  const perf = await readPerf(page);
  result[name] = interactions(perf, from, to);
  result[`${name}Blocking`] = blocking(perf, from, to);
  return to - from;
}

/** Open Today with three months of progress on the device. */
async function startup(session: Session) {
  const { page } = session;
  await measure(session, "startupTaps", async () => {
    await page.goto(`${ORIGIN}/today`);
    await page.waitForFunction(
      () =>
        !document.querySelector("[data-booting]") &&
        document.body.innerText.includes("next up"),
      undefined,
      { polling: "raf" }
    );
  });
  session.result.startup = await now(page);
  session.result.startupBlocking = blocking(await readPerf(page), 0);
}

/** Open the deck from the tab bar, then answer cards with the keyboard. */
async function review(session: Session) {
  const { page } = session;
  session.result.openReview = await measure(
    session,
    "openReviewTaps",
    async () => {
      await nav(page, "review").click();
      await page.getByText(LEFT).first().waitFor();
    }
  );
  // The deck ignores keys typed into the tab link the click left focused.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur()
  );
  const left = async () =>
    Number(
      (await page.getByText(LEFT).first().textContent())?.match(LEFT)?.[1]
    );
  await measure(session, "review", async () => {
    for (let index = 0; index < REVIEWS; index += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: a learner answers one card at a time.
      const before = await left();
      if (!before) {
        break;
      }
      await page.keyboard.press("Space");
      await page.locator("[data-answer]").first().waitFor();
      await page.keyboard.press(index % 7 === 0 ? "1" : "3");
      await page.waitForFunction(
        (count) => {
          // biome-ignore lint/performance/useTopLevelRegex: runs in the page, which sees no outer scope.
          const text = document.body.innerText.match(/(\d+) left/);
          return !text || Number(text[1]) !== count;
        },
        before,
        { polling: "raf" }
      );
    }
  });
}

/** Move around the app the way a learner checks on things, timing each tab. */
async function tour(session: Session) {
  const { page } = session;
  const visits: [string, Tab][] = [
    ["today", "today"],
    ["learn", "learn"],
    ["read", "read"],
    ["library", "library"],
    ["today again", "today"],
    ["review", "review"],
  ];
  for (const [visit, tab] of visits) {
    // biome-ignore lint/performance/noAwaitInLoops: one tab at a time, like a learner.
    await measure(session, `tab ${visit}`, async () => {
      await nav(page, tab).click();
      await page.waitForURL(`**${tabs[tab]}`);
      await nextFrame(page);
    });
  }
}

/** Name a scene's first clue in the next lesson, as you type. */
async function lesson(session: Session) {
  const { page } = session;
  await nav(page, "learn").click();
  const clue = page.locator("main input, [data-fixed] input").first();
  await clue.waitFor();
  await clue.click();
  await measure(session, "lesson", async () => {
    await clue.pressSequentially("grandma", { delay: 120 });
    // Interaction timings arrive after the frame they end in.
    await page.waitForTimeout(500);
  });
}

/** Search the whole course as you type. */
async function search(session: Session) {
  const { page } = session;
  await nav(page, "library").click();
  const field = page
    .getByRole("searchbox", { name: "Search the library" })
    .or(page.getByRole("textbox", { name: "Search the library" }));
  await field.waitFor();
  await measure(session, "search", async () => {
    await field.pressSequentially("ren", { delay: 120 });
    // Interaction timings arrive after the frame they end in.
    await page.waitForTimeout(500);
  });
}

/** A fresh phone with the learner's progress on it and no server behind it. */
async function phone(browser: Browser, rows: ReturnType<typeof allRows>) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  // Sync answers as a signed-out device, and nothing reaches the database.
  await context.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: { error: "signed out" } })
  );
  await context.route("**/_serverFn/**", (route) =>
    route.fulfill({ status: 401 })
  );
  const page = await context.newPage();
  await seed(page, rows);
  await page.addInitScript(observe);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  return { context, page, cdp };
}

// Lighthouse's mobile network: 150 ms round trips, 1.6 Mbps down, 750 Kbps up.
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

/** A first open over a phone network, with nothing cached yet. */
async function slowStartup(browser: Browser, rows: ReturnType<typeof allRows>) {
  const { context, page, cdp } = await phone(browser, rows);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  const session: Session = { cdp, page, profiles: {}, result: {} };
  await startup(session);
  await context.close();
  return session.result.startup as number;
}

async function run(browser: Browser, rows: ReturnType<typeof allRows>) {
  const { context, page, cdp } = await phone(browser, rows);
  const session: Session = { cdp, page, profiles: {}, result: {} };
  await startup(session);
  const atStartup = await downloads(page, session.result.startup as number);
  for (const [kind, kb] of Object.entries(atStartup)) {
    session.result[`startup ${kind} KB`] = kb;
  }
  session.result.startupHeap = await heap(cdp);
  session.result.storage = await page.evaluate(
    async () => ((await navigator.storage.estimate()).usage ?? 0) / 1024
  );
  await review(session);
  await tour(session);
  await lesson(session);
  await search(session);
  const inSession = await downloads(page);
  for (const [kind, kb] of Object.entries(inSession)) {
    session.result[`session ${kind} KB`] = kb;
  }
  session.result.sessionHeap = await heap(cdp);
  session.result.slowStartup = await slowStartup(browser, rows);
  await context.close();
  for (const [phase, lines] of Object.entries(session.profiles)) {
    console.info(`\n${phase}\n${lines.join("\n")}`);
  }
  return session.result;
}

const median = (samples: number[]) => {
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] ?? 0) : 0;
};
const percentile = (samples: number[], p: number) => {
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted.length
    ? (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0)
    : 0;
};

if (!values["no-build"]) {
  const build = Bun.spawnSync(["bun", "run", "build"], {
    env: { ...process.env, FLUENC_UNMINIFIED: values.profile ? "1" : "0" },
    stdout: "ignore",
    stderr: "ignore",
  });
  if (build.exitCode) {
    process.exit(build.exitCode);
  }
}

console.info("generating the learner…");
const state = learner();
const seeded = allRows(state);
const due = deriveDashboard(state, new Date()).reviewQueue.length;

// What a new device downloads on its first sync for this learner: the whole account as a patch.
const firstSync = JSON.stringify({
  acknowledged: [],
  cursor: 1,
  learner: { id: "learner", email: "learner@example.com" },
  reset: true,
  patch: {
    cards: state.cards,
    actors: state.actors,
    sets: state.sets,
    rooms: state.rooms,
    props: state.props,
    livingLinks: state.livingLinks,
    focus: state.focus,
    removedFocus: [],
  },
});
const syncSizes = {
  "first sync KB": brotliCompressSync(firstSync).length / 1024,
};
console.info(
  `${Object.keys(state.cards).length} cards, ${seeded.length} rows, ${due} due`
);

const server = Bun.spawn(["bun", "scripts/preview.ts"], {
  env: { ...process.env, PORT: String(PORT) },
  stdout: "ignore",
  stderr: "inherit",
});
const launched = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: wait for the preview server to answer.
      await fetch(`${ORIGIN}/manifest.webmanifest`);
      break;
    } catch (error) {
      if (attempt > 100) {
        throw error;
      }
      await Bun.sleep(100);
    }
  }
  const results: Awaited<ReturnType<typeof run>>[] = [];
  for (let index = 0; index < RUNS; index += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: runs must not share the CPU.
    results.push(await run(launched, seeded));
  }
  const scalar = (key: string) =>
    median(results.map((result) => result[key] as number));
  const pooled = (key: string) =>
    results.flatMap((result) => result[key] as number[]);
  const keys = Object.keys(results[0] ?? {});
  const summary = {
    "startup ms": scalar("startup"),
    "startup on slow 4G ms": scalar("slowStartup"),
    "startup blocking ms": scalar("startupBlocking"),
    "open review ms": scalar("openReview"),
    "open review tap ms": Math.max(0, ...pooled("openReviewTaps")),
    "review p50 ms": median(pooled("review")),
    "review p95 ms": percentile(pooled("review"), 0.95),
    "review blocking ms": scalar("reviewBlocking"),
    ...Object.fromEntries(
      Object.keys(results[0] ?? {})
        .filter((key) => key.startsWith("tab ") && !key.endsWith("Blocking"))
        .map((key) => [`${key} ms`, Math.max(0, ...pooled(key))])
    ),
    "tabs blocking ms": median(
      results.map((result) =>
        Object.entries(result)
          .filter(([key]) => key.startsWith("tab ") && key.endsWith("Blocking"))
          .reduce((total, [, value]) => total + (value as number), 0)
      )
    ),
    "lesson typing p50 ms": median(pooled("lesson")),
    "lesson typing max ms": Math.max(0, ...pooled("lesson")),
    "lesson blocking ms": scalar("lessonBlocking"),
    "search p50 ms": median(pooled("search")),
    "search max ms": Math.max(0, ...pooled("search")),
    "search blocking ms": scalar("searchBlocking"),
    ...Object.fromEntries(
      keys
        .filter((key) => key.endsWith(" KB"))
        .sort()
        .map((key) => [key, scalar(key)])
    ),
    "startup total KB": median(
      results.map((result) =>
        Object.entries(result)
          .filter(([key]) => key.startsWith("startup ") && key.endsWith(" KB"))
          .reduce((total, [, value]) => total + (value as number), 0)
      )
    ),
    "JS heap after startup MB": scalar("startupHeap"),
    "JS heap after session MB": scalar("sessionHeap"),
    "device storage KB": scalar("storage"),
    ...syncSizes,
  };
  console.table(
    Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [key, Math.round(value)])
    )
  );
  if (values.json) {
    await Bun.write(values.json, JSON.stringify({ summary, results }, null, 2));
  }
} finally {
  await launched.close();
  server.kill();
}
