import secondaryMeanings from "../data/secondary-meanings.reviewed.json";

type MeaningItem = ({ keyword: string } | { meaning: string }) & {
  dictionaryMeanings: readonly string[];
  hanzi: string;
  pinyin: string;
};

const secondaryByReading = new Map(
  secondaryMeanings.map((entry) => [`${entry.hanzi}:${entry.pinyin}`, entry])
);

// These whole entries describe the dictionary, spelling, pronunciation or classifiers
// for a noun. A definition such as "classifier for books" is still a real sense of 本.
// Inline labels stay intact: deleting parentheses can change a sense's meaning.
const DICTIONARY_METADATA =
  /^(?:CL:|(?:also|Taiwan|Beijing|colloquial) pr\. |also written |(?:(?:old|euphemistic) )?variant of |same as |opposite: |Kangxi radical )/i;
const RADICAL_DESCRIPTION =
  /radical in Chinese characters \(Kangxi radical \d+\)$/;
const INFINITIVE = /^to\s+/;
const TERMINAL_PUNCTUATION = /[.!?…]+$/;
const WHITESPACE = /\s+/g;

function meaningKey(meaning: string) {
  return meaning
    .trim()
    .toLowerCase()
    .replace(INFINITIVE, "")
    .replace(TERMINAL_PUNCTUATION, "")
    .replace(WHITESPACE, " ")
    .trim();
}

export function getItemMeaning(item: MeaningItem) {
  const primary = "keyword" in item ? item.keyword : item.meaning;
  const primaryKey = meaningKey(primary);
  const seen = new Set([primaryKey]);
  const alternatives = item.dictionaryMeanings.filter((meaning) => {
    const key = meaningKey(meaning);
    if (
      !key ||
      seen.has(key) ||
      DICTIONARY_METADATA.test(meaning.trim()) ||
      RADICAL_DESCRIPTION.test(meaning)
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Short teaching cues are editorial decisions, not the first short dictionary
  // fragment. Require both the reviewed reading and its exact evidence on this item;
  // cross-references and another pronunciation cannot supply an alternate cue.
  const reviewed = secondaryByReading.get(`${item.hanzi}:${item.pinyin}`);
  const also =
    reviewed &&
    item.dictionaryMeanings.includes(reviewed.sourceSense) &&
    meaningKey(reviewed.meaning) !== primaryKey
      ? reviewed.meaning
      : null;

  return {
    primary,
    alternatives,
    also,
    summary: also ? `${primary}; ${also}` : primary,
  };
}
