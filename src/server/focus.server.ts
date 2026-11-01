// A learner's focus: words and sentences to teach next, such as a class's new words. Written by
// `bun run focus` and by the learner's coding agents over MCP; devices only read it.
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";

import type { FocusEntry, OwnCharacter } from "../data/types";
import { db } from "../db";
import { verification } from "../db/auth-schema";
import { catalog, catalogFor } from "../lib/catalog";
import { cardKey, focusKey, type LearnerState } from "../lib/learner-state";
import { deriveDashboard } from "../lib/learner-views";
import { wordSyllables } from "../lib/word-syllables";
import {
  characterInput,
  missingCharacters,
  resolveCharacters,
  share,
  simplifiedOf,
} from "./community.server";
import { readLearnerState, writeOperations } from "./sync.server";

/** Most entries one learner keeps, so no caller can grow a learner's rows without bound. */
export const MAX_FOCUS_ENTRIES = 500;
/** Most entries one change adds or removes. */
export const MAX_FOCUS_CHANGE = 100;

const lessonItem = z.object({
  hanzi: z.string().trim().min(1).max(40),
  pinyin: z.string().trim().min(1).max(200),
  meaning: z.string().trim().min(1).max(200),
});

export const focusLesson = z.object({
  label: z.string().trim().min(1).max(80),
  words: z.array(lessonItem).max(MAX_FOCUS_CHANGE).default([]),
  sentences: z.array(lessonItem).max(MAX_FOCUS_CHANGE).default([]),
  characters: z.array(characterInput).max(MAX_FOCUS_CHANGE).default([]),
});
export type FocusLesson = z.input<typeof focusLesson>;

// 不 and 一 change tone before another syllable; the course spells them in their own tone.
const citation: Record<string, Record<string, string>> = {
  不: { bú: "bù" },
  一: { yí: "yī", yì: "yī" },
};

/** Course-style word pinyin: lower case, one run, 不 and 一 in their own tone. */
export function wordPinyin(hanzi: string, reading: string) {
  const joined = reading.normalize("NFC").toLowerCase().replace(/\s+/gu, "");
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

const HAN = /\p{Script=Han}/u;
const HAN_ONLY = /^\p{Script=Han}+$/u;
/** The longest course word, 不好意思, is four characters; longer text is a sentence. */
const MAX_WORD_LENGTH = 4;
const courseWords = new Set(catalog.uniqueWords.map((item) => item.hanzi));

/** Why an entry can't be taught as written, in words the agent can act on. */
function entryProblem(entry: FocusEntry) {
  if (!HAN.test(entry.hanzi)) {
    return "no hanzi";
  }
  const simplified = simplifiedOf(entry.hanzi);
  if (simplified) {
    return `written in traditional characters; add ${simplified} instead`;
  }
  if (entry.kind === "sentence") {
    return null;
  }
  if (!HAN_ONLY.test(entry.hanzi)) {
    return "a word is hanzi only; add text with punctuation as a sentence";
  }
  if (Array.from(entry.hanzi).length > MAX_WORD_LENGTH) {
    return `a word is at most ${MAX_WORD_LENGTH} characters; add longer text as a sentence`;
  }
  const own = !(
    courseWords.has(entry.hanzi) || catalog.charactersById.has(entry.hanzi)
  );
  if (own && !wordSyllables(entry.hanzi, entry.pinyin)) {
    return `pinyin "${entry.pinyin}" doesn't read as one syllable per character of ${entry.hanzi}`;
  }
  return null;
}

/** Where an entry stands. */
export type FocusStatus =
  | { status: "queued"; own: boolean }
  | { status: "known" }
  | { status: "skipped"; reason: string };

export function focusStatus(
  entry: FocusEntry,
  state: LearnerState
): FocusStatus {
  const [target] = catalogFor({ focus: [entry] }).focus;
  if (!target) {
    return { status: "skipped", reason: "no hanzi" };
  }
  if (state.cards[target.key]) {
    return { status: "known" };
  }
  return {
    status: "queued",
    own: target.key === cardKey(entry.kind, entry.hanzi),
  };
}

/** What the Learn tab teaches next, focus first. */
function upNext(state: LearnerState) {
  return deriveDashboard(state, new Date())
    .buildQueue.slice(0, 12)
    .map((lesson) => lesson.hanzi);
}

function describe(entry: FocusEntry, state: LearnerState) {
  return {
    kind: entry.kind,
    hanzi: entry.hanzi,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
    label: entry.label,
    ...focusStatus(entry, state),
  };
}

export async function readFocus(learnerId: string) {
  const state = await readLearnerState(learnerId);
  return {
    entries: state.focus.map((entry) => describe(entry, state)),
    upNext: upNext(state),
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

/** A problem the caller can fix: too many entries, or a preview that is gone. */
export class FocusError extends Error {}

const PREVIEW_LIFETIME_MS = 60 * 60 * 1000;
// Better Auth's expiring token table; a preview lives as long as a learner takes to say yes.
const previewKey = (learnerId: string, id: string) =>
  `focus-preview:${learnerId}:${id}`;

/** Keep a previewed lesson so saving it needs only its id, not the whole lesson again. */
export async function keepPreview(learnerId: string, lesson: FocusLesson) {
  const id = crypto.randomUUID().slice(0, 8);
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: previewKey(learnerId, id),
    value: JSON.stringify(lesson),
    expiresAt: new Date(Date.now() + PREVIEW_LIFETIME_MS),
  });
  return id;
}

/** Save a lesson exactly as previewed. */
export async function savePreview(learnerId: string, id: string) {
  const [row] = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.identifier, previewKey(learnerId, id)),
        gt(verification.expiresAt, new Date())
      )
    );
  if (!row) {
    throw new FocusError(
      "That preview expired or was already saved. Preview the lesson again with add_to_focus."
    );
  }
  const result = await addFocus(learnerId, JSON.parse(row.value), {
    dryRun: false,
  });
  await db.delete(verification).where(eq(verification.id, row.id));
  return result;
}

/**
 * Add a lesson after the focus already there. A dry run reports the same without saving. Left
 * unset, it is a dry run whenever saving would share new characters, so the learner sees them
 * before every other learner can.
 */
export async function addFocus(
  learnerId: string,
  input: FocusLesson,
  { dryRun }: { dryRun?: boolean } = {}
) {
  const lesson = focusLesson.parse(input);
  const start = Date.now();
  const entries: FocusEntry[] = [
    ...lesson.words.map((word) => ({
      kind: "word" as const,
      hanzi: word.hanzi,
      pinyin: wordPinyin(word.hanzi, word.pinyin),
      meaning: word.meaning,
    })),
    ...lesson.sentences.map((sentence) => ({
      kind: "sentence" as const,
      ...sentence,
    })),
  ].map((entry, index) => ({
    ...entry,
    label: lesson.label,
    addedAt: new Date(start + index).toISOString(),
  }));

  const problemsOf = new Map(
    entries.map((entry) => [entry, entryProblem(entry)])
  );
  const missing = new Map(
    entries.map((entry) => [
      entry,
      problemsOf.get(entry) ? [] : missingCharacters(entry.hanzi),
    ])
  );
  const { found, fresh, problems } = await resolveCharacters(
    [...new Set([...missing.values()].flat())],
    lesson.characters
  );
  for (const [entry, needed] of missing) {
    if (needed.length && needed.every((hanzi) => found.has(hanzi))) {
      entry.characters = needed.flatMap((hanzi) => found.get(hanzi) ?? []);
    }
  }
  const unresolved = (entry: FocusEntry) =>
    (missing.get(entry) ?? [])
      .filter((character) => problems.has(character))
      .map((character) => `${character}: ${problems.get(character)}`)
      .join("; ");

  const state = await readLearnerState(learnerId);
  const present = new Set(state.focus.map(focusKey));
  const results = entries.map((entry) => {
    if (present.has(focusKey(entry))) {
      return { ...describe(entry, state), status: "already in focus" as const };
    }
    const reason = problemsOf.get(entry) ?? unresolved(entry);
    return reason
      ? { ...describe(entry, state), status: "skipped" as const, reason }
      : describe(entry, state);
  });
  const accepted = entries.filter(
    (_entry, index) =>
      results[index]?.status !== "skipped" &&
      results[index]?.status !== "already in focus"
  );
  if (state.focus.length + accepted.length > MAX_FOCUS_ENTRIES) {
    throw new FocusError(
      `Focus holds at most ${MAX_FOCUS_ENTRIES} entries and has ${state.focus.length}. Remove some first.`
    );
  }
  const report = (definitions: Iterable<OwnCharacter>, own: Set<string>) =>
    [...definitions].map((definition) => ({
      ...definition,
      from: own.has(definition.hanzi) ? "you" : "community",
    }));
  // Only characters a saved entry uses join the community.
  const used = new Map(
    accepted.flatMap((entry) =>
      (entry.characters ?? []).map((item) => [item.hanzi, item] as const)
    )
  );
  const sharing = [...used.keys()].filter((hanzi) => fresh.has(hanzi));
  const preview = dryRun ?? sharing.length > 0;
  if (preview || !accepted.length) {
    return {
      saved: 0,
      /** Saving would add entries; nothing was written. */
      previewed: preview && accepted.length > 0,
      /** New characters saving would share with every learner who adds them. */
      sharing,
      results,
      characters: report(found.values(), fresh),
      upNext: upNext(state),
    };
  }
  const stored = await share(
    [...used.values()].filter((item) => fresh.has(item.hanzi)),
    learnerId
  );
  const final = (item: OwnCharacter) =>
    stored.get(item.hanzi)?.character ?? item;
  for (const entry of accepted) {
    entry.characters = entry.characters?.map(final);
  }
  const described = new Set(
    [...stored]
      .filter(([, row]) => row.createdBy === learnerId)
      .map(([hanzi]) => hanzi)
  );
  await writeFocus(learnerId, { add: accepted });
  return {
    saved: accepted.length,
    results,
    characters: report([...used.values()].map(final), described),
    upNext: upNext(await readLearnerState(learnerId)),
  };
}

/** Remove entries by their hanzi, words and sentences alike. */
export async function removeFocus(learnerId: string, hanzi: string[]) {
  const before = await readLearnerState(learnerId);
  await writeFocus(learnerId, { remove: hanzi.slice(0, MAX_FOCUS_CHANGE) });
  const after = await readLearnerState(learnerId);
  return {
    removed: before.focus.length - after.focus.length,
    upNext: upNext(after),
  };
}
