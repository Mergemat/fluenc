import curriculumJson from "../data/curriculum.generated.json";
import { sentences as courseSentences, type Sentence } from "../data/sentences";
import type { Curriculum, Word } from "../data/types";

/**
 * The fixed course: characters, words and sentences every learner shares. It ships with the app,
 * so devices never download it as part of their progress.
 */
export function createCatalog(
  curriculum: Pick<Curriculum, "version" | "characters" | "words">,
  sentences: Sentence[]
) {
  return {
    version: curriculum.version,
    characters: curriculum.characters,
    charactersById: new Map(
      curriculum.characters.map((item) => [item.id, item])
    ),
    wordsById: new Map(curriculum.words.map((item) => [String(item.id), item])),
    // The frequency list repeats a spelling with different readings; teach each spelling once.
    uniqueWords: [
      ...curriculum.words
        .reduce((items, item) => {
          if (!items.has(item.hanzi)) {
            items.set(item.hanzi, item);
          }
          return items;
        }, new Map<string, Word>())
        .values(),
    ],
    sentences,
    sentencesById: new Map(sentences.map((item) => [item.id, item])),
  };
}

export type Catalog = ReturnType<typeof createCatalog>;

export const catalog = createCatalog(
  curriculumJson as Curriculum,
  courseSentences
);
