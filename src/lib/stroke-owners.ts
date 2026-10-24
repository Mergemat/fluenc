/**
 * Which teaching prop draws each stroke. Props are chosen for memory, not to match how a stroke
 * file happens to tag its outlines, so when a character's props change the strokes are handed
 * over: a stroke keeps its prop if the character still has it; the rest go, in writing order, to
 * the props nothing draws yet, by each prop's stroke count. Null when that cannot be decided.
 */
export function remapStrokeOwners(
  previous: readonly string[],
  parts: readonly string[],
  strokesOf: (part: string) => number | undefined
): string[] | null {
  const wanted = new Set(parts);
  if (wanted.size === 1) {
    const [only] = parts;
    return only ? previous.map(() => only) : null;
  }
  const kept = previous.map((owner) => (wanted.has(owner) ? owner : null));
  const missing = parts.filter(
    (part, index) => !kept.includes(part) && parts.indexOf(part) === index
  );
  const handed = handOver(
    missing,
    kept.filter((owner) => owner === null).length,
    parts,
    strokesOf
  );
  if (!handed) {
    return null;
  }
  const owners = kept.map((owner) => owner ?? handed.shift() ?? "");
  return parts.every((part) => owners.includes(part)) ? owners : null;
}

/** The props, in writing order, that take over `loose` strokes, or null if their counts don't fit. */
function handOver(
  missing: readonly string[],
  loose: number,
  parts: readonly string[],
  strokesOf: (part: string) => number | undefined
) {
  if (!(loose && missing.length)) {
    return loose || missing.length ? null : [];
  }
  const [only] = missing;
  if (missing.length === 1 && only) {
    return Array.from({ length: loose }, () => only);
  }
  const counts = missing.map(
    (part) =>
      (strokesOf(part) ?? 0) * parts.filter((item) => item === part).length
  );
  if (
    counts.some((count) => count <= 0) ||
    counts.reduce((sum, count) => sum + count, 0) !== loose
  ) {
    return null;
  }
  return missing.flatMap((part, index) =>
    Array.from({ length: counts[index] ?? 0 }, () => part)
  );
}
