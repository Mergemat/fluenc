import curriculumJson from "../data/curriculum.generated.json";
import type { Curriculum } from "../data/types";
import { parseSyllable, splitReading } from "./pinyin-syllables";

const readings = new Map(
  (curriculumJson as Curriculum).characters.map((character) => [
    character.hanzi,
    new Set(
      [character.pinyin, ...character.readings.map((item) => item.pinyin)]
        .map((pinyin) => parseSyllable(pinyin)?.base)
        .filter((base) => base !== undefined)
    ),
  ])
);

const erReadings = new Set(["er", "r"]);

/**
 * Split a word's pinyin into one syllable per character, keeping its spelling and tones (东西
 * keeps neutral "xi"). Each course character must take one of its database readings. Returns null
 * when the reading does not line up, so callers can fall back to the whole reading.
 */
export function wordSyllables(hanzi: string, reading: string): string[] | null {
  return splitReading(hanzi, reading, (character) =>
    character === "儿" ? erReadings : readings.get(character)
  );
}
