import wordCharacters from "../data/character-words.generated.json";
import type { studyItemTypes } from "../data/types";

type StudyItemType = (typeof studyItemTypes)[number];
const charactersWithWords = new Set(Object.values(wordCharacters));

export function characterForWord(wordId: string): string | undefined {
  return (wordCharacters as Record<string, string>)[wordId];
}

export function characterIsWord(characterId: string) {
  return charactersWithWords.has(characterId);
}

export function studyIdentity(itemType: StudyItemType, itemId: string) {
  const characterId =
    itemType === "word" ? characterForWord(itemId) : undefined;
  return characterId
    ? { itemType: "character" as const, itemId: characterId }
    : { itemType, itemId };
}
