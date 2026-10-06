import { expect, test } from "bun:test";

import curriculum from "../data/curriculum.generated.json";
import { characterWordEquivalences } from "./character-word-equivalence";
import {
  characterForWord,
  characterIsWord,
  studyIdentity,
} from "./character-words";

function courseWord(hanzi: string) {
  const found = curriculum.words.find((word) => word.hanzi === hanzi);
  if (!found) {
    throw new Error(`Missing course word: ${hanzi}`);
  }
  return found;
}

const wordId = (hanzi: string) => String(courseWord(hanzi).id);

test("single characters share a memory across vocabulary meanings of the same pronunciation", () => {
  for (const hanzi of ["人", "是", "太", "信", "本", "天"]) {
    expect(studyIdentity("word", wordId(hanzi))).toEqual({
      itemType: "character",
      itemId: hanzi,
    });
    expect(characterIsWord(hanzi)).toBeTrue();
  }
});

test("another pronunciation remains a separate reading lesson", () => {
  for (const hanzi of ["干", "待", "长"]) {
    const id = wordId(hanzi);
    expect(characterForWord(id)).toBeUndefined();
    expect(studyIdentity("word", id)).toEqual({ itemType: "word", itemId: id });
  }
  expect(characterForWord(wordId("我们"))).toBeUndefined();
});

test("character equivalence depends on pronunciation, not the chosen English gloss", () => {
  const person = curriculum.characters.find(
    (character) => character.hanzi === "人"
  );
  if (!person) {
    throw new Error("Missing course character: 人");
  }
  const word = courseWord("人");
  const reworded = { ...word, meaning: "a person" };
  expect(characterWordEquivalences([person], [reworded])).toEqual({
    [word.id]: person.id,
  });
  expect(
    characterWordEquivalences([person], [{ ...word, pinyin: "rěn" }])
  ).toEqual({});
});
