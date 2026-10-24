import { z } from "zod";
import type { Curriculum } from "../src/data/types";
import { segmentSentence } from "../src/lib/sentence-words";

export interface SentenceIdentity {
  hanzi: string;
  id: string;
}

export interface SentenceConflict {
  first: string;
  kind: "exact" | "template";
  second: string;
}

const PUNCTUATION_AND_SPACE = /[\p{P}\p{Z}\s]/gu;
const PRONOUNS = /我们|你们|他们|她们|它们|我|你|您|他|她|它/gu;
// Normalize quantities, not 一 in lexical words such as 一起, 一定, or 一切.
const QUANTITIES =
  /[零〇一二两三四五六七八九十百千万亿\d]+(?=个|本|只|条|张|位|件|杯|岁|年|月|天|小时|分钟|点|块|元|次|人)/gu;
const DIGITS = /\d+/gu;
const SPEAKING_FRAME = /[对跟向](〈人\d+〉)说/gu;

export function sentenceTextKey(hanzi: string) {
  return hanzi.normalize("NFKC").replace(PUNCTUATION_AND_SPACE, "");
}

/** A teaching template, not a claim that the sentences have identical meanings. */
export function sentenceTemplateKey(hanzi: string) {
  const roles = new Map<string, number>();
  return sentenceTextKey(hanzi)
    .replace(QUANTITIES, "〈数〉")
    .replace(DIGITS, "〈数〉")
    .replace(PRONOUNS, (pronoun) => {
      if (!roles.has(pronoun)) {
        roles.set(pronoun, roles.size);
      }
      return `〈人${roles.get(pronoun)}〉`;
    })
    .replace(SPEAKING_FRAME, "$1说");
}

/**
 * Report every pair sharing punctuation-independent text or a superficial teaching template.
 * Keep repeated words intact: 看 and 看看, or 人人 and 人, teach different constructions.
 * Editorial review handles semantic similarity and suitability beyond these narrow checks.
 */
export function findSentenceConflicts(
  sentences: readonly SentenceIdentity[]
): SentenceConflict[] {
  const templates = new Map<string, SentenceIdentity[]>();
  const conflicts: SentenceConflict[] = [];
  for (const sentence of sentences) {
    const key = sentenceTemplateKey(sentence.hanzi);
    const earlier = templates.get(key) ?? [];
    for (const first of earlier) {
      conflicts.push({
        first: first.id,
        second: sentence.id,
        kind:
          sentenceTextKey(first.hanzi) === sentenceTextKey(sentence.hanzi)
            ? "exact"
            : "template",
      });
    }
    earlier.push(sentence);
    templates.set(key, earlier);
  }
  return conflicts;
}

const text = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const sentenceFields = {
  id: text,
  hanzi: text,
  pinyin: text,
  meaning: text,
};
const authoredSchema = z.array(z.strictObject(sentenceFields));
export const reviewedSentencesSchema = z.strictObject({
  version: z.literal(1),
  sentences: z.array(
    z.strictObject({
      ...sentenceFields,
      source: z.number().int().positive().safe(),
      review: z.strictObject({
        decision: z.literal("include"),
        reason: text,
      }),
      allowSimilarTo: z
        .array(z.strictObject({ id: text, reason: text }))
        .optional(),
    })
  ),
});

export type ReviewedSentences = z.infer<typeof reviewedSentencesSchema>;

export interface SelectedSentence {
  anchor: string;
  hanzi: string;
  id: string;
  meaning: string;
  pinyin: string;
  source: number | null;
  words: string[];
}

const HAN = /\p{Script=Han}/u;
const LATIN = /\p{Script=Latin}/u;
const TATOEBA_ID = /^t\d+$/;
const SUPPORTED_TEXT = /^[\p{Script=Han}\p{N}\p{P}\p{Z}\s]+$/u;

function validateIdentities(
  entries: readonly { id: string; source: number | null }[]
) {
  const ids = new Set<string>();
  const sources = new Set<number>();
  for (const sentence of entries) {
    if (ids.has(sentence.id)) {
      throw new Error(`Duplicate sentence id: ${sentence.id}`);
    }
    ids.add(sentence.id);
    if (sentence.source !== null) {
      if (sources.has(sentence.source)) {
        throw new Error(`Duplicate Tatoeba source: ${sentence.source}`);
      }
      sources.add(sentence.source);
      if (sentence.id !== `t${sentence.source}`) {
        throw new Error(
          `Sentence id must match its Tatoeba source: ${sentence.id}`
        );
      }
    } else if (TATOEBA_ID.test(sentence.id)) {
      throw new Error(
        `Authored sentence cannot use a Tatoeba id: ${sentence.id}`
      );
    }
  }
}

/**
 * Materialize only explicit editorial selections. No length score or language heuristic admits
 * content. The pinned review owns naturalness, standalone usefulness, reading, and translation.
 */
export function selectSentences(
  curriculum: Pick<Curriculum, "characters" | "words">,
  authoredInput: unknown,
  reviewedInput: unknown
): SelectedSentence[] {
  const authored = authoredSchema.parse(authoredInput);
  const reviewed = reviewedSentencesSchema.parse(reviewedInput);
  const imports = [...reviewed.sentences].sort((a, b) => a.source - b.source);
  const entries = [
    ...authored.map((sentence) => ({ ...sentence, source: null })),
    ...imports,
  ];
  validateIdentities(entries);
  const characters = new Set(curriculum.characters.map((item) => item.hanzi));
  const ranks = new Map<string, number>();
  for (const word of curriculum.words) {
    ranks.set(
      word.hanzi,
      Math.min(ranks.get(word.hanzi) ?? Number.POSITIVE_INFINITY, word.rank)
    );
  }
  const words = new Set(ranks.keys());
  const longest = Math.max(
    1,
    ...[...words].map((word) => Array.from(word).length)
  );

  const selected = entries.map((sentence): SelectedSentence => {
    const hanzi = Array.from(sentence.hanzi).filter((glyph) => HAN.test(glyph));
    const missing = [
      ...new Set(hanzi.filter((glyph) => !characters.has(glyph))),
    ];
    if (missing.length > 0) {
      throw new Error(
        `Sentence ${sentence.id} uses non-curriculum characters: ${missing.join("")}`
      );
    }
    if (hanzi.length === 0 || !SUPPORTED_TEXT.test(sentence.hanzi)) {
      throw new Error(
        `Sentence ${sentence.id} must contain supported Chinese text`
      );
    }
    if (HAN.test(sentence.pinyin) || !LATIN.test(sentence.pinyin)) {
      throw new Error(
        `Sentence ${sentence.id} needs explicitly reviewed pinyin`
      );
    }
    const tokens = segmentSentence(sentence.hanzi, words, longest);
    const covered = [
      ...new Set(
        tokens.filter((token) => token.word).map((token) => token.text)
      ),
    ];
    // Preserve the importer's learnability bounds. Authored beginner greetings can be shorter.
    if (
      sentence.source !== null &&
      (hanzi.length < 4 ||
        hanzi.length > 16 ||
        covered.length < 3 ||
        tokens.filter((token) => !token.word).length > 1)
    ) {
      throw new Error(
        `Reviewed sentence ${sentence.id} no longer meets curriculum coverage bounds`
      );
    }
    const [anchor] = [...covered].sort(
      (a, b) => (ranks.get(b) ?? 0) - (ranks.get(a) ?? 0)
    );
    if (!anchor) {
      throw new Error(`Sentence ${sentence.id} has no curriculum word anchor`);
    }
    return {
      id: sentence.id,
      hanzi: sentence.hanzi,
      pinyin: sentence.pinyin,
      meaning: sentence.meaning,
      words: covered,
      anchor,
      source: sentence.source,
    };
  });

  const conflicts = findSentenceConflicts(selected);
  const unresolved = conflicts.filter((conflict) => {
    const sentence = imports.find((entry) => entry.id === conflict.second);
    return (
      conflict.kind === "exact" ||
      !sentence?.allowSimilarTo?.some(
        (exception) => exception.id === conflict.first
      )
    );
  });
  if (unresolved.length > 0) {
    throw new Error(
      `Sentence diversity review required:\n${unresolved.map((conflict) => `${conflict.first} / ${conflict.second} (${conflict.kind})`).join("\n")}`
    );
  }
  for (const sentence of imports) {
    const exceptions = new Set<string>();
    for (const exception of sentence.allowSimilarTo ?? []) {
      if (
        exceptions.has(exception.id) ||
        !conflicts.some(
          (conflict) =>
            conflict.kind === "template" &&
            conflict.first === exception.id &&
            conflict.second === sentence.id
        )
      ) {
        throw new Error(
          `Stale or duplicate diversity exception on ${sentence.id}: ${exception.id}`
        );
      }
      exceptions.add(exception.id);
    }
  }
  return selected;
}
