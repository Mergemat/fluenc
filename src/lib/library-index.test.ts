import { expect, test } from "bun:test";

import type { LibraryData } from "./learner-views";
import { librarySections, queueKey, soundKey } from "./library-index";
import { createLibrarySearch, libraryEntries } from "./library-search";
import { getMovieCoordinates } from "./pinyin";

const character = (
  hanzi: string,
  pinyin: string,
  rank: number,
  status: "new" | "learning" | "review" = "new"
): LibraryData["characters"][number] => ({
  id: hanzi,
  hanzi,
  pinyin,
  keyword: hanzi,
  senses: [],
  also: null,
  strokes: 1,
  radical: hanzi,
  readings: [],
  rank,
  status,
  movie: getMovieCoordinates(pinyin),
  components: [{ hanzi, count: 1 }],
  structure: "atomic",
  componentNote: null,
});
const word = (
  hanzi: string,
  pinyin: string,
  meaning: string,
  rank: number
): LibraryData["words"][number] => ({
  id: String(rank),
  hanzi,
  pinyin,
  meaning,
  senses: [],
  also: null,
  rank,
  status: "new",
  syllables: null,
  characterParts: [],
  livingLink: "",
});

test("lists a one-character word once, under its character, and still finds its sense", () => {
  const library: LibraryData = {
    characters: [character("是", "shì", 1, "review")],
    words: [word("是", "shì", "to be", 1), word("是的", "shì de", "yes", 2)],
  };
  expect(libraryEntries(library).map((item) => item.hanzi)).toEqual([
    "是",
    "是的",
  ]);
  const found = createLibrarySearch(library)("to be");
  expect(found[0]).toMatchObject({ hanzi: "是", kind: "characters" });
});

test("files readings under dictionary letters, keeping zh, ch and sh apart", () => {
  expect(soundKey("zhōng")).toBe("zh");
  expect(soundKey("zài")).toBe("z");
  expect(soundKey("Shì de")).toBe("sh");
  expect(soundKey("ài")).toBe("a");
  expect(soundKey("nǚ")).toBe("n");
});

test("groups by sound in alphabetical order, then by reading and tone", () => {
  const entries = libraryEntries({
    characters: [
      character("是", "shì", 1, "review"),
      character("十", "shí", 2),
      character("在", "zài", 3),
      character("爱", "ài", 4),
      character("山", "shān", 5),
    ],
    words: [],
  });
  const sections = librarySections(entries, "sound");
  expect(sections.map((item) => item.key)).toEqual(["a", "sh", "z"]);
  expect(sections[1]?.entries.map((item) => item.hanzi)).toEqual([
    "山",
    "十",
    "是",
  ]);
  expect(sections[1]?.learned).toBe(1);
});

test("splits the course into learning, learned, the next twenty in queue order, and later", () => {
  const entries = libraryEntries({
    characters: [
      character("我", "wǒ", 1, "review"),
      character("你", "nǐ", 2, "learning"),
      ...Array.from({ length: 25 }, (_, index) =>
        character(String.fromCodePoint(0x4e_00 + index), "yī", 10 + index)
      ),
    ],
    words: [],
  });
  // The queue teaches the rarest first; the library must follow it, not frequency.
  const queue = new Map(
    entries
      .filter((entry) => entry.status === "new")
      .toReversed()
      .map((entry, index) => [queueKey(entry.kind, entry.id), index])
  );
  const sections = librarySections(entries, "course", queue);
  expect(sections.map((item) => [item.key, item.entries.length])).toEqual([
    ["learning", 1],
    ["learned", 1],
    ["next", 20],
    ["later", 5],
  ]);
  expect(sections[2]?.entries[0]?.rank).toBe(34);
  expect(sections[3]?.entries.at(-1)?.rank).toBe(10);
});
