type MeaningItem = { keyword: string; dictionaryMeanings: readonly string[] } | { meaning: string }

export function getItemMeaning(item: MeaningItem) {
  if ('keyword' in item) {
    return {
      primary: item.keyword,
      alternatives: item.dictionaryMeanings.filter(meaning => meaning.toLocaleLowerCase() !== item.keyword.toLocaleLowerCase()),
    }
  }

  const meanings = item.meaning.split(/[;,]/).map(meaning => meaning.trim()).filter(Boolean)
  return { primary: meanings[0] ?? item.meaning, alternatives: meanings.slice(1) }
}
