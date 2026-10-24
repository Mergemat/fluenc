/** A character's props, each once, with how many times it appears. */
export function groupHanziComponents(components: readonly string[]) {
  const counts = new Map<string, number>();
  for (const hanzi of components) {
    counts.set(hanzi, (counts.get(hanzi) ?? 0) + 1);
  }
  return [...counts].map(([hanzi, count]) => ({ hanzi, count }));
}
