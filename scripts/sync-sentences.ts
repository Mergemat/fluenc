import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pinyin } from "pinyin-pro";
import curriculumJson from "../src/data/curriculum.generated.json";
import dictionarySource from "../src/data/dictionary.source.json";
import meaningReviews from "../src/data/sentence-meanings.reviewed.json";
import authoredSentences from "../src/data/sentences.authored.json";
import type { Curriculum, Word } from "../src/data/types";
import { type SentenceToken, segmentSentence } from "../src/lib/sentence-words";

const TATOEBA = "https://downloads.tatoeba.org/exports/per_language";
const FILES = {
  chinese: `${TATOEBA}/cmn/cmn_sentences.tsv.bz2`,
  english: `${TATOEBA}/eng/eng_sentences.tsv.bz2`,
  links: `${TATOEBA}/cmn/cmn-eng_links.tsv.bz2`,
};

// Mandarin Blueprint's bar for a Get sentence: long enough to show a word in use, short enough to
// read in one breath, and made of words the learner already has (one unknown at most).
const MIN_HANZI = 4;
const MAX_HANZI = 16;
const IDEAL_HANZI = 9;
const MIN_WORDS = 3;
const MAX_UNKNOWN = 1;
const PER_ANCHOR = 3;

const curriculum = curriculumJson as Curriculum;
// Tatoeba translations that mislead about the Chinese (tense, content, or meaning), by sentence number.
const reviewedMeanings: Record<string, { meaning: string; was: string }> =
  meaningReviews;
const characters = new Set(curriculum.characters.map((item) => item.hanzi));
const wordsByHanzi = new Map<string, Word[]>();
for (const word of curriculum.words) {
  wordsByHanzi.set(word.hanzi, [...(wordsByHanzi.get(word.hanzi) ?? []), word]);
}
const rankOf = (hanzi: string) =>
  Math.min(...(wordsByHanzi.get(hanzi) ?? []).map((word) => word.rank));
// Tatoeba mixes scripts, and the frequency list carries a few traditional spellings. Characters
// CC-CEDICT only ever writes traditionally keep a sentence out.
const simplified = new Set<string>();
const traditional = new Set<string>();
for (const entries of Object.values(dictionarySource.entries)) {
  for (const entry of entries) {
    const simple = Array.from(entry.simplified);
    for (const glyph of simple) {
      simplified.add(glyph);
    }
    Array.from(entry.traditional).forEach((glyph, index) => {
      if (glyph !== simple[index]) {
        traditional.add(glyph);
      }
    });
  }
}
const traditionalOnly = new Set(
  [...traditional].filter((glyph) => !simplified.has(glyph))
);
const wordSet = new Set(
  [...wordsByHanzi.keys()].filter(
    (hanzi) => !Array.from(hanzi).some((glyph) => traditionalOnly.has(glyph))
  )
);
const longestWord = Math.max(
  ...[...wordSet].map((hanzi) => Array.from(hanzi).length)
);

async function readTsv(url: string, folder: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${url} → ${response.status}`);
  }
  const file = join(folder, url.split("/").at(-1) ?? "download.bz2");
  await Bun.write(file, await response.arrayBuffer());
  const unzip = Bun.spawn(["bunzip2", "-c", file], { stdout: "pipe" });
  const text = await new Response(unzip.stdout).text();
  if ((await unzip.exited) !== 0) {
    throw new Error(`bunzip2 failed for ${file}`);
  }
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

const PUNCTUATION: Record<string, string> = {
  "，": ", ",
  "、": ", ",
  "。": ".",
  "？": "?",
  "！": "!",
  "：": ": ",
  "；": "; ",
  "“": " “",
  "”": "”",
  "…": "…",
};

const HAN = /\p{Script=Han}/u;
const NOT_HAN_TEXT = /[\p{Script=Latin}\p{Nd}]/u;
const READING_GAPS = /[\s'’]/g;
const NEEDS_SPACE = /[^\s“]$/;
const SPACES = /\s+/g;
const SENTENCE_START = /(^|[.?!]”? “?|^“)(\p{L})/gu;

const toneless = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Contextual readings from pinyin-pro, with a curriculum word's reviewed reading where they agree. */
function sentencePinyin(hanzi: string, tokens: SentenceToken[]) {
  const guesses = pinyin(hanzi, {
    type: "array",
    toneSandhi: false,
    nonZh: "removed",
  });
  const parts: string[] = [];
  let syllable = 0;
  const readings = tokens.map(({ text: spelling, word: known }) => {
    const { length } = Array.from(spelling);
    const guess = guesses.slice(syllable, syllable + length);
    syllable += length;
    const reviewed =
      known && length > 1
        ? wordsByHanzi
            .get(spelling)
            ?.find(
              (word) =>
                toneless(word.pinyin).replace(READING_GAPS, "") ===
                toneless(guess.join(""))
            )
        : undefined;
    return reviewed ? reviewed.pinyin : guess.join("");
  });
  let token = 0;
  let index = 0;
  const glyphs = Array.from(hanzi);
  while (index < glyphs.length) {
    const glyph = glyphs[index] ?? "";
    const current = tokens[token];
    if (current && glyphs.slice(index).join("").startsWith(current.text)) {
      const previous = parts.at(-1) ?? "";
      if (NEEDS_SPACE.test(previous)) {
        parts.push(" ");
      }
      parts.push(readings[token] ?? "");
      index += Array.from(current.text).length;
      token += 1;
      continue;
    }
    parts.push(PUNCTUATION[glyph] ?? glyph);
    index += 1;
  }
  const text = parts.join("").replace(SPACES, " ").trim();
  // Capitalize each sentence's first letter, including one that opens a quotation.
  return text.replace(
    SENTENCE_START,
    (_, lead: string, letter: string) => lead + letter.toUpperCase()
  );
}

function analyze(hanzi: string) {
  const glyphs = Array.from(hanzi).filter((glyph) => HAN.test(glyph));
  if (
    glyphs.length < MIN_HANZI ||
    glyphs.length > MAX_HANZI ||
    NOT_HAN_TEXT.test(hanzi) ||
    !glyphs.every(
      (glyph) => characters.has(glyph) && !traditionalOnly.has(glyph)
    )
  ) {
    return null;
  }
  const tokens = segmentSentence(hanzi, wordSet, longestWord);
  const words = [
    ...new Set(tokens.filter((item) => item.word).map((item) => item.text)),
  ];
  const unknown = tokens.filter((item) => !item.word).length;
  if (words.length < MIN_WORDS || unknown > MAX_UNKNOWN) {
    return null;
  }
  const byRank = [...words].sort((left, right) => rankOf(right) - rankOf(left));
  return {
    tokens,
    words,
    anchor: byRank[0] ?? "",
    // Shape near the ideal length, then prefer support words that are common.
    score:
      Math.abs(glyphs.length - IDEAL_HANZI) +
      rankOf(byRank[1] ?? byRank[0] ?? "") / 250 +
      unknown * 2,
  };
}

const directory = await mkdtemp(join(tmpdir(), "fluenc-tatoeba-"));
try {
  const [chineseRows, englishRows, linkRows] = await Promise.all([
    readTsv(FILES.chinese, directory),
    readTsv(FILES.english, directory),
    readTsv(FILES.links, directory),
  ]);

  const englishIds = new Map<string, string[]>();
  for (const [chineseId, englishId] of linkRows) {
    if (chineseId && englishId) {
      englishIds.set(chineseId, [
        ...(englishIds.get(chineseId) ?? []),
        englishId,
      ]);
    }
  }
  const neededEnglish = new Set([...englishIds.values()].flat());
  const english = new Map<string, string>();
  for (const [id, , text] of englishRows) {
    if (id && text && neededEnglish.has(id)) {
      english.set(id, text);
    }
  }

  const seen = new Set<string>();
  const strip = (hanzi: string) =>
    Array.from(hanzi)
      .filter((glyph) => HAN.test(glyph))
      .join("");

  const authored = authoredSentences.map((sentence) => {
    const tokens = segmentSentence(sentence.hanzi, wordSet, longestWord);
    const words = [
      ...new Set(tokens.filter((item) => item.word).map((item) => item.text)),
    ];
    seen.add(strip(sentence.hanzi));
    return {
      ...sentence,
      words,
      anchor:
        [...words].sort((left, right) => rankOf(right) - rankOf(left))[0] ?? "",
      source: null,
    };
  });

  const candidates = new Map<
    string,
    Array<
      { id: string; hanzi: string; meaning: string } & NonNullable<
        ReturnType<typeof analyze>
      >
    >
  >();
  for (const [id, , hanzi] of chineseRows) {
    if (!(id && hanzi) || seen.has(strip(hanzi))) {
      continue;
    }
    const meaning = (englishIds.get(id) ?? [])
      .sort((left, right) => Number(left) - Number(right))
      .map((englishId) => english.get(englishId))
      .find(Boolean);
    const analysis = meaning ? analyze(hanzi) : null;
    if (!(meaning && analysis)) {
      continue;
    }
    seen.add(strip(hanzi));
    candidates.set(analysis.anchor, [
      ...(candidates.get(analysis.anchor) ?? []),
      { id, hanzi, meaning, ...analysis },
    ]);
  }

  const picked = [...candidates.values()]
    .flatMap((items) =>
      items
        .sort(
          (left, right) =>
            left.score - right.score || Number(left.id) - Number(right.id)
        )
        .slice(0, PER_ANCHOR)
    )
    .sort(
      (left, right) =>
        rankOf(left.anchor) - rankOf(right.anchor) ||
        Number(left.id) - Number(right.id)
    )
    .map((item) => ({
      id: `t${item.id}`,
      hanzi: item.hanzi,
      pinyin: sentencePinyin(item.hanzi, item.tokens),
      meaning: reviewedMeanings[item.id]?.meaning ?? item.meaning,
      words: item.words,
      anchor: item.anchor,
      source: Number(item.id),
    }));

  const sentences = [...authored, ...picked];
  await Bun.write(
    new URL("../src/data/sentences.generated.json", import.meta.url),
    `${JSON.stringify({
      version: "2026-10-13.1",
      sources: {
        sentences: FILES.chinese,
        translations: FILES.english,
        links: FILES.links,
        license: "https://creativecommons.org/licenses/by/2.0/fr/",
      },
      sentences,
    })}\n`
  );
  const anchored = new Set(sentences.map((item) => item.anchor));
  console.log(
    `Synced ${sentences.length} sentences (${authored.length} authored) anchored to ${anchored.size} of ${wordSet.size} words.`
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
