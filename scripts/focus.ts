// Manage the learner's focus: words and sentences to teach next, such as a class's new words.
//
//   bun run focus add lesson.json [--dry-run]
//   bun run focus list
//   bun run focus remove 中国 学生
//   bun run focus community
//   bun run focus community remove 忧
//
// Works on the account in FLUENC_EMAIL (.env), or the one passed as --email. Devices pick the
// change up on their next sync. `community` needs no account: it lists the characters learners
// added that the course lacks, most used first, and `community remove` stops sharing one.
//
// lesson.json: { "label": "HSK 1 · L3", "words": [{ "hanzi", "pinyin", "meaning" }],
// "sentences": [{ "hanzi", "pinyin", "meaning" }] }. Words take dictionary pinyin (不 is bù);
// sentences keep theirs as written.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { user } from "../src/db/auth-schema";
import { listCommunity, removeCommunity } from "../src/server/community.server";
import {
  addFocus,
  type FocusStatus,
  readFocus,
  removeFocus,
} from "../src/server/focus.server";

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

function statusText(result: FocusStatus | { status: "already in focus" }) {
  switch (result.status) {
    case "queued":
      return `queued   ${result.own ? "your own" : "course"}`;
    case "known":
      return "known    already learned";
    case "skipped":
      return `skipped  ${result.reason}`;
    default:
      return "kept     already in focus";
  }
}

const row = (entry: { hanzi: string; pinyin: string }, text: string) =>
  `  ${entry.hanzi.padEnd(8, "　")} ${entry.pinyin.padEnd(18)} ${text}`;

async function add(learnerId: string, file: string, dryRun: boolean) {
  const lesson = JSON.parse(await readFile(file, "utf8"));
  const { saved, results, upNext } = await addFocus(learnerId, lesson, {
    dryRun,
  });
  console.log(`${lesson.label}: ${results.length} entries`);
  for (const result of results) {
    console.log(row(result, statusText(result)));
  }
  console.log(
    dryRun
      ? "\nDry run: nothing saved."
      : `\nSaved ${saved}. Next in Build: ${upNext.join(" ")}`
  );
}

async function list(learnerId: string) {
  const { entries } = await readFocus(learnerId);
  let label = "";
  for (const entry of entries) {
    if (entry.label !== label) {
      ({ label } = entry);
      console.log(label);
    }
    console.log(row(entry, statusText(entry)));
  }
  if (!entries.length) {
    console.log("Focus is empty.");
  }
}

async function community(args: string[]) {
  if (args[0] === "remove" && args.length > 1) {
    console.log(`Stopped sharing ${await removeCommunity(args.slice(1))}.`);
    return;
  }
  const characters = await listCommunity();
  for (const item of characters) {
    console.log(
      `  ${item.hanzi}  ${item.pinyin.padEnd(7)} ${item.keyword.padEnd(16)} ${item.components.join(" ").padEnd(14, "　")} ${item.learners} learners`
    );
  }
  if (!characters.length) {
    console.log("No learner has added a character yet.");
  }
}

const [command, ...rest] = process.argv.slice(2);
const usage =
  "Usage: bun run focus add <lesson.json> [--dry-run] | list | remove <hanzi…> [--email <address>] | community [remove <hanzi…>]";
if (command === "community") {
  await community(rest);
  process.exit(0);
}
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
  const { removed } = await removeFocus(target.learnerId, target.args);
  console.log(`Removed ${removed}.`);
} else {
  console.error(usage);
  process.exit(1);
}
