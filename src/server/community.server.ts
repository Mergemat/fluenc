// Characters the course lacks, as learners' agents describe them. One shared version each: the
// first valid description wins, and every later learner who adds the character reuses it.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Converter } from "opencc-js/t2cn";
import { z } from "zod";

import curriculumJson from "../data/curriculum.generated.json";
import hanziReference from "../data/hanzi-reference.generated.json";
import type { Curriculum, OwnCharacter, OwnProp } from "../data/types";
import { db } from "../db";
import { communityCharacters, focusEntries } from "../db/schema";
import { catalog } from "../lib/catalog";
import { isStandardSyllable } from "../lib/pinyin-syllables";
import { propMeaning } from "../lib/props";

const { props } = curriculumJson as Curriculum;
const HAN = /^\p{Script=Han}$/u;
/** A scene holds about three props; more and it stops being one picture. */
const MAX_PROPS = 3;
const KEYWORD = /^[\p{L}'-]+(?: [\p{L}'-]+){0,2}$/u;

export const characterInput = z.object({
  hanzi: z.string().trim(),
  pinyin: z.string().trim(),
  keyword: z.string().trim().min(1).max(30),
  meaning: z.string().trim().min(1).max(120),
  // Checked in `check`, which says how to fix a long list; this only bounds the input.
  props: z.array(z.string().trim().min(1)).min(1).max(12),
});
export type CharacterInput = z.input<typeof characterInput>;

const toSimplified = Converter({ from: "t", to: "cn" });

/** The simplified spelling when `text` is written in traditional characters, else null. */
export function simplifiedOf(text: string) {
  const simplified = toSimplified(text);
  return simplified === text ? null : simplified;
}

/** Characters an entry uses that the course lacks, each once, in order. */
export const missingCharacters = (hanzi: string) => [
  ...new Set(
    Array.from(hanzi).filter(
      (character) =>
        HAN.test(character) && !catalog.charactersById.has(character)
    )
  ),
];

/** A prop as an agent reads it: "忄 heart 3", its strokes last. */
const propLine = (prop: string) =>
  `${prop} ${propMeaning(prop) ?? "?"} ${props[prop]?.strokes ?? "?"}`;

/** Every prop an agent may build a character from, one per line. */
export const propList = () => Object.keys(props).map(propLine).join("\n");

interface Reference {
  gloss: string;
  /** Its parts as an ideographic description, like ⿰忄尤; ？ marks a part it can't name. */
  parts: string;
  pinyin: string[];
  strokes: number;
}
const reference = hanziReference.characters as Record<string, Reference>;
const DESCRIPTION_SYMBOL = /[\u2FF0-\u2FFF？]/u;

/**
 * A prop the course lacks, from the stroke reference: as in the Hanzi Movie Method, a character
 * or part the learner hasn't met becomes a prop when a bigger character needs it.
 */
function ownProp(hanzi: string): OwnProp | null {
  const known = reference[hanzi];
  if (props[hanzi] || !known) {
    return null;
  }
  return {
    hanzi,
    strokes: known.strokes,
    meaning:
      catalog.charactersById.get(hanzi)?.keyword ||
      known.gloss.split(";")[0]?.trim() ||
      hanzi,
  };
}

const strokesOf = (prop: string) =>
  props[prop]?.strokes ?? ownProp(prop)?.strokes ?? 0;

/** The props among `components` the course lacks, for devices to draw and gloss. */
function ownParts(hanzi: string, components: readonly string[]) {
  return [...new Set(components)]
    .filter((prop) => prop !== hanzi)
    .flatMap((prop) => ownProp(prop) ?? []);
}

const directParts = (hanzi: string) =>
  Array.from(reference[hanzi]?.parts ?? "").filter(
    (part) => !DESCRIPTION_SYMBOL.test(part)
  );

/** Every part the reference draws a character from, at any depth. */
function allParts(hanzi: string, found = new Set<string>()) {
  for (const part of directParts(hanzi)) {
    if (!found.has(part)) {
      found.add(part);
      allParts(part, found);
    }
  }
  return found;
}

/**
 * Whether props draw a character the reference describes: their strokes add up to its count, and
 * at least one is a real part of it. The course's own decompositions pass both but for 3 of 682,
 * since the reference splits some shapes differently; props agree with it on strokes everywhere.
 */
function drawingProblem(hanzi: string, components: string[]) {
  const known = reference[hanzi];
  if (!known) {
    return null;
  }
  const drawn = components.reduce((sum, prop) => sum + strokesOf(prop), 0);
  if (drawn !== known.strokes) {
    return `props ${components.join(" ")} draw ${drawn} strokes but ${hanzi} has ${known.strokes}; choose props that draw each stroke once`;
  }
  const parts = allParts(hanzi);
  const real = (prop: string) =>
    parts.has(prop) || parts.has(props[prop]?.variantOf ?? "");
  if (directParts(hanzi).length && !components.some(real)) {
    return `none of ${components.join(" ")} is part of ${hanzi}, which is drawn ${known.parts}`;
  }
  return null;
}

const courseKeywords = new Map(
  catalog.characters.map((item) => [item.keyword.toLowerCase(), item.hanzi])
);

/** Why a description of one character fails, checked in the order an agent fixes it. */
function check(
  input: CharacterInput,
  takenKeywords: ReadonlyMap<string, string>
): OwnCharacter | string {
  const hanzi = input.hanzi.trim();
  if (!HAN.test(hanzi)) {
    return "hanzi must be exactly one Chinese character";
  }
  const simplified = simplifiedOf(hanzi);
  if (simplified) {
    return `${hanzi} is traditional; describe ${simplified} instead`;
  }
  const pinyin = input.pinyin.trim().normalize("NFC").toLowerCase();
  if (!isStandardSyllable(pinyin) || pinyin === "r") {
    return `pinyin "${input.pinyin}" is not one syllable with a standard tone mark, like yōu`;
  }
  const readings = reference[hanzi]?.pinyin;
  if (readings && !readings.includes(pinyin)) {
    return `${hanzi} reads ${readings.join(" or ")}, not ${pinyin}`;
  }
  const keyword = input.keyword.trim();
  if (!KEYWORD.test(keyword)) {
    return `keyword "${keyword}" should be 1–3 plain words, like fret`;
  }
  const owner = takenKeywords.get(keyword.toLowerCase());
  if (owner && owner !== hanzi) {
    return `keyword "${keyword}" already belongs to ${owner}; choose another`;
  }
  const components = input.props.map((prop) => prop.trim());
  const whole = components.length === 1 && components[0] === hanzi;
  const unknown = components.filter(
    (prop) => !(whole || props[prop] || ownProp(prop))
  );
  if (unknown.length) {
    return `${unknown.join(" ")} ${unknown.length === 1 ? "is not a prop" : "are not props"}; use props from check_hanzi or list_props, or [${hanzi}] alone for a shape that splits into none`;
  }
  if (components.length > MAX_PROPS) {
    return `${components.length} props; describe ${hanzi} with at most ${MAX_PROPS}, using bigger props that each draw several of these`;
  }
  const problem = whole ? null : drawingProblem(hanzi, components);
  if (problem) {
    return problem;
  }
  // Shared with every learner who adds the character, so the reference's gloss stands in for the
  // agent's own words wherever there is one.
  const gloss = reference[hanzi]?.gloss.split(";")[0]?.trim();
  const parts = ownParts(hanzi, components);
  return {
    hanzi,
    pinyin,
    keyword,
    meaning: gloss || input.meaning.trim(),
    components,
    ...(parts.length ? { parts } : {}),
  };
}

// Parts are worked out again on every read, so a row stores only what the agent chose.
const definition = (row: OwnCharacter): OwnCharacter => {
  const parts = ownParts(row.hanzi, row.components);
  return {
    hanzi: row.hanzi,
    pinyin: row.pinyin,
    keyword: row.keyword,
    meaning: row.meaning,
    components: row.components,
    ...(parts.length ? { parts } : {}),
  };
};

/** The descriptions that pass, and why the rest don't. */
async function checkAll(descriptions: CharacterInput[]) {
  const shared = descriptions.length
    ? await db
        .select({
          keyword: communityCharacters.keyword,
          hanzi: communityCharacters.hanzi,
        })
        .from(communityCharacters)
    : [];
  const taken = new Map([
    ...courseKeywords,
    ...shared.map((row) => [row.keyword.toLowerCase(), row.hanzi] as const),
  ]);
  const valid: OwnCharacter[] = [];
  const problems = new Map<string, string>();
  for (const input of descriptions) {
    const result = check(input, taken);
    if (typeof result === "string") {
      problems.set(input.hanzi.trim(), result);
    } else {
      taken.set(result.keyword.toLowerCase(), result.hanzi);
      valid.push(result);
    }
  }
  return { valid, problems };
}

/**
 * Share new characters, once an entry that uses them is saved. Another learner may have described
 * one a moment earlier; theirs stands. Returns the stored versions and who described each.
 */
export async function share(characters: OwnCharacter[], learnerId: string) {
  if (!characters.length) {
    return new Map<string, { character: OwnCharacter; createdBy: string }>();
  }
  await db
    .insert(communityCharacters)
    .values(
      characters.map(({ parts: _parts, ...item }) => ({
        ...item,
        createdBy: learnerId,
      }))
    )
    .onConflictDoNothing();
  const stored = await db
    .select()
    .from(communityCharacters)
    .where(
      inArray(
        communityCharacters.hanzi,
        characters.map((item) => item.hanzi)
      )
    );
  return new Map(
    stored.map((row) => [
      row.hanzi,
      { character: definition(row), createdBy: row.createdBy },
    ])
  );
}

/**
 * Definitions for characters the course lacks: the shared version where there is one, otherwise
 * the agent's description, which is `fresh` until `share` stores it. Characters with neither come
 * back as problems to show the agent.
 */
export async function resolveCharacters(
  hanzi: string[],
  supplied: CharacterInput[]
) {
  const existing = hanzi.length
    ? await db
        .select()
        .from(communityCharacters)
        .where(inArray(communityCharacters.hanzi, hanzi))
    : [];
  const sharedHanzi = new Set(existing.map((row) => row.hanzi));
  const wanted = new Set(
    hanzi.filter((character) => !sharedHanzi.has(character))
  );
  const { valid, problems } = await checkAll(
    supplied.filter((input) => wanted.has(input.hanzi.trim()))
  );
  const found = new Map<string, OwnCharacter>(
    [...existing.map(definition), ...valid].map((item) => [item.hanzi, item])
  );
  for (const character of wanted) {
    if (!(found.has(character) || problems.has(character))) {
      problems.set(
        character,
        "not in fluenc yet; describe it in characters (see list_props)"
      );
    }
  }
  return {
    found,
    fresh: new Set(valid.map((item) => item.hanzi)),
    problems,
  };
}

/**
 * New descriptions of characters the learner described, checked as `resolveCharacters` checks
 * fresh ones. Characters another learner described stay as they are.
 */
export async function checkRedescribed(
  learnerId: string,
  supplied: CharacterInput[]
) {
  const hanzi = supplied.map((input) => input.hanzi.trim());
  const rows = hanzi.length
    ? await db
        .select()
        .from(communityCharacters)
        .where(inArray(communityCharacters.hanzi, hanzi))
    : [];
  const stored = new Map(rows.map((row) => [row.hanzi, row]));
  const mine = (input: CharacterInput) =>
    stored.get(input.hanzi.trim())?.createdBy === learnerId;
  const { valid, problems } = await checkAll(supplied.filter(mine));
  for (const character of hanzi) {
    const row = stored.get(character);
    if (!row) {
      problems.set(
        character,
        "nobody has described it yet; add it with add_to_focus"
      );
    } else if (row.createdBy !== learnerId) {
      problems.set(
        character,
        "another learner described it, so it stays as it is"
      );
    }
  }
  return {
    valid,
    problems,
    before: new Map(
      valid.flatMap((item) => {
        const row = stored.get(item.hanzi);
        return row ? [[item.hanzi, definition(row)] as const] : [];
      })
    ),
  };
}

/** Store new descriptions of characters the learner described. */
export async function restate(characters: OwnCharacter[], learnerId: string) {
  const [first, ...rest] = characters.map((item) =>
    db
      .update(communityCharacters)
      .set({
        pinyin: item.pinyin,
        keyword: item.keyword,
        meaning: item.meaning,
        components: item.components,
      })
      .where(
        and(
          eq(communityCharacters.hanzi, item.hanzi),
          eq(communityCharacters.createdBy, learnerId)
        )
      )
  );
  if (first) {
    await db.batch([first, ...rest]);
  }
}

/**
 * The course props that are real parts of a character, largest first, so most descriptions need
 * no prop list. A character that is itself a prop is drawn whole by that one prop.
 */
function suggestedProps(hanzi: string) {
  if (props[hanzi]) {
    return [`${propLine(hanzi)}: a prop itself, so props [${hanzi}]`];
  }
  const parts = allParts(hanzi);
  const course = Object.keys(props).filter(
    (prop) => parts.has(prop) || parts.has(props[prop]?.variantOf ?? "")
  );
  // Its direct parts the course lacks, which become new props: often the one that keeps a
  // description within three.
  const fresh = directParts(hanzi).flatMap((part) => ownProp(part) ?? []);
  return [
    ...course.map((prop) => ({
      strokes: strokesOf(prop),
      line: propLine(prop),
    })),
    ...fresh.map((part) => ({
      strokes: part.strokes,
      line: `${part.hanzi} ${part.meaning} ${part.strokes} (new prop)`,
    })),
  ]
    .toSorted((left, right) => right.strokes - left.strokes)
    .map((item) => item.line);
}

/**
 * What fluenc knows about the characters of `texts`, sized for an agent's context: characters it
 * already teaches or shares as bare hanzi, and full detail only for the ones it must describe.
 */
export async function lookupHanzi(texts: string[], learnerId: string) {
  const characters = [
    ...new Set(
      texts.flatMap((text) =>
        Array.from(text).filter((character) => HAN.test(character))
      )
    ),
  ];
  const shared = await db
    .select()
    .from(communityCharacters)
    .where(inArray(communityCharacters.hanzi, characters));
  const sharedHanzi = new Set(shared.map((row) => row.hanzi));
  const course = characters.filter((hanzi) =>
    catalog.charactersById.has(hanzi)
  );
  const fresh = characters.filter(
    (hanzi) => !(catalog.charactersById.has(hanzi) || sharedHanzi.has(hanzi))
  );
  const traditional = Object.fromEntries(
    [...texts, ...fresh].flatMap((text) => {
      const simplified = simplifiedOf(text);
      return simplified ? [[text, simplified]] : [];
    })
  );
  return {
    inCourse: course.join(""),
    shared: shared.map(
      (row) =>
        `${row.hanzi} ${row.pinyin} ${row.keyword} (${row.components.join(" ")})${row.createdBy === learnerId ? " · yours" : ""}`
    ),
    ...(Object.keys(traditional).length ? { traditional } : {}),
    new: fresh
      .filter((hanzi) => !traditional[hanzi])
      .map((hanzi) => {
        const known = reference[hanzi];
        return known
          ? {
              hanzi,
              strokes: known.strokes,
              parts: known.parts,
              pinyin: known.pinyin.join(" "),
              gloss: known.gloss,
              props: suggestedProps(hanzi),
            }
          : { hanzi, note: "not in the stroke reference; unchecked" };
      }),
  };
}

/** Every shared character, with how many learners' focus uses it, most used first. */
export async function listCommunity() {
  const [rows, entries] = await Promise.all([
    db.select().from(communityCharacters),
    db
      .select({
        learnerId: focusEntries.learnerId,
        characters: focusEntries.characters,
      })
      .from(focusEntries)
      .where(isNull(focusEntries.removedAt)),
  ]);
  const learners = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (const item of entry.characters ?? []) {
      const set = learners.get(item.hanzi) ?? new Set<string>();
      set.add(entry.learnerId);
      learners.set(item.hanzi, set);
    }
  }
  return rows
    .map((row) => ({
      ...definition(row),
      learners: learners.get(row.hanzi)?.size ?? 0,
    }))
    .toSorted((left, right) => right.learners - left.learners);
}

/** Stop sharing a character; learners who have it keep their copy. */
export async function removeCommunity(hanzi: string[]) {
  const removed = await db
    .delete(communityCharacters)
    .where(inArray(communityCharacters.hanzi, hanzi))
    .returning({ hanzi: communityCharacters.hanzi });
  return removed.length;
}
