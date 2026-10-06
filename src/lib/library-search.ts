import Fuse from "fuse.js";
import type { LibraryData, PalaceData } from "./learner-views";
import { getItemMeaning } from "./meaning";

export type LibraryKind = "characters" | "words";
export type LibraryCharacter = LibraryData["characters"][number] & {
  kind: "characters";
  approximate?: boolean;
};
export type LibraryWord = LibraryData["words"][number] & {
  kind: "words";
  approximate?: boolean;
};
export type LibraryEntry = LibraryCharacter | LibraryWord;

/** Toneless pinyin with ü as v: decomposing splits tone marks (and ü's diaeresis) off their letters. */
function normalizePinyin(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/u\u0308|u:|v/g, "v")
    .replace(/[\u0300-\u036f1-5\s'’-]/g, "");
}

/** The learner's clue names for an entry, from its movie codes and saved palace names. */
export function entryClueNames(
  item: LibraryEntry,
  palace?: PalaceData
): string[] {
  if (item.kind === "words") {
    return item.livingLink ? [item.livingLink] : [];
  }
  if (!palace) {
    return [];
  }
  return [
    palace.actors.find((actor) => actor.key === item.movie.actorKey)?.name,
    palace.sets.find((set) => set.key === item.movie.finalKey)?.name,
    palace.rooms.find((room) => room.tone === item.movie.tone)?.name,
    ...item.components.map(
      (part) => palace.props.find((prop) => prop.key === part.hanzi)?.name
    ),
  ].filter((name): name is string => Boolean(name));
}

const WHITESPACE = /\s+/;
const WORD_BREAK = /[^\p{L}\p{N}]+/u;
const PLAIN_PINYIN = /^[a-zv]+$/;

interface SearchEntry {
  hanzi: string;
  item: LibraryEntry;
  meanings: string[];
  notes: string[];
  pinyin: string;
}

/** Every word of the query starts some word of the value. */
const matchesWords = (text: string) => (value: string) => {
  const words = value.toLowerCase().split(WORD_BREAK);
  return text
    .split(WHITESPACE)
    .every((term) => words.some((word) => word.startsWith(term)));
};

/** 0 for an exact match, 1 for a prefix, 2 for a contained word, or null. */
function directScore(entry: SearchEntry, text: string, reading: string) {
  if (
    entry.hanzi === text ||
    entry.pinyin === reading ||
    entry.meanings.some((meaning) => meaning.toLowerCase() === text)
  ) {
    return 0;
  }
  if (
    entry.hanzi.startsWith(text) ||
    (reading && entry.pinyin.startsWith(reading))
  ) {
    return 1;
  }
  const matchesText = matchesWords(text);
  if (
    entry.hanzi.includes(text) ||
    entry.meanings.some(matchesText) ||
    entry.notes.some(matchesText)
  ) {
    return 2;
  }
  return null;
}

export function createLibrarySearch(library: LibraryData, palace?: PalaceData) {
  const entries: SearchEntry[] = (["characters", "words"] as const).flatMap(
    (kind) =>
      library[kind].map((raw) => {
        const item = { ...raw, kind } as LibraryEntry;
        const meaning = getItemMeaning(item);
        return {
          item,
          hanzi: item.hanzi,
          pinyin: normalizePinyin(item.pinyin),
          meanings: [meaning.primary, ...meaning.alternatives],
          notes: entryClueNames(item, palace),
        };
      })
  );
  const options = {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.35,
    minMatchCharLength: 2,
  };
  const textIndex = new Fuse(entries, {
    ...options,
    keys: [
      { name: "hanzi", weight: 3 },
      { name: "meanings", weight: 2 },
      "notes",
    ],
  });
  const pinyinIndex = new Fuse(entries, { ...options, keys: ["pinyin"] });

  /** Typo-tolerant matches, always ranked after direct ones. */
  const fuzzyMatches = (text: string, reading: string) => {
    if (text.length < 3) {
      return [];
    }
    const results = textIndex.search(text);
    return PLAIN_PINYIN.test(reading)
      ? [...results, ...pinyinIndex.search(reading)]
      : results;
  };

  return (query: string): LibraryEntry[] => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return entries.map((entry) => entry.item);
    }
    const reading = normalizePinyin(text);
    const matches = new Map<string, { item: LibraryEntry; score: number }>();
    const add = (entry: SearchEntry, score: number) => {
      const key = `${entry.item.kind}:${entry.item.id}`;
      const previous = matches.get(key);
      if (!previous || score < previous.score) {
        matches.set(key, { item: entry.item, score });
      }
    };
    for (const entry of entries) {
      const score = directScore(entry, text, reading);
      if (score !== null) {
        add(entry, score);
      }
    }
    for (const result of fuzzyMatches(text, reading)) {
      add(result.item, 3 + (result.score ?? 1));
    }
    return [...matches.values()]
      .sort((a, b) => a.score - b.score || a.item.rank - b.item.rank)
      .map((result) => ({ ...result.item, approximate: result.score >= 3 }));
  };
}
