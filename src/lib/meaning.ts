type MeaningItem = ({ keyword: string } | { meaning: string }) & { dictionaryMeanings: readonly string[] }

export function getItemMeaning(item: MeaningItem) {
  const primary = 'keyword' in item ? item.keyword : item.meaning
  const alternatives = item.dictionaryMeanings.filter(meaning => meaning.toLocaleLowerCase() !== primary.toLocaleLowerCase())
  return {
    primary,
    alternatives,
    summary: [primary, ...alternatives.slice(0, 1)].join('; '),
  }
}
