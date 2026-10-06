type MeaningItem = ({ keyword: string } | { meaning: string }) & { dictionaryMeanings: readonly string[] }

export function getItemMeaning(item: MeaningItem) {
  const primary = 'keyword' in item ? item.keyword : item.meaning
  const alternatives = item.dictionaryMeanings.filter(meaning => meaning.toLocaleLowerCase() !== primary.toLocaleLowerCase())
  return {
    primary,
    alternatives,
    also: shortAlternative(primary, alternatives),
    summary: [primary, ...alternatives.slice(0, 1)].join('; '),
  }
}

/**
 * One short extra sense for the "also" line: dictionary senses split at semicolons, with
 * labels like "(prefix)" removed, skipping repeats of the primary meaning and long glosses.
 */
function shortAlternative(primary: string, alternatives: readonly string[]) {
  const same = primary.toLocaleLowerCase()
  for (const sense of alternatives) for (const part of sense.split(/;\s*/)) {
    const clean = part.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    if (clean && clean.toLocaleLowerCase() !== same && clean.length <= 32) return clean
  }
  return null
}
