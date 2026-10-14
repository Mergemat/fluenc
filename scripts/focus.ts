// Manage the learner's focus: words and sentences to teach next, such as a class's new words.
//
//   bun run focus add lesson.json [--dry-run]
//   bun run focus list
//   bun run focus remove 中国 学生
//
// lesson.json: { "label": "HSK 1 · L3", "words": [{ "hanzi", "pinyin", "meaning" }],
// "sentences": [{ "hanzi", "pinyin", "meaning" }] }. Words take dictionary pinyin (不 is bù);
// sentences keep theirs as written.
import { readFile } from "node:fs/promises";
import { z } from "zod";

import type { FocusEntry } from "../src/data/types";
import { catalogFor } from "../src/lib/catalog";
import { cardKey, type LearnerState } from "../src/lib/learner-state";
import { deriveDashboard } from "../src/lib/learner-views";
import { wordSyllables } from "../src/lib/word-syllables";
import {
  addFocusHandler,
  getLearnerStateHandler,
  removeFocusHandler,
} from "../src/server/curriculum.handlers.server";

const item = z.object({
  hanzi: z.string().trim().min(1),
  pinyin: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
});
const lesson = z.object({
  label: z.string().trim().min(1),
  words: z.array(item).default([]),
  sentences: z.array(item).default([]),
});

const HAN = /\p{Script=Han}/u;
// 不 and 一 change tone before another syllable; the course spells them in their own tone.
const citation: Record<string, Record<string, string>> = {
  不: { bú: "bù" },
  一: { yí: "yī", yì: "yī" },
};

/** Course-style word pinyin: lower case, one run, 不 and 一 in their own tone. */
export function wordPinyin(hanzi: string, reading: string) {
  const joined = reading.normalize("NFC").toLowerCase().replace(/\s+/g, "");
  const syllables = wordSyllables(hanzi, joined);
  if (!syllables) {
    return joined;
  }
  return Array.from(hanzi)
    .map((character, index) => {
      const syllable = syllables[index] ?? "";
      return citation[character]?.[syllable] ?? syllable;
    })
    .join("");
}

function status(entry: FocusEntry, state: LearnerState) {
  const [target] = catalogFor({ focus: [entry] }).focus;
  if (!target) {
    const missing = Array.from(entry.hanzi).filter(
      (character) =>
        HAN.test(character) && !catalogFor(state).charactersById.has(character)
    );
    return {
      add: false,
      text: missing.length
        ? `skipped  ${[...new Set(missing)].join("")} not in the course`
        : "skipped  no hanzi",
    };
  }
  if (state.cards[target.key]) {
    return { add: true, text: "known    already learned" };
  }
  const own = target.key === cardKey(entry.kind, entry.hanzi);
  return {
    add: true,
    text: `queued   ${own ? "your own" : "course"} ${entry.kind}`,
  };
}

async function add(file: string, dryRun: boolean) {
  const input = lesson.parse(JSON.parse(await readFile(file, "utf8")));
  const start = Date.now();
  const entries: FocusEntry[] = [
    ...input.words.map((word) => ({
      kind: "word" as const,
      hanzi: word.hanzi,
      pinyin: wordPinyin(word.hanzi, word.pinyin),
      meaning: word.meaning,
    })),
    ...input.sentences.map((sentence) => ({
      kind: "sentence" as const,
      ...sentence,
    })),
  ].map((entry, index) => ({
    ...entry,
    label: input.label,
    addedAt: new Date(start + index).toISOString(),
  }));

  const state = await getLearnerStateHandler();
  console.log(`${input.label}: ${entries.length} entries`);
  const accepted = entries.filter((entry) => {
    const result = status(entry, state);
    console.log(
      `  ${entry.hanzi.padEnd(8, "　")} ${entry.pinyin.padEnd(18)} ${entry.meaning.slice(0, 28).padEnd(28)} ${result.text}`
    );
    return result.add;
  });

  if (dryRun) {
    console.log("\nDry run: nothing saved.");
    return;
  }
  await addFocusHandler(accepted);
  const saved = await getLearnerStateHandler();
  const dashboard = deriveDashboard(saved, new Date());
  console.log(
    `\nSaved ${accepted.length}. Next in Build: ${dashboard.buildQueue
      .slice(0, 12)
      .map((lessonItem) => lessonItem.hanzi)
      .join(" ")}`
  );
}

async function list() {
  const state = await getLearnerStateHandler();
  let label = "";
  for (const entry of state.focus) {
    if (entry.label !== label) {
      ({ label } = entry);
      console.log(label);
    }
    console.log(
      `  ${entry.hanzi.padEnd(8, "　")} ${entry.pinyin.padEnd(18)} ${status(entry, state).text}`
    );
  }
  if (!state.focus.length) {
    console.log("Focus is empty.");
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === "add" && args[0]) {
  await add(args[0], args.includes("--dry-run"));
} else if (command === "list") {
  await list();
} else if (command === "remove" && args.length) {
  console.log(`Removed ${await removeFocusHandler(args)}.`);
} else {
  console.error(
    "Usage: bun run focus add <lesson.json> [--dry-run] | list | remove <hanzi…>"
  );
  process.exit(1);
}
