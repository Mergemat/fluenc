// A course character drawn as its parts. In the parts font (scripts/sync-hanzi-font.ts) each course
// character is a colour glyph with one layer per part, and the layer's palette slot is the part's
// place in `glyphParts`.
import curriculum from "../data/curriculum.generated.json";
import { directCharacters } from "./character-props";

/** The parts a character is taught as, each once: the props it is drawn from. */
export const partsOf = (character: { hanzi: string; components: string[] }) =>
  directCharacters.has(character.hanzi)
    ? [character.hanzi]
    : [...new Set(character.components)];

const places = new Map(
  curriculum.characters.map((character) => [
    character.hanzi,
    partsOf(character),
  ])
);

/** The parts the parts font draws `hanzi` as, in slot order; null for a character outside the course. */
export const glyphParts = (hanzi: string) => places.get(hanzi) ?? null;

/**
 * The font's own palette: one colour per slot, far apart, so a canvas drawing of a character tells
 * which part covers each pixel. The page draws with palettes of its own.
 */
export const SLOT_COLORS: [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
];
