type MeaningItem = ({ keyword: string } | { meaning: string }) & { dictionaryMeanings: readonly string[] }

export function getItemMeaning(item: MeaningItem) {
  const primary = 'keyword' in item ? item.keyword : item.meaning
  return {
    primary,
    alternatives: item.dictionaryMeanings.filter(meaning => meaning.toLocaleLowerCase() !== primary.toLocaleLowerCase()),
  }
}
