type MeaningItem = ({ keyword: string } | { meaning: string }) & {
  also: string | null;
  senses: readonly string[];
};

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

/** The keyword or meaning, its short second cue, and the other senses, each said once. */
export function getItemMeaning(item: MeaningItem) {
  const primary = "keyword" in item ? item.keyword : item.meaning;
  const primaryKey = meaningKey(primary);
  const also =
    item.also && meaningKey(item.also) !== primaryKey ? item.also : null;
  const seen = new Set([primaryKey]);
  const alternatives = item.senses.filter((meaning) => {
    const key = meaningKey(meaning);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return {
    primary,
    alternatives,
    also,
    summary: also ? `${primary}; ${also}` : primary,
  };
}
