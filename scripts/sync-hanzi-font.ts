import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import curriculum from "../src/data/curriculum.generated.json";

// Every glyph comes from the vendored stroke files in assets/strokes: a course character from its
// own file, a component from the strokes it draws in a course character.
const lessonShapes = new Map(
  await Promise.all(
    curriculum.characters.map(
      async (character) =>
        [
          character.hanzi,
          (await Bun.file(`assets/strokes/${character.hanzi}.json`).json()) as {
            strokes: string[];
            owners: string[];
          },
        ] as const
    )
  )
);
const components = new Set(
  curriculum.characters.flatMap((character) => character.components)
);
const glyphs = [...new Set([...lessonShapes.keys(), ...components])]
  .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
  .map((character) => {
    const strokes = lessonShapes.get(character)?.strokes;
    if (strokes) {
      return { character, strokes, normalize: false };
    }
    // The occurrence with the fewest strokes overall is the least crowded drawing of the part.
    const parts = curriculum.characters
      .filter((entry) => entry.components.includes(character))
      .map((entry) => {
        const shape = lessonShapes.get(entry.hanzi);
        return {
          size: shape?.strokes.length ?? 0,
          strokes:
            shape?.strokes.filter(
              (_, index) => shape.owners[index] === character
            ) ?? [],
          repeated:
            entry.components.filter((part) => part === character).length > 1,
        };
      })
      .filter((part) => part.strokes.length && !part.repeated)
      .sort((left, right) => left.size - right.size)[0]?.strokes;
    if (!parts?.length) {
      throw new Error(`No glyph outlines for ${character}`);
    }
    return { character, strokes: parts, normalize: true };
  });

const directory = await mkdtemp(join(tmpdir(), "fluenc-hanzi-font-"));
try {
  const input = join(directory, "glyphs.json");
  await Bun.write(input, JSON.stringify(glyphs));
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
