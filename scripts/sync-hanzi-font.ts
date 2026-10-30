import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import strokeData from "../assets/strokes.json";
import curriculum from "../src/data/curriculum.generated.json";
import { partCodePoint, partsOf } from "../src/lib/glyph-parts";

// Two fonts from the stroke outlines in assets/strokes.json:
//
// - Fluenc Hanzi: every course character from its own strokes, and every component from the
//   strokes it draws in a course character.
// - Fluenc Hanzi Parts: each part of each course character as its own glyph, in place, so a
//   character can be drawn part by part (see src/lib/glyph-parts.ts).
interface Shape {
  owners: string[];
  strokes: string[];
}
const shapes = new Map(
  Object.entries(strokeData.characters as Record<string, Shape>)
);
const shapeOf = (hanzi: string) => {
  const shape = shapes.get(hanzi);
  if (!shape) {
    throw new Error(`No strokes for ${hanzi}`);
  }
  return shape;
};
const strokesOwnedBy = (shape: Shape, part: string) =>
  shape.strokes.filter((_, index) => shape.owners[index] === part);

interface Glyph {
  codePoint: number;
  normalize: boolean;
  strokes: string[];
}

const codePoint = (text: string) => text.codePointAt(0) ?? 0;
const components = new Set(
  curriculum.characters.flatMap((character) => character.components)
);
const characterGlyphs: Glyph[] = [
  ...new Set([
    ...curriculum.characters.map((character) => character.hanzi),
    ...components,
  ]),
]
  .sort((left, right) => codePoint(left) - codePoint(right))
  .map((glyph) => {
    const own = shapes.get(glyph)?.strokes;
    if (own) {
      return { codePoint: codePoint(glyph), strokes: own, normalize: false };
    }
    // The occurrence with the fewest strokes overall is the least crowded drawing of the part.
    const drawn = curriculum.characters
      .filter((character) => character.components.includes(glyph))
      .map((character) => {
        const shape = shapeOf(character.hanzi);
        return {
          size: shape.strokes.length,
          strokes: strokesOwnedBy(shape, glyph),
          repeated:
            character.components.filter((part) => part === glyph).length > 1,
        };
      })
      .filter((part) => part.strokes.length && !part.repeated)
      .sort((left, right) => left.size - right.size)[0]?.strokes;
    if (!drawn?.length) {
      throw new Error(`No glyph outlines for ${glyph}`);
    }
    return { codePoint: codePoint(glyph), strokes: drawn, normalize: true };
  });

// Every part must draw something, or the character couldn't be shown part by part.
const partGlyphs: Glyph[] = curriculum.characters.flatMap((character) =>
  partsOf(character).map((part) => {
    const strokes = strokesOwnedBy(shapeOf(character.hanzi), part);
    const at = partCodePoint(character.hanzi, part);
    if (!(strokes.length && at)) {
      throw new Error(`${character.hanzi} draws nothing for its part ${part}`);
    }
    return { codePoint: at, strokes, normalize: false };
  })
);

async function encode(family: string, output: string, glyphs: Glyph[]) {
  const directory = await mkdtemp(join(tmpdir(), "fluenc-hanzi-font-"));
  try {
    const input = join(directory, "glyphs.json");
    await Bun.write(input, JSON.stringify({ family, output, glyphs }));
    const encoder = Bun.spawn(
      [
        Bun.env.FLUENC_FONT_PYTHON ?? "python3",
        "scripts/build-hanzi-font.py",
        input,
      ],
      { stdout: "inherit", stderr: "inherit" }
    );
    if ((await encoder.exited) !== 0) {
      throw new Error("Font generation failed; see the Python error above.");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

await encode(
  "Fluenc Hanzi",
  "assets/fonts/fluenc-hanzi.woff2",
  characterGlyphs
);
await encode(
  "Fluenc Hanzi Parts",
  "assets/fonts/fluenc-hanzi-parts.woff2",
  partGlyphs
);
