import characterJson from "../src/data/hanzi/characters.json";
import componentJson from "../src/data/hanzi/components.json";
import wordJson from "../src/data/hanzi/words.json";
import authoredSentences from "../src/data/sentences.authored.json";
import reviewedSentences from "../src/data/sentences.reviewed.json";
import { directCharacters } from "../src/lib/character-props";
import { characterWordEquivalences } from "../src/lib/character-word-equivalence";
import {
  characterSchema,
  componentSchema,
  databaseProblems,
  isTaught,
  wordSchema,
} from "../src/lib/hanzi-db";
import { learningOrder } from "../src/lib/learning-order";
import { remapStrokeOwners } from "../src/lib/stroke-owners";
import { selectSentences } from "./sentence-selection";

const characters = characterSchema.array().parse(characterJson);
const words = wordSchema.array().parse(wordJson);
const components = componentSchema.array().parse(componentJson);

const problems = databaseProblems(characters, words, components);
if (problems.length) {
  throw new Error(
    `The character database has ${problems.length} problems:\n${problems.join("\n")}`
  );
}

// Usage: how often the reading corpus (every sentence, not only those the course selects) uses
// an entry, plus, for a character, how many course words it spells.
const corpus = [...authoredSentences, ...reviewedSentences.sentences].map(
  (sentence) => sentence.hanzi
);
const sentencesWith = (text: string) =>
  corpus.filter((sentence) => sentence.includes(text)).length;

const taught = words.filter(isTaught);
const wordOrder = learningOrder(
  taught.map((word) => ({ rank: word.id, usage: sentencesWith(word.hanzi) }))
);
const courseWords = taught.map((word, index) => ({
  id: word.id,
  rank: word.id,
  order: wordOrder[index] ?? 0,
  usage: sentencesWith(word.hanzi),
  hanzi: word.hanzi,
  pinyin: word.pinyin,
  syllables: word.syllables,
  meaning: word.meaning,
  senses: word.meanings,
  also: word.also,
  characterIds: [...new Set(Array.from(word.hanzi))],
}));

const spelled = new Map<string, { rank: number; unlocks: number }>();
for (const word of courseWords) {
  for (const hanzi of word.characterIds) {
    const current = spelled.get(hanzi);
    spelled.set(hanzi, {
      rank: Math.min(current?.rank ?? Number.POSITIVE_INFINITY, word.rank),
      unlocks: (current?.unlocks ?? 0) + 1,
    });
  }
}
const characterStats = characters.map((character) => {
  const stats = spelled.get(character.hanzi);
  if (!stats) {
    throw new Error(`No course word uses ${character.hanzi}`);
  }
  return {
    rank: stats.rank,
    unlocks: stats.unlocks,
    usage: sentencesWith(character.hanzi) + stats.unlocks,
  };
});
const characterOrder = learningOrder(characterStats);
const courseCharacters = characters
  .map((character, index) => {
    const stats = characterStats[index];
    if (!stats) {
      throw new Error(`Missing stats: ${character.hanzi}`);
    }
    return {
      id: character.hanzi,
      hanzi: character.hanzi,
      pinyin: character.pinyin,
      keyword: character.keyword,
      senses: character.meanings,
      also: character.also,
      readings: character.readings,
      strokes: character.strokes,
      radical: character.radical,
      components: character.components,
      componentStructure: character.structure,
      componentNote: character.note,
      frequencyRank: stats.rank,
      unlocks: stats.unlocks,
      usage: stats.usage,
      order: characterOrder[index] ?? 0,
    };
  })
  .sort((left, right) => left.order - right.order);

const used = new Set(
  courseCharacters
    .filter((character) => character.componentStructure === "compound")
    .flatMap((character) => character.components)
);
const props = Object.fromEntries(
  components
    .filter((component) => used.has(component.hanzi))
    .map((component) => [
      component.hanzi,
      {
        prop: component.prop,
        meaning: component.meaning,
        variantOf: component.variantOf,
        strokes: component.strokes,
      },
    ])
);

const curriculum = {
  version: "2026-10-26.1",
  sources: {
    characters: "src/data/hanzi/characters.json",
    words: "src/data/hanzi/words.json",
    components: "src/data/hanzi/components.json",
  },
  words: courseWords,
  characters: courseCharacters,
  props,
};

// Each stored stroke goes to the prop that draws it. Stroke paths and medians are the vendored
// Arphic outlines in assets/strokes and never change; only `owners` follows the decomposition.
const STROKE_NOTICE =
  "Fluenc: added the teaching prop that draws each stroke; stroke paths and medians unchanged. Graphics copyright Arphic Technology Co., Ltd.; Arphic Public License, /licenses/ARPHICPL.TXT.";

interface Shape {
  medians: number[][][];
  owners: string[];
  strokes: string[];
}

const strokesOf = (part: string) =>
  props[part]?.strokes ??
  courseCharacters.find((character) => character.hanzi === part)?.strokes;

const shapes = await Promise.all(
  courseCharacters.map(async (character) => {
    const file = Bun.file(`assets/strokes/${character.hanzi}.json`);
    return (await file.exists()) ? ((await file.json()) as Shape) : null;
  })
);
const undecided: string[] = [];
const strokeWrites: Promise<number>[] = [];
for (const [index, character] of courseCharacters.entries()) {
  const shape = shapes[index];
  if (!shape) {
    undecided.push(`${character.hanzi} (no stroke file)`);
    continue;
  }
  const parts = directCharacters.has(character.hanzi)
    ? [character.hanzi]
    : character.components;
  const owners = remapStrokeOwners(shape.owners, parts, strokesOf);
  if (!owners) {
    undecided.push(
      `${character.hanzi}: [${shape.owners.join(" ")}] → ${parts.join(" ")}`
    );
  } else if (owners.join() !== shape.owners.join()) {
    strokeWrites.push(
      Bun.write(
        `assets/strokes/${character.hanzi}.json`,
        `${JSON.stringify({ _notice: STROKE_NOTICE, strokes: shape.strokes, medians: shape.medians, owners })}\n`
      )
    );
  }
}
if (undecided.length) {
  throw new Error(
    `Set "owners" by hand in assets/strokes for ${undecided.length} characters:\n${undecided.join("\n")}`
  );
}

const sentences = selectSentences(
  curriculum,
  authoredSentences,
  reviewedSentences
);

await Promise.all([
  ...strokeWrites,
  Bun.write(
    new URL("../src/data/character-words.generated.json", import.meta.url),
    `${JSON.stringify(characterWordEquivalences(courseCharacters, courseWords))}\n`
  ),
  Bun.write(
    new URL("../src/data/curriculum.generated.json", import.meta.url),
    `${JSON.stringify(curriculum)}\n`
  ),
  Bun.write(
    new URL("../src/data/sentences.generated.json", import.meta.url),
    `${JSON.stringify({
      version: "reviewed-v1",
      sources: {
        sentences:
          "https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2",
        translations:
          "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2",
        links:
          "https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2",
        license: "https://creativecommons.org/licenses/by/2.0/fr/",
        attribution: "Tatoeba contributors",
        reviewed: "src/data/sentences.reviewed.json",
      },
      sentences,
    })}\n`
  ),
]);

console.log(
  `Synced ${courseWords.length} words, ${courseCharacters.length} characters, ${Object.keys(props).length} props, ${sentences.length} sentences and ${strokeWrites.length} changed stroke files.`
);
