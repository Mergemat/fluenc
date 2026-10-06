import type { LibraryEntry } from "./library-search";
import { normalizePinyin } from "./library-search";

export type LibraryGroup = "course" | "sound";

export interface LibrarySection {
  entries: LibraryEntry[];
  key: string;
  label: string;
  learned: number;
}

const UP_NEXT = 20;
const RETROFLEX = /^[zcs]h/;

/** The dictionary letter a reading files under: its first letter, with zh, ch and sh apart. */
export function soundKey(pinyin: string) {
  const reading = normalizePinyin(pinyin);
  return RETROFLEX.exec(reading)?.[0] ?? reading.charAt(0);
}

const toneOf = (entry: LibraryEntry) =>
  entry.kind === "characters" ? entry.movie.tone : 0;

const bySound = (left: LibraryEntry, right: LibraryEntry) =>
  normalizePinyin(left.pinyin).localeCompare(normalizePinyin(right.pinyin)) ||
  toneOf(left) - toneOf(right) ||
  left.rank - right.rank;

const section = (
  key: string,
  label: string,
  entries: LibraryEntry[]
): LibrarySection => ({
  key,
  label,
  entries,
  learned: entries.filter((entry) => entry.status === "review").length,
});

/** Where an entry sits in the teaching queue, keyed like `characters:我`. */
export const queueKey = (kind: LibraryEntry["kind"], id: string) =>
  `${kind}:${id}`;

const byRank = (left: LibraryEntry, right: LibraryEntry) =>
  left.rank - right.rank;

/**
 * Entries split into sections to browse. By course: what you are learning, what you know, the
 * next few the lessons will teach (in `queue` order) and everything after. By sound: dictionary
 * letters (a, b, c, ch, …), each sorted by reading and tone.
 */
export function librarySections(
  entries: LibraryEntry[],
  group: LibraryGroup,
  queue: ReadonlyMap<string, number> = new Map()
): LibrarySection[] {
  if (group === "course") {
    const place = (entry: LibraryEntry) =>
      queue.get(queueKey(entry.kind, entry.id)) ?? Number.POSITIVE_INFINITY;
    const upcoming = entries
      .filter((entry) => entry.status === "new")
      .toSorted(
        (left, right) => place(left) - place(right) || byRank(left, right)
      );
    return [
      section(
        "learning",
        "learning",
        entries.filter((entry) => entry.status === "learning").toSorted(byRank)
      ),
      section(
        "learned",
        "learned",
        entries.filter((entry) => entry.status === "review").toSorted(byRank)
      ),
      section("next", "up next", upcoming.slice(0, UP_NEXT)),
      section("later", "later", upcoming.slice(UP_NEXT)),
    ].filter((item) => item.entries.length);
  }
  const letters = new Map<string, LibraryEntry[]>();
  for (const entry of entries.toSorted(bySound)) {
    const key = soundKey(entry.pinyin);
    letters.set(key, [...(letters.get(key) ?? []), entry]);
  }
  return [...letters].map(([key, list]) => section(key, key, list));
}
