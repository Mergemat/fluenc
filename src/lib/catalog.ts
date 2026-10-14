import curriculumJson from "../data/curriculum.generated.json";
import { sentences as courseSentences, type Sentence } from "../data/sentences";
import type { Character, Curriculum, FocusEntry, Word } from "../data/types";
import { characterIsWord } from "./character-words";
import { segmentSentence } from "./sentence-words";
import { wordSyllables } from "./word-syllables";

const HAN = /\p{Script=Han}/u;
const hanOnly = (value: string) =>
  Array.from(value)
    .filter((character) => HAN.test(character))
    .join("");

/** Where one focus entry points: a course item or the learner's own, keyed like `cardKey`. */
export interface FocusTarget {
  key: string;
  label: string;
}

/** Focus words as course characters, course words or, failing both, the learner's own words. */
function resolveFocusWords(
  entries: readonly FocusEntry[],
  charactersById: ReadonlyMap<string, Character>,
  courseWords: readonly Word[],
  lastRank: number
) {
  const wordsByHanzi = new Map(courseWords.map((item) => [item.hanzi, item]));
  const ownWords = new Map<string, Word>();
  const targets: FocusTarget[] = [];
  for (const entry of entries) {
    const courseWord = wordsByHanzi.get(entry.hanzi);
    let key: string | null = null;
    if (charactersById.has(entry.hanzi)) {
      key = `character:${entry.hanzi}`;
    } else if (courseWord) {
      key = `word:${courseWord.id}`;
    } else if (
      hanOnly(entry.hanzi) === entry.hanzi &&
      Array.from(entry.hanzi).every((character) =>
        charactersById.has(character)
      )
    ) {
      key = `word:${entry.hanzi}`;
      if (!ownWords.has(entry.hanzi)) {
        ownWords.set(entry.hanzi, {
          id: entry.hanzi,
          rank: lastRank + ownWords.size + 1,
          hanzi: entry.hanzi,
          pinyin: entry.pinyin,
          meaning: entry.meaning,
          dictionaryMeanings: [],
          characterIds: Array.from(entry.hanzi),
          syllables: wordSyllables(entry.hanzi, entry.pinyin),
        });
      }
    }
    if (key) {
      targets.push({ key, label: entry.label });
    }
  }
  return { targets, ownWords: [...ownWords.values()] };
}

/** Focus sentences as course sentences or the learner's own, split into the words they use. */
function resolveFocusSentences(
  entries: readonly FocusEntry[],
  charactersById: ReadonlyMap<string, Character>,
  sentences: readonly Sentence[],
  words: readonly Word[]
) {
  const sentencesByHanzi = new Map(
    sentences.map((item) => [hanOnly(item.hanzi), item])
  );
  const spellings = new Set([
    ...words.map((item) => item.hanzi),
    ...[...charactersById.keys()].filter((id) => characterIsWord(id)),
  ]);
  const rankOf = new Map(
    words.toReversed().map((item) => [item.hanzi, item.rank])
  );
  const ownSentences = new Map<string, Sentence>();
  const targets: FocusTarget[] = [];
  for (const entry of entries) {
    const hanzi = hanOnly(entry.hanzi);
    const course = sentencesByHanzi.get(hanzi);
    if (course) {
      targets.push({ key: `sentence:${course.id}`, label: entry.label });
      continue;
    }
    if (
      !hanzi ||
      Array.from(hanzi).some((character) => !charactersById.has(character))
    ) {
      continue;
    }
    const sentenceWords = segmentSentence(entry.hanzi, spellings)
      .filter((token) => token.word)
      .map((token) => token.text);
    ownSentences.set(entry.hanzi, {
      id: entry.hanzi,
      hanzi: entry.hanzi,
      pinyin: entry.pinyin,
      meaning: entry.meaning,
      source: null,
      words: sentenceWords,
      // Like course sentences, anchored to the least frequent word; own words rank last.
      anchor: sentenceWords.reduce(
        (anchor, word) =>
          (rankOf.get(word) ?? 0) > (rankOf.get(anchor) ?? 0) ? word : anchor,
        sentenceWords[0] ?? ""
      ),
    });
    targets.push({ key: `sentence:${entry.hanzi}`, label: entry.label });
  }
  return { targets, ownSentences: [...ownSentences.values()] };
}

/**
 * The course every learner shares, plus the learner's focus entries. Course entries ship with the
 * app, so devices never download them as part of their progress. A focus entry that matches a
 * course spelling points at it; otherwise it becomes the learner's own word or sentence, provided
 * every character is in the course. Entries with other characters are left out.
 */
export function createCatalog(
  curriculum: Pick<Curriculum, "version" | "characters" | "words">,
  sentences: Sentence[],
  focus: readonly FocusEntry[] = []
) {
  const charactersById = new Map(
    curriculum.characters.map((item) => [item.id, item])
  );
  // The frequency list repeats a spelling with different readings; teach each spelling once.
  const courseWords = [
    ...curriculum.words
      .reduce((items, item) => {
        if (!items.has(item.hanzi)) {
          items.set(item.hanzi, item);
        }
        return items;
      }, new Map<string, Word>())
      .values(),
  ];
  const focusWords = resolveFocusWords(
    focus.filter((entry) => entry.kind === "word"),
    charactersById,
    courseWords,
    Math.max(0, ...curriculum.words.map((item) => item.rank))
  );
  const words = [...curriculum.words, ...focusWords.ownWords];
  const focusSentences = resolveFocusSentences(
    focus.filter((entry) => entry.kind === "sentence"),
    charactersById,
    sentences,
    words
  );
  const allSentences = [...sentences, ...focusSentences.ownSentences];
  const targets = [...focusWords.targets, ...focusSentences.targets];
  return {
    version: curriculum.version,
    characters: curriculum.characters,
    charactersById,
    wordsById: new Map(words.map((item) => [String(item.id), item])),
    uniqueWords: [...courseWords, ...focusWords.ownWords],
    sentences: allSentences,
    sentencesById: new Map(allSentences.map((item) => [item.id, item])),
    /** Focus targets in the order to teach them, each once. */
    focus: targets.filter(
      (target, index) =>
        targets.findIndex((item) => item.key === target.key) === index
    ),
  };
}

export type Catalog = ReturnType<typeof createCatalog>;

export const catalog = createCatalog(
  curriculumJson as Curriculum,
  courseSentences
);

const focusCatalogs = new WeakMap<readonly FocusEntry[], Catalog>();

/** The course with a learner's focus entries. Progress cached before focus existed has none. */
export function catalogFor(state: { focus?: readonly FocusEntry[] }) {
  const { focus } = state;
  if (!focus?.length) {
    return catalog;
  }
  let built = focusCatalogs.get(focus);
  if (!built) {
    built = createCatalog(curriculumJson as Curriculum, courseSentences, focus);
    focusCatalogs.set(focus, built);
  }
  return built;
}
