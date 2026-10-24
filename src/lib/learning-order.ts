/** Average position of each value in a ranking, so ties share a place. */
function positions(
  values: readonly number[],
  better: (a: number, b: number) => number
) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => better(left.value, right.value));
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (
      end + 1 < sorted.length &&
      sorted[end + 1]?.value === sorted[start]?.value
    ) {
      end += 1;
    }
    for (let cursor = start; cursor <= end; cursor += 1) {
      result[sorted[cursor]?.index ?? 0] = (start + end) / 2;
    }
    start = end + 1;
  }
  return result;
}

/**
 * The default teaching order: each item's place by frequency (its rank, lower first) and by
 * usage (how often the course's words and sentences use it, higher first), averaged. A frequent
 * item that little else uses gives way to a slightly rarer one that much of the course needs.
 * Ties keep frequency order. Returns each item's 1-based place, in input order.
 */
export function learningOrder(
  items: readonly { rank: number; usage: number }[]
) {
  const byRank = positions(
    items.map((item) => item.rank),
    (left, right) => left - right
  );
  const byUsage = positions(
    items.map((item) => item.usage),
    (left, right) => right - left
  );
  const order = items
    .map((item, index) => ({
      index,
      rank: item.rank,
      score: ((byRank[index] ?? 0) + (byUsage[index] ?? 0)) / 2,
    }))
    .sort((left, right) => left.score - right.score || left.rank - right.rank);
  const places = new Array<number>(items.length);
  for (const [place, item] of order.entries()) {
    places[item.index] = place + 1;
  }
  return places;
}
