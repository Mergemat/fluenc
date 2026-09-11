export function DictionaryMeanings({ meanings }: { meanings: readonly string[] }) {
  if (!meanings.length) return null
  return <details className="dictionary-meanings">
    <summary>Dictionary meanings</summary>
    <ul>{meanings.map(meaning => <li key={meaning}>{meaning}</li>)}</ul>
  </details>
}
