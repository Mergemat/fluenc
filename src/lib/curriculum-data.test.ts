import { expect, test } from "bun:test";
import strokeData from "../../assets/strokes.json";

import curriculumJson from "../data/curriculum.generated.json";
import characterJson from "../data/hanzi/characters.json";
import componentJson from "../data/hanzi/components.json";
import wordJson from "../data/hanzi/words.json";
import type { Curriculum } from "../data/types";
import { directCharacters } from "./character-props";
import {
  characterSchema,
  componentSchema,
  databaseProblems,
  isTaught,
  wordSchema,
} from "./hanzi-db";

const curriculum = curriculumJson as Curriculum;
const characters = characterSchema.array().parse(characterJson);
const words = wordSchema.array().parse(wordJson);
const components = componentSchema.array().parse(componentJson);

test("the character database has no broken references, duplicates or bad readings", () => {
  expect(databaseProblems(characters, words, components)).toEqual([]);
});

test("the generated curriculum is up to date with the database", () => {
  const stale = [
    ...characters.flatMap((entry) => {
      const generated = curriculum.characters.find(
        (item) => item.hanzi === entry.hanzi
      );
      return generated?.pinyin === entry.pinyin &&
        generated.keyword === entry.keyword &&
        generated.components.join() === entry.components.join()
        ? []
        : [entry.hanzi];
    }),
    ...words.filter(isTaught).flatMap((entry) => {
      const generated = curriculum.words.find((item) => item.id === entry.id);
      return generated?.pinyin === entry.pinyin &&
        generated.meaning === entry.meaning
        ? []
        : [entry.hanzi];
    }),
  ];
  expect(stale).toEqual([]);
  expect(curriculum.characters).toHaveLength(characters.length);
});

test("every character's strokes draw each of its props, and only those", () => {
  const problems: string[] = [];
  const shapes = strokeData.characters as Record<
    string,
    { owners: string[]; strokes: string[] }
  >;
  for (const character of curriculum.characters) {
    const shape = shapes[character.hanzi];
    if (!shape) {
      problems.push(`${character.hanzi}: no strokes`);
      continue;
    }
    const parts = directCharacters.has(character.hanzi)
      ? [character.hanzi]
      : character.components;
    if (shape.owners.length !== shape.strokes.length) {
      problems.push(`${character.hanzi}: owners miss strokes`);
    }
    if (
      [...new Set(shape.owners)].sort().join() !==
      [...new Set(parts)].sort().join()
    ) {
      problems.push(
        `${character.hanzi}: owners ${[...new Set(shape.owners)].join("")}`
      );
    }
    if (parts.length > 1) {
      for (const part of new Set(parts)) {
        const owned = shape.owners.filter((owner) => owner === part).length;
        const expected =
          (curriculum.props[part]?.strokes ?? 0) *
          parts.filter((item) => item === part).length;
        if (owned !== expected) {
          problems.push(
            `${character.hanzi}: ${part} draws ${owned} strokes, its prop has ${expected}`
          );
        }
      }
    }
    if (shape.strokes.length !== character.strokes) {
      problems.push(
        `${character.hanzi}: ${shape.strokes.length} strokes drawn, ${character.strokes} listed`
      );
    }
  }
  expect(problems).toEqual([]);
});
