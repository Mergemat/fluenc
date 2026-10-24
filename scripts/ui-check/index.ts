// Compares how the app looks now against a base commit, page by page and screen size by screen size.
//
//   bun run ui:check                    compare the working tree with main
//   bun run ui:check --base <ref>       compare with another commit
//   bun run ui:check --only review      only scenarios whose name contains "review"
//   bun run ui:check --viewport phone,tablet   just these sizes
//   bun run ui:check --full             every screen size, not just phone and laptop
//   bun run ui:check --reseed           rebuild the demo database first
//   bun run ui:check --serve            start the two apps and keep them running
//   bun run ui:check --attach --only x  compare using apps a --serve started
//
// Both apps run side by side from copies of one seeded local database, with the browser clock
// frozen, so the only difference between them is the code. Each scenario compares the computed
// style and box of every element, then the pixels. The report lands in .cache/ui-check/report.
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright-core";

import { credentials } from "./learners";
import { type Capture, captureStyles, diffImages, settle } from "./page";
import {
  type Scenario,
  scenarios,
  type Viewport,
  viewports,
} from "./scenarios";
import { ensureSeed, type Server, startServers, WORK } from "./servers";

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "main" },
    only: { type: "string" },
    viewport: { type: "string" },
    port: { type: "string", default: "4310" },
    reseed: { type: "boolean", default: false },
    jobs: { type: "string", default: "6" },
    full: { type: "boolean", default: false },
    serve: { type: "boolean", default: false },
    attach: { type: "boolean", default: false },
    report: { type: "string" },
  },
});

const QUICK = ["phone", "laptop"];
const REPORT = join(
  WORK,
  args.report ?? (args.only ? `report-${args.only}` : "report")
);
/** Leave a little room after seeding, as if the learner opened the app an hour later. */
const OPENED_AFTER_SEED = 60 * 60 * 1000;

interface Side {
  capture: Capture;
  errors: string[];
  screenshot: Buffer;
}

interface Difference {
  changes: string[];
  element: string;
  path: string;
}

interface Result {
  differences: Difference[];
  errors: string[];
  images: { base: string; head: string; diff: string | null };
  /** Transition changes: not visible in a still, listed for review. */
  motion: Difference[];
  name: string;
  pixels: number;
  structure: string | null;
}

async function openSide(
  browser: Browser,
  server: Server,
  scenario: Scenario,
  viewport: Viewport,
  now: number
): Promise<Side> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
    serviceWorkers: "block",
    reducedMotion: "no-preference",
    colorScheme: "dark",
  });
  const errors: string[] = [];
  try {
    // Generated audio would cost money; nothing here needs it.
    await context.route("**/api/audio**", (route) => route.abort());
    // Progress made in a scenario stays on its device: the server copy is shared by every
    // scenario in the run, so it only ever hears an empty sync and the device is told it landed.
    await context.route("**/api/sync", async (route) => {
      const body = route.request().postDataJSON() as {
        operations?: { id: string }[];
      } | null;
      const operations = body?.operations ?? [];
      if (!operations.length) {
        await route.continue();
        return;
      }
      const response = await route.fetch({
        postData: JSON.stringify({ ...body, operations: [] }),
      });
      const json = await response.json();
      await route.fulfill({
        response,
        json: {
          ...json,
          acknowledged: [
            ...(json.acknowledged ?? []),
            ...operations.map((o) => o.id),
          ],
        },
      });
    });
    const page: Page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(now);
    if (scenario.welcomeSeen !== false) {
      await context.addInitScript(() =>
        localStorage.setItem("fluenc-welcome-seen", "1")
      );
    }
    if (scenario.learner !== null) {
      // Signed in from the page, so the browser keeps the cookie the way it would for a learner.
      await page.goto(`${server.url}/manifest.webmanifest`);
      const status = await page.evaluate(
        async (account) => {
          let code = 0;
          // SQLite can be busy for a moment while other scenarios sign in.
          for (let attempt = 0; attempt < 5 && code !== 200; attempt += 1) {
            // biome-ignore lint/performance/noAwaitInLoops: a retry waits for the attempt before it.
            const response = await fetch("/api/auth/sign-in/email", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(account),
            });
            code = response.status;
            if (code !== 200) {
              await new Promise((done) =>
                setTimeout(done, 300 * (attempt + 1))
              );
            }
          }
          return code;
        },
        credentials(scenario.learner ?? "demo")
      );
      if (status !== 200) {
        throw new Error(`sign-in failed on ${server.name}: ${status}`);
      }
    }
    await page.goto(`${server.url}${scenario.path}`, { timeout: 60_000 });
    await waitForApp(page);
    if (scenario.act) {
      await scenario.act(page, viewport);
      await quiet(page);
      await stillness(page);
    }
    await page.evaluate(settle);
    const capture = await page.evaluate(captureStyles);
    const screenshot = await page.screenshot({
      animations: "disabled",
      caret: "hide",
      timeout: 60_000,
    });
    return { capture, screenshot, errors };
  } finally {
    await context.close();
  }
}

/** Nothing in flight for a moment, or give up waiting after a few seconds. */
async function quiet(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 5000 })
    .catch(() => undefined);
}

/** The app has drawn: no loader or loading glyph on screen, nothing in flight, the page still. */
async function waitForApp(page: Page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(
      () =>
        document.readyState === "complete" &&
        !document.querySelector(
          '[data-hydrated="false"], [data-booting], [role="status"][aria-label], [data-state="loading"], [aria-busy="true"]'
        ),
      undefined,
      { timeout: 15_000 }
    )
    .catch(() => undefined);
  await quiet(page);
  await stillness(page);
}

/** The number of elements stops changing: paging, lazy lists and late renders are done. */
async function stillness(page: Page) {
  let last = -1;
  for (let check = 0; check < 40; check += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each count is compared with the one before.
    const count = await page.evaluate(
      () => document.getElementsByTagName("*").length
    );
    if (count === last) {
      return;
    }
    last = count;
    await Bun.sleep(400);
  }
}

const SAME_NUMBER = 0.051;
/** Fewer changed pixels than this, with every style the same, is anti-aliasing noise. */
const PIXEL_NOISE = 50;
const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/g;

/** Transitions only show in motion, which a still capture can't compare; noted, not failed. */
const MOTION = new Set([
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "transition-behavior",
]);

const HEX_COLOUR = /^#[0-9a-f]{8}$/;
const BORDER_COLOR = /^border-(top|right|bottom|left)-color$/;
const TOP_LEVEL_COMMA = /,(?![^(]*\))/;
const EMPTY_SHADOW = /^(inset )?#[0-9a-f]{6}00( 0px){2,4}( inset)?$/;

const CONTAINER_ONLY = new Set([
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-auto-flow",
  "flex-direction",
  "flex-flow",
  "flex-wrap",
  "gap",
  "row-gap",
  "column-gap",
  "justify-items",
]);
const ITEM_ONLY = new Set([
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "flex",
  "order",
  "grid-area",
  "grid-row-start",
  "grid-row-end",
  "grid-column-start",
  "grid-column-end",
  "justify-self",
]);
const isContainer = (display: string) =>
  display.includes("flex") || display.includes("grid");

/** Properties that do nothing where they are: container ones off a container, item ones off an item. */
function inert(property: string, display: string, parentDisplay: string) {
  return (
    (CONTAINER_ONLY.has(property) && !isContainer(display)) ||
    (ITEM_ONLY.has(property) && !isContainer(parentDisplay))
  );
}

/** Values that print differently but draw the same. */
function canonical(property: string, value: string) {
  if (property === "box-shadow" || property === "text-shadow") {
    // Tailwind composes shadows from several layers; the unused ones are transparent and zero.
    const layers = value
      .split(TOP_LEVEL_COMMA)
      .map((layer) => layer.trim())
      .filter((layer) => !EMPTY_SHADOW.test(layer));
    return layers.length ? layers.join(", ") : "none";
  }
  if (property === "animation-name") {
    // Keyframes were renamed; what matters is whether and how many run.
    return value
      .split(",")
      .map((name) => (name.trim() === "none" ? "none" : "keyframes"))
      .join(", ");
  }
  return value;
}

/** Equal, or equal but for sub-pixel rounding in the numbers. */
function sameValue(a: string, b: string) {
  if (a === b) {
    return true;
  }
  const shapeA = a.replace(NUMBER, "#");
  if (shapeA !== b.replace(NUMBER, "#")) {
    // Colours were turned into #rrggbbaa; allow a step of rounding per channel.
    if (HEX_COLOUR.test(a) && HEX_COLOUR.test(b)) {
      for (let i = 1; i < 9; i += 2) {
        if (
          Math.abs(
            Number.parseInt(a.slice(i, i + 2), 16) -
              Number.parseInt(b.slice(i, i + 2), 16)
          ) > 1
        ) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  const numbersA = a.match(NUMBER) ?? [];
  const numbersB = b.match(NUMBER) ?? [];
  return numbersA.every(
    (n, i) => Math.abs(Number(n) - Number(numbersB[i])) < SAME_NUMBER
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one pass over both trees, every rule in one place.
function compareCaptures(base: Capture, head: Capture) {
  const differences: Difference[] = [];
  const motionNotes: Difference[] = [];
  const headByPath = new Map(
    head.elements.map((element) => [element.path, element])
  );
  const headProperty = new Map(head.properties.map((name, i) => [name, i]));
  const missing = base.elements.filter(
    (element) => !headByPath.has(element.path)
  );
  const extra = head.elements.length - (base.elements.length - missing.length);
  const structure =
    missing.length || extra
      ? `${missing.length} elements gone (first: ${missing[0]?.label ?? "-"}), ${extra} new`
      : null;

  let motion: string[] = [];
  const baseDisplay = base.properties.indexOf("display");
  const headDisplay = head.properties.indexOf("display");
  const compareStyle = (
    prefix: string,
    a: number[],
    b: number[] | undefined,
    changes: string[],
    parents: [string, string] = ["block", "block"]
  ) => {
    if (!b) {
      changes.push(`${prefix}missing`);
      return;
    }
    const displays = [
      base.strings[a[baseDisplay]],
      head.strings[b[headDisplay]],
    ];
    const read = (side: Capture, values: number[], property: string) =>
      side.strings[values[side.properties.indexOf(property)]];
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each skip rule is one early return.
    base.properties.forEach((name, i) => {
      if (
        inert(name, displays[0], parents[0]) &&
        inert(name, displays[1], parents[1])
      ) {
        return;
      }
      // The colour of a side that has no width, or an outline that isn't drawn, shows nowhere.
      const side = BORDER_COLOR.exec(name)?.[1];
      if (
        side &&
        read(base, a, `border-${side}-width`) === "0px" &&
        read(head, b, `border-${side}-width`) === "0px"
      ) {
        return;
      }
      if (
        name === "outline-color" &&
        read(base, a, "outline-style") === "none" &&
        read(head, b, "outline-style") === "none"
      ) {
        return;
      }
      const j = headProperty.get(name);
      const valueA = base.strings[a[i]];
      const valueB = j === undefined ? "(unknown)" : head.strings[b[j]];
      if (!sameValue(canonical(name, valueA), canonical(name, valueB))) {
        (MOTION.has(name) ? motion : changes).push(
          `${prefix}${name}: ${valueA} → ${valueB}`
        );
      }
    });
  };

  for (const element of base.elements) {
    const other = headByPath.get(element.path);
    if (!other) {
      continue;
    }
    let changes: string[] = [];
    motion = [];
    if (!(element.rendered || other.rendered)) {
      // Neither side draws it, so how it would look is moot.
      continue;
    }
    if (element.rendered !== other.rendered) {
      changes.push(`rendered: ${element.rendered} → ${other.rendered}`);
    }
    compareStyle("", element.style, other.style, changes, [
      element.parentDisplay,
      other.parentDisplay,
    ]);
    const moved = element.rect.some(
      (n, i) => Math.abs(n - other.rect[i]) > 0.15
    );
    if (!moved) {
      // An auto margin reads as its used value, which depends on when layout last ran; a margin
      // that matters moves a box, and boxes are compared.
      changes = changes.filter((change) => !change.startsWith("margin"));
    }
    for (const [pseudo, style] of Object.entries(element.pseudo)) {
      compareStyle(`${pseudo} `, style, other.pseudo[pseudo], changes);
    }
    for (const pseudo of Object.keys(other.pseudo)) {
      if (!element.pseudo[pseudo]) {
        changes.push(`${pseudo} appeared`);
      }
    }
    if (moved) {
      changes.push(`box: ${element.rect.join(" ")} → ${other.rect.join(" ")}`);
    }
    if (changes.length) {
      differences.push({
        element: `${element.label}  ⇢  ${other.label}`,
        path: element.path,
        changes,
      });
    }
    if (motion.length) {
      motionNotes.push({
        element: `${element.label}  ⇢  ${other.label}`,
        path: element.path,
        changes: motion,
      });
    }
  }
  return { differences, structure, motion: motionNotes };
}

async function runScenario(
  browser: Browser,
  servers: { base: Server; head: Server },
  scenario: Scenario,
  viewport: Viewport,
  now: number
): Promise<Result> {
  const name = `${scenario.name}@${viewport.name}`;
  const [base, head] = await Promise.all([
    openSide(browser, servers.base, scenario, viewport, now),
    openSide(browser, servers.head, scenario, viewport, now),
  ]);
  const { differences, structure, motion } = compareCaptures(
    base.capture,
    head.capture
  );

  const page = await browser.newPage();
  const pixels = await page.evaluate(diffImages, [
    `data:image/png;base64,${base.screenshot.toString("base64")}`,
    `data:image/png;base64,${head.screenshot.toString("base64")}`,
  ] as [string, string]);
  await page.close();

  const file = name.replace(/[^a-z0-9@-]+/gi, "_");
  const images = {
    base: `${file}.base.png`,
    head: `${file}.head.png`,
    diff: pixels.diff ? `${file}.diff.png` : null,
  };
  await Bun.write(join(REPORT, images.base), base.screenshot);
  await Bun.write(join(REPORT, images.head), head.screenshot);
  if (pixels.diff && images.diff) {
    await Bun.write(
      join(REPORT, images.diff),
      Buffer.from(pixels.diff.split(",")[1], "base64")
    );
  }
  return {
    name,
    differences,
    motion,
    structure,
    pixels: pixels.sizeMatches ? pixels.changed : Number.POSITIVE_INFINITY,
    errors: [
      ...base.errors.map((e) => `base: ${e}`),
      ...head.errors.map((e) => `head: ${e}`),
    ],
    images,
  };
}

const isSame = (result: Result) =>
  !(
    result.differences.length ||
    result.structure ||
    result.pixels > PIXEL_NOISE
  );

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
  );

function report(results: Result[], baseSha: string) {
  const rows = results
    .map((result) => {
      const ok = isSame(result);
      const details = result.differences
        .slice(0, 40)
        .map(
          (difference) =>
            `<li><code>${escapeHtml(difference.element)}</code><ul>${difference.changes
              .slice(0, 12)
              .map((change) => `<li>${escapeHtml(change)}</li>`)
              .join("")}</ul></li>`
        )
        .join("");
      return `<section class="${ok ? "ok" : "bad"}"><h2>${escapeHtml(result.name)} — ${
        ok
          ? "same"
          : `${result.differences.length} elements, ${result.pixels} pixels`
      }</h2>${result.structure ? `<p>structure: ${escapeHtml(result.structure)}</p>` : ""}${
        result.errors.length
          ? `<p>errors: ${escapeHtml(result.errors.join("; "))}</p>`
          : ""
      }${ok ? "" : `<div class="shots"><img src="${result.images.base}"><img src="${result.images.head}">${result.images.diff ? `<img src="${result.images.diff}">` : ""}</div><ul>${details}</ul>`}</section>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>ui-check</title><style>
body{background:#111;color:#ddd;font:13px/1.4 ui-monospace,monospace;margin:24px}
.ok h2{color:#4c8}.bad h2{color:#f66}.shots{display:flex;gap:8px;align-items:flex-start}
.shots img{max-width:32%;border:1px solid #333}code{color:#9cf}</style>
<h1>ui-check against ${baseSha.slice(0, 12)}</h1>${rows}`;
}

async function main() {
  const now = (await ensureSeed(args.reseed ?? false)) + OPENED_AFTER_SEED;
  const selected = scenarios.filter(
    (s) => !args.only || s.name.includes(args.only)
  );
  // Phone and laptop catch nearly everything; --full adds the in-between sizes.
  const sizes = viewports.filter((v) =>
    args.viewport
      ? args.viewport.split(",").includes(v.name)
      : args.full || QUICK.includes(v.name)
  );
  const jobs = selected.flatMap((scenario) =>
    sizes
      .filter(
        (viewport) =>
          !scenario.viewports || scenario.viewports.includes(viewport.name)
      )
      .map((viewport) => ({ scenario, viewport }))
  );
  if (!jobs.length) {
    console.error("No scenarios match.");
    process.exit(1);
  }

  const port = Number(args.port);
  if (args.serve) {
    const running = await startServers(args.base ?? "main", port);
    console.log(
      `base ${running.base.url}  head ${running.head.url}  (Ctrl-C to stop)`
    );
    await new Promise(() => undefined);
  }
  const servers = args.attach
    ? {
        base: {
          name: "base",
          url: `http://localhost:${port}`,
          stop: () => undefined,
        },
        head: {
          name: "head",
          url: `http://localhost:${port + 1}`,
          stop: () => undefined,
        },
        baseSha: args.base ?? "main",
      }
    : await startServers(args.base ?? "main", port);
  const browser = await chromium.launch();
  await rm(REPORT, { recursive: true, force: true });
  await mkdir(REPORT, { recursive: true });

  const results: Result[] = [];
  let next = 0;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: runs a job, then prints its result.
  const worker = async () => {
    while (next < jobs.length) {
      const { scenario, viewport } = jobs[next];
      next += 1;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: each worker runs its jobs one after another.
        const result = await runScenario(
          browser,
          servers,
          scenario,
          viewport,
          now
        );
        results.push(result);
        const ok = isSame(result);
        console.log(
          `${ok ? "same" : "DIFF"}  ${result.name}${
            ok
              ? ""
              : `  ${result.differences.length} elements, ${result.pixels} px${result.structure ? `, ${result.structure}` : ""}`
          }${result.errors.length ? `  (${result.errors.length} page errors)` : ""}${
            result.motion.length
              ? `  (${result.motion.length} transition notes)`
              : ""
          }`
        );
        for (const difference of result.differences.slice(0, 6)) {
          console.log(`        ${difference.element}`);
          for (const change of difference.changes.slice(0, 4)) {
            console.log(`            ${change}`);
          }
        }
      } catch (error) {
        console.log(
          `FAIL  ${scenario.name}@${viewport.name}  ${(error as Error).message}`
        );
        results.push({
          name: `${scenario.name}@${viewport.name}`,
          differences: [],
          motion: [],
          structure: `failed: ${(error as Error).message}`,
          pixels: 0,
          errors: [],
          images: { base: "", head: "", diff: null },
        });
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Number(args.jobs) }, worker));
  } finally {
    await browser.close();
    servers.base.stop();
    servers.head.stop();
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  await Bun.write(join(REPORT, "index.html"), report(results, servers.baseSha));
  await Bun.write(
    join(REPORT, "results.json"),
    JSON.stringify(results, null, 2)
  );
  const failed = results.filter((result) => !isSame(result));
  console.log(
    `\n${results.length - failed.length}/${results.length} the same. Report: ${join(REPORT, "index.html")}`
  );
  process.exit(failed.length ? 1 : 0);
}

await main();
