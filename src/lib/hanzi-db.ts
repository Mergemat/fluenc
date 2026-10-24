import { z } from "zod";

import { isStandardSyllable, parseSyllable } from "./pinyin-syllables";

const HAN_COMPONENT = /^[\p{Script=Han}⺀-⻿㇀-㇯]$/u;
const LIST_PUNCTUATION = /[,;/]/;

export const isHanziUnit = (value: string) =>
  Array.from(value).length === 1 && HAN_COMPONENT.test(value);

const unit = z.string().refine(isHanziUnit, "One character or component");
const syllable = z
  .string()
  .refine(isStandardSyllable, "One syllable with a standard tone mark");
const gloss = z.string().trim().min(1).max(80);
const sources = z.array(z.url({ protocol: /^https$/ })).min(1);

export const characterSchema = z.strictObject({
  hanzi: unit,
  /** The reading the course teaches. */
  pinyin: syllable,
  /** The one English word the learner's movie is about; unique across the course. */
  keyword: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((value) => !LIST_PUNCTUATION.test(value), "One keyword"),
  /** Senses of the taught reading, most useful first. */
  meanings: z.array(gloss).min(1).max(8),
  /** A short second cue shown beside the keyword, or null. */
  also: gloss.nullable(),
  /** Other readings in common use, with their senses. */
  readings: z.array(
    z.object({ pinyin: syllable, meanings: z.array(gloss).min(1).max(6) })
  ),
  strokes: z.int().min(1).max(40),
  radical: unit,
  /** How the character is taught: as one shape, or assembled from props. */
  structure: z.enum(["atomic", "compound"]),
  /** The props of the movie, in writing order. Repeated props are listed each time. */
  components: z.array(unit).min(1).max(6),
  /** Learner guidance for an unusual assembly, or null. */
  note: z.string().trim().min(1).max(240).nullable(),
  sources,
});

const wordIdentity = z.object({
  id: z.int().positive(),
  hanzi: z.string().min(1),
});

export const wordSchema = z.union([
  z.strictObject({
    ...wordIdentity.shape,
    pinyin: z.string().min(1),
    /** One syllable per character; 儿 after a syllable is "r". */
    syllables: z.array(z.string()).min(1),
    meaning: gloss,
    meanings: z.array(gloss).min(1).max(8),
    also: gloss.nullable(),
    sources,
  }),
  z.strictObject({
    ...wordIdentity.shape,
    exclude: z.string().trim().min(1),
  }),
]);

export const componentSchema = z.strictObject({
  hanzi: unit,
  /** A concrete, picturable object the learner can reuse in every movie with this part. */
  prop: z.string().trim().min(1).max(40),
  /** What the part means or depicts. */
  meaning: gloss,
  /** The full form this part is a variant of, such as 水 for 氵, or null. */
  variantOf: unit.nullable(),
  strokes: z.int().min(1).max(30),
});

export type CharacterEntry = z.infer<typeof characterSchema>;
export type WordEntry = z.infer<typeof wordSchema>;
export type ComponentEntry = z.infer<typeof componentSchema>;
export type TaughtWord = Extract<WordEntry, { meaning: string }>;

export const isTaught = (word: WordEntry): word is TaughtWord =>
  "meaning" in word;

const normalize = (value: string) =>
  value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s'’-]/g, "");

/** Every way a character may be read, without tones. */
export function readingsOf(character: CharacterEntry) {
  return new Set(
    [character.pinyin, ...character.readings.map((item) => item.pinyin)]
      .map((item) => parseSyllable(item)?.base)
      .filter((item) => item !== undefined)
  );
}

/** Problems in one character entry that don't need the rest of the database. */
export function characterProblems(entry: CharacterEntry) {
  const problems: string[] = [];
  if (entry.structure === "atomic") {
    if (entry.components.join("") !== entry.hanzi) {
      problems.push("an atomic character is its own single component");
    }
    if (entry.note) {
      problems.push("a whole-shape lesson needs no assembly note");
    }
  } else if (entry.components.includes(entry.hanzi)) {
    problems.push("a compound character cannot contain itself");
  } else if (entry.components.length < 2) {
    problems.push("a compound character has at least two components");
  }
  if (entry.readings.some((reading) => reading.pinyin === entry.pinyin)) {
    problems.push("other readings repeat the taught reading");
  }
  if (entry.also && normalize(entry.also) === normalize(entry.keyword)) {
    problems.push("also repeats the keyword");
  }
  return problems;
}

/** Problems in one word entry, given the characters it may use. */
export function wordProblems(
  entry: TaughtWord,
  characters: ReadonlyMap<string, CharacterEntry>
) {
  const problems: string[] = [];
  const spelling = Array.from(entry.hanzi);
  if (entry.syllables.length !== spelling.length) {
    problems.push("one syllable per character");
  }
  if (normalize(entry.syllables.join("")) !== normalize(entry.pinyin)) {
    problems.push("syllables do not spell the reading");
  }
  for (const [index, character] of spelling.entries()) {
    const piece = entry.syllables[index] ?? "";
    const known = characters.get(character);
    if (!known) {
      problems.push(`${character} is not a course character`);
      continue;
    }
    if (piece === "r" && character === "儿" && index > 0) {
      continue;
    }
    const parsed = isStandardSyllable(piece) ? parseSyllable(piece) : null;
    if (!parsed) {
      problems.push(`${piece} is not a standard syllable`);
    } else if (!readingsOf(known).has(parsed.base)) {
      problems.push(`${character} is never read ${parsed.base}`);
    }
  }
  if (entry.also && normalize(entry.also) === normalize(entry.meaning)) {
    problems.push("also repeats the meaning");
  }
  return problems;
}

/** Each key that appears more than once, as a problem. */
function duplicateProblems(label: string, keys: readonly string[]) {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) {
      problems.push(`duplicate ${label}: ${key}`);
    }
    seen.add(key);
  }
  return problems;
}

/** Problems with a character's props: each must exist and together they draw every stroke once. */
function propProblems(
  character: CharacterEntry,
  props: ReadonlyMap<string, ComponentEntry>
) {
  const problems: string[] = [];
  if (character.structure === "compound") {
    for (const part of character.components) {
      if (!props.has(part)) {
        problems.push(`${part} has no prop`);
      }
    }
    const drawn = character.components.reduce(
      (sum, part) => sum + (props.get(part)?.strokes ?? 0),
      0
    );
    if (drawn !== character.strokes) {
      problems.push(
        `props draw ${drawn} strokes, the character has ${character.strokes}`
      );
    }
  }
  const own = props.get(character.hanzi);
  if (own && own.strokes !== character.strokes) {
    problems.push("its prop has a different stroke count");
  }
  return problems;
}

/** Problems that span the database: references, coverage and uniqueness. */
export function databaseProblems(
  characters: readonly CharacterEntry[],
  words: readonly WordEntry[],
  components: readonly ComponentEntry[]
) {
  const taught = words.filter(isTaught);
  const problems = [
    ...duplicateProblems(
      "character",
      characters.map((item) => item.hanzi)
    ),
    ...duplicateProblems(
      "keyword",
      characters.map((item) => normalize(item.keyword))
    ),
    ...duplicateProblems(
      "word id",
      words.map((item) => String(item.id))
    ),
    ...duplicateProblems(
      "word reading",
      taught.map((item) => `${item.hanzi} ${normalize(item.pinyin)}`)
    ),
    ...duplicateProblems(
      "component",
      components.map((item) => item.hanzi)
    ),
    ...duplicateProblems(
      "prop",
      components.map((item) => normalize(item.prop))
    ),
  ];

  const byHanzi = new Map(characters.map((item) => [item.hanzi, item]));
  const props = new Map(components.map((item) => [item.hanzi, item]));
  for (const character of characters) {
    for (const problem of [
      ...characterProblems(character),
      ...propProblems(character, props),
    ]) {
      problems.push(`${character.hanzi}: ${problem}`);
    }
  }
  const used = new Set(
    characters
      .filter((item) => item.structure === "compound")
      .flatMap((item) => item.components)
  );
  for (const part of components) {
    if (!used.has(part.hanzi)) {
      problems.push(`${part.hanzi}: prop is never used`);
    }
    if (part.variantOf === part.hanzi) {
      problems.push(`${part.hanzi}: a part is not a variant of itself`);
    }
  }
  for (const word of taught) {
    for (const problem of wordProblems(word, byHanzi)) {
      problems.push(`${word.id} ${word.hanzi}: ${problem}`);
    }
  }
  const spelled = new Set(taught.flatMap((item) => Array.from(item.hanzi)));
  for (const character of characters) {
    if (!spelled.has(character.hanzi)) {
      problems.push(`${character.hanzi}: no course word uses it`);
    }
  }
  return problems;
}
