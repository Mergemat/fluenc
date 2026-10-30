// A course character drawn as its parts. The parts font (scripts/sync-hanzi-font.ts) holds each part
// of each course character as its own glyph, in place, at a private-use code point worked out here,
// so the app and the font build agree on where each part is without a table between them.
import curriculum from "../data/curriculum.generated.json";
import { directCharacters } from "./character-props";

/** The parts a character is taught as, each once: the props it is drawn from. */
export const partsOf = (character: { hanzi: string; components: string[] }) =>
  directCharacters.has(character.hanzi)
    ? [character.hanzi]
    : [...new Set(character.components)];

// Supplementary Private Use Area-A: nothing else the app shows lives here. Parts are numbered in
// teaching order, the order the font is cut into chunks in, so each chunk is a single range.
// Reordering the course, adding characters or changing a character's parts needs the font built again.
const places = new Map<string, { first: number; parts: string[] }>();
let next = 0xf_00_00;
for (const character of curriculum.characters.toSorted(
  (left, right) => left.order - right.order
)) {
  const parts = partsOf(character);
  places.set(character.hanzi, { first: next, parts });
  next += parts.length;
}

/** Where the parts font draws `part` of `hanzi`; null for a character or part it doesn't have. */
export function partCodePoint(hanzi: string, part: string) {
  const place = places.get(hanzi);
  const slot = place?.parts.indexOf(part) ?? -1;
  return place && slot >= 0 ? place.first + slot : null;
}

/** The parts the parts font draws `hanzi` as; null for a character outside the course. */
export const glyphParts = (hanzi: string) => places.get(hanzi)?.parts ?? null;
