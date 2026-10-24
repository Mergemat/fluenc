// Manage the learner's focus: words and sentences to teach next, such as a class's new words.
//
//   bun run focus add lesson.json [--dry-run]
//   bun run focus list
//   bun run focus remove 中国 学生
//
// Works on the account in FLUENC_EMAIL (.env), or the one passed as --email. Devices pick the
// change up on their next sync.
//
// lesson.json: { "label": "HSK 1 · L3", "words": [{ "hanzi", "pinyin", "meaning" }],
// "sentences": [{ "hanzi", "pinyin", "meaning" }] }. Words take dictionary pinyin (不 is bù);
// sentences keep theirs as written.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { FocusEntry } from "../src/data/types";
import { db } from "../src/db";
import { user } from "../src/db/auth-schema";
import { catalogFor } from "../src/lib/catalog";
import { cardKey, type LearnerState } from "../src/lib/learner-state";
import { deriveDashboard } from "../src/lib/learner-views";
import { wordSyllables } from "../src/lib/word-syllables";
import { readLearnerState, writeOperations } from "../src/server/sync.server";

/** The arguments without `--email <address>`, and the learner id that address signs in as. */
export async function resolveLearner(args: string[]) {
  const flag = args.indexOf("--email");
  const email = (
    flag === -1 ? process.env.FLUENC_EMAIL : args[flag + 1]
  )?.trim();
  const rest = flag === -1 ? args : args.toSpliced(flag, 2);
  if (!email) {
    console.error("Pass --email <address>, or set FLUENC_EMAIL in .env.");
    process.exit(1);
  }
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  if (!account) {
    console.error(`No account for ${email}. Sign up in the app first.`);
    process.exit(1);
  }
  return { learnerId: account.id, email, args: rest };
}

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

function writeFocus(
  learnerId: string,
  data: { add: FocusEntry[] } | { remove: string[] }
) {
  const at = new Date().toISOString();
  return writeOperations(learnerId, [
    { id: crypto.randomUUID(), at, kind: "focus", data },
  ]);
}

async function add(learnerId: string, file: string, dryRun: boolean) {
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

  const state = await readLearnerState(learnerId);
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
  await writeFocus(learnerId, { add: accepted });
  const saved = await readLearnerState(learnerId);
  const dashboard = deriveDashboard(saved, new Date());
  console.log(
    `\nSaved ${accepted.length}. Next in Build: ${dashboard.buildQueue
      .slice(0, 12)
      .map((lessonItem) => lessonItem.hanzi)
      .join(" ")}`
  );
}

async function list(learnerId: string) {
  const state = await readLearnerState(learnerId);
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

async function remove(learnerId: string, hanzi: string[]) {
  const before = await readLearnerState(learnerId);
  await writeFocus(learnerId, { remove: hanzi });
  const after = await readLearnerState(learnerId);
  console.log(`Removed ${before.focus.length - after.focus.length}.`);
}

const [command, ...rest] = process.argv.slice(2);
const usage =
  "Usage: bun run focus add <lesson.json> [--dry-run] | list | remove <hanzi…> [--email <address>]";
if (!(command === "add" || command === "list" || command === "remove")) {
  console.error(usage);
  process.exit(1);
}
const target = await resolveLearner(rest);
const [lessonFile] = target.args;
console.log(`Focus for ${target.email}`);
if (command === "add" && lessonFile) {
  await add(target.learnerId, lessonFile, target.args.includes("--dry-run"));
} else if (command === "list") {
  await list(target.learnerId);
} else if (command === "remove" && target.args.length) {
  await remove(target.learnerId, target.args);
} else {
  console.error(usage);
  process.exit(1);
}
