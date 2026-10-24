import type { Word } from "../data/types";

export function nextWordCharacters(
  words: Pick<Word, "order" | "characterIds">[],
  introduced: Set<string>
) {
  const candidates = words
    .map((word) => ({
      order: word.order,
      missing: [...new Set(word.characterIds)].filter(
        (id) => !introduced.has(id)
      ),
      started: word.characterIds.some((id) => introduced.has(id)),
    }))
    .filter((word) => word.started && word.missing.length > 0);
  candidates.sort(
    (left, right) =>
      left.missing.length - right.missing.length || left.order - right.order
  );
  return new Set(candidates[0]?.missing);
}
