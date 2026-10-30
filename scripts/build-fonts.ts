// The fonts the app ships, made from the full fonts in assets/fonts:
//
// - The Chinese fonts are cut into chunks in teaching order, each declared with its unicode-range,
//   so a browser downloads only the chunks holding characters on screen. A learner sees the early
//   course most, so most of the font is never fetched until it is needed.
// - The Latin fonts keep only what the interface, the course's pinyin and learners' own names use.
//
// Writes assets/fonts/web/** and src/fonts.generated.css, whose url()s Vite turns into hashed files
// that are cached for good. `bun run data:sync` runs it when the course changes.
import { mkdir, rm } from "node:fs/promises";

import curriculum from "../src/data/curriculum.generated.json";
import { partCodePoint, partsOf } from "../src/lib/glyph-parts";
import { python } from "./font-python";

const WEB = "assets/fonts/web";
// A screen of review cards shows characters from all over the course, each pulling in its whole
// chunk. A chunk's own overhead is about half a kilobyte, so small chunks cost little.
const CHUNK = 25;

// Latin-1, Latin Extended-A, pinyin's tone letters and marks, punctuation, arrows, and the few
// symbols the interface draws. Learners' names in other scripts use the system font.
const LATIN = [
  "U+0000-00FF",
  "U+0100-017F",
  "U+01CD-01DC",
  // Combining marks: Geist draws some of pinyin's tone letters, such as ǐ, from them.
  "U+0300-036F",
  "U+02C7",
  "U+02C9-02CB",
  "U+2010-2027",
  "U+2030-203A",
  "U+20AC",
  "U+2190-21FF",
  "U+2248",
  "U+232B",
  "U+2713",
].join(",");

async function subset(source: string, output: string, unicodes: string) {
  const run = Bun.spawn(
    [
      ...python,
      "-m",
      "fontTools.subset",
      source,
      `--unicodes=${unicodes}`,
      // Every feature stays: the interface uses tabular numbers, and pinyin needs its marks placed.
      "--layout-features=*",
      "--flavor=woff2",
      `--output-file=${output}`,
    ],
    { stdout: "ignore", stderr: "inherit" }
  );
  if ((await run.exited) !== 0) {
    throw new Error(`Could not subset ${source}`);
  }
}

const hex = (codePoint: number) =>
  codePoint.toString(16).toUpperCase().padStart(4, "0");

/** A unicode-range for code points, with runs written as ranges. */
function unicodeRange(codePoints: number[]) {
  const sorted = [...new Set(codePoints)].sort((left, right) => left - right);
  const ranges: string[] = [];
  for (let start = 0; start < sorted.length; ) {
    let end = start;
    while (sorted[end + 1] === (sorted[end] ?? 0) + 1) {
      end += 1;
    }
    const first = sorted[start] ?? 0;
    const last = sorted[end] ?? 0;
    ranges.push(
      first === last ? `U+${hex(first)}` : `U+${hex(first)}-${hex(last)}`
    );
    start = end + 1;
  }
  return ranges.join(", ");
}

const byTeachingOrder = curriculum.characters.toSorted(
  (left, right) => left.order - right.order
);

/** Every character and component the course draws, in the order it is taught. */
const taught: number[] = [];
const seen = new Set<string>();
for (const character of byTeachingOrder) {
  for (const glyph of [character.hanzi, ...character.components]) {
    if (!seen.has(glyph)) {
      seen.add(glyph);
      taught.push(glyph.codePointAt(0) ?? 0);
    }
  }
}

interface Face {
  family: string;
  src: string;
  unicodeRange?: string;
  weight?: string;
}

/** Teaching order cut into runs of `CHUNK`, each with the code points `pick` gives its members. */
function runs<T>(items: T[], pick: (item: T) => number[]) {
  const groups: number[][] = [];
  for (let index = 0; index * CHUNK < items.length; index += 1) {
    groups.push(items.slice(index * CHUNK, (index + 1) * CHUNK).flatMap(pick));
  }
  return groups;
}

/**
 * Cut a Chinese font into one file per group of code points. A font set in lines of text needs a
 * metrics face as well.
 */
async function chunk(
  source: string,
  name: string,
  family: string,
  groups: number[][],
  inLines = true
) {
  await rm(`${WEB}/${name}`, { recursive: true, force: true });
  await mkdir(`${WEB}/${name}`, { recursive: true });
  const faces: Face[] = [];
  if (inLines) {
    // A browser takes a line's height and baseline from the first face whose range has a space.
    // No chunk has one, so a face holding only the space comes first, or the fallback font's
    // metrics would move every character.
    const metrics = `${WEB}/${name}/metrics.woff2`;
    await subset(source, metrics, "U+0020");
    faces.push({ family, src: metrics, unicodeRange: "U+0020" });
  }
  for (const [index, codePoints] of groups.entries()) {
    const range = unicodeRange(codePoints);
    const file = `${WEB}/${name}/${index}.woff2`;
    // biome-ignore lint/performance/noAwaitInLoops: one FontTools process at a time keeps memory low.
    await subset(source, file, range.replaceAll(" ", ""));
    faces.push({ family, src: file, unicodeRange: range });
  }
  return faces;
}

const faceRule = (face: Face) =>
  [
    "@font-face {",
    `  font-family: "${face.family}";`,
    // Relative to src/, where the stylesheet is.
    `  src: url("../${face.src}") format("woff2");`,
    face.weight ? `  font-weight: ${face.weight};` : null,
    face.unicodeRange ? `  unicode-range: ${face.unicodeRange};` : null,
    "  font-display: swap;",
    "}",
  ]
    .filter((line) => line !== null)
    .join("\n");

await mkdir(`${WEB}/geist`, { recursive: true });
const latin: Face[] = [
  { family: "Geist", file: "Geist-Variable", weight: "100 900" },
  { family: "Geist Mono", file: "GeistMono-Variable", weight: "100 900" },
  { family: "Geist Pixel", file: "GeistPixel-Square" },
].map(({ family, file, weight }) => ({
  family,
  src: `${WEB}/geist/${file}.woff2`,
  weight,
}));
await Promise.all(
  latin.map((face) =>
    subset(face.src.replace(`${WEB}/`, "assets/fonts/"), face.src, LATIN)
  )
);

const faces = [
  ...latin,
  ...(await chunk(
    "assets/fonts/fluenc-hanzi.woff2",
    "fluenc-hanzi",
    "Fluenc Hanzi",
    runs(taught, (codePoint) => [codePoint])
  )),
  ...(
    await chunk(
      "assets/fonts/noto-sans-sc-props.woff2",
      "noto-sans-sc-props",
      "Noto Sans CJK SC",
      runs(taught, (codePoint) => [codePoint])
    )
  ).map((face) => ({ ...face, weight: "400" })),
  // Drawn only as SVG text, never in a line.
  ...(await chunk(
    "assets/fonts/fluenc-hanzi-parts.woff2",
    "fluenc-hanzi-parts",
    "Fluenc Hanzi Parts",
    runs(byTeachingOrder, (character) =>
      partsOf(character).flatMap(
        (part) => partCodePoint(character.hanzi, part) ?? []
      )
    ),
    false
  )),
];
await Bun.write(
  "src/fonts.generated.css",
  `/* Written by scripts/build-fonts.ts from the fonts in assets/fonts. */\n\n${faces.map(faceRule).join("\n\n")}\n`
);
console.info(`Wrote ${faces.length} font faces.`);
