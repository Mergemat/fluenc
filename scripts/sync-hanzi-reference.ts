// Write src/data/hanzi-reference.generated.json: for every character Make Me a Hanzi knows, its
// stroke count, the parts it is made of, its readings and a short gloss. The server checks agents'
// descriptions of characters the course lacks against it, and shows it to them first.
//
//   bun scripts/sync-hanzi-reference.ts
//
// Pinned to one commit so the reference only changes when this script does. dictionary.txt is
// LGPL-3.0-or-later; see THIRD_PARTY.md.
import { writeFile } from "node:fs/promises";

const COMMIT = "bddc96d41bef78427ed0e034e9f7e31d71fd1b92";
const SOURCE = `https://raw.githubusercontent.com/skishore/makemeahanzi/${COMMIT}/dictionary.txt`;
const OUTPUT = "src/data/hanzi-reference.generated.json";
const GLOSS_LENGTH = 60;

interface Entry {
  character: string;
  decomposition: string;
  definition?: string;
  /** One entry per stroke, naming the part that draws it. */
  matches: unknown[];
  pinyin: string[];
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`dictionary.txt: ${response.status}`);
}
const entries = (await response.text())
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Entry);

const reference = Object.fromEntries(
  entries.map((entry) => [
    entry.character,
    {
      strokes: entry.matches.length,
      parts: entry.decomposition,
      pinyin: entry.pinyin.map((reading) => reading.normalize("NFC")),
      gloss: (entry.definition ?? "").slice(0, GLOSS_LENGTH),
    },
  ])
);
await writeFile(
  OUTPUT,
  `${JSON.stringify({ source: SOURCE, characters: reference })}\n`
);
console.log(`Wrote ${entries.length} characters to ${OUTPUT}.`);
