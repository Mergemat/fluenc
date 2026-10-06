import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import source from "../src/data/character-strokes.source.json";
import curriculum from "../src/data/curriculum.generated.json";
import reviewed from "../src/data/reviewed-compositions.json";
import { sentences } from "../src/data/sentences";

const characters = new Set(
  curriculum.characters.flatMap((character) => [
    character.hanzi,
    ...character.components,
  ])
);
for (const entry of reviewed) {
  for (const character of [entry.character, ...entry.components]) {
    characters.add(character);
  }
}
for (const sentence of sentences) {
  for (const character of Array.from(sentence.hanzi)) {
    if (/\p{Script=Han}/u.test(character)) {
      characters.add(character);
    }
  }
}

const response = await fetch(
  source.dictionary.replace("dictionary.txt", "graphics.txt")
);
if (!response.ok) {
  throw new Error(`Could not load glyph source: ${response.status}`);
}
const graphics = new Map(
  (await response.text())
    .trim()
    .split("\n")
    .map((line) => {
      const entry = JSON.parse(line) as {
        character: string;
        strokes: string[];
      };
      return [entry.character, entry.strokes];
    })
);
const lessonShapes = new Map(
  await Promise.all(
    curriculum.characters.map(
      async (character) =>
        [
          character.hanzi,
          (await Bun.file(`public/hanzi/${character.hanzi}.json`).json()) as {
            strokes: string[];
            owners: string[];
          },
        ] as const
    )
  )
);
const glyphs = [...characters]
  .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
  .map((character) => {
    const strokes =
      lessonShapes.get(character)?.strokes ?? graphics.get(character);
    if (strokes) {
      return { character, strokes, normalize: false };
    }
    // A standalone component uses the same outlines as its one occurrence in a lesson.
    const parent = curriculum.characters.find(
      (entry) =>
        entry.components.filter((part) => part === character).length === 1
    );
    const shape = parent && lessonShapes.get(parent.hanzi);
    const parts = shape?.strokes.filter(
      (_, index) => shape.owners[index] === character
    );
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
