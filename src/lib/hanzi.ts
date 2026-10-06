export type HanziIndex = Record<
  string,
  readonly [radical: string, decomposition: string]
>;

export interface HanziComposition {
  components: string[];
  decomposition: string | null;
  glyphVariation: boolean;
  note: string | null;
  radical: string;
  structure: "atomic" | "compound";
}

export interface ReviewedComposition {
  approximate: boolean;
  character: string;
  components: string[];
  confidence: "verified" | "editorial" | "unresolved";
  decomposition: string | null;
  note: string;
  sources: string[];
  structure: "atomic" | "compound";
}

const componentPattern = /^[\p{Script=Han}\u2e80-\u2eff\u31c0-\u31ee]$/u;
const binaryOperators = new Set(Array.from("⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽"));

export function isHanziCharacter(value: string) {
  const characters = Array.from(value);
  return characters.length === 1 && componentPattern.test(characters[0]);
}

const operatorArity = new Map<string, number>([
  ...Array.from("⿲⿳", (operator) => [operator, 3] as const),
  ...Array.from(binaryOperators, (operator) => [operator, 2] as const),
]);

function isUsableReview(character: string, reviewed: ReviewedComposition) {
  if (
    reviewed.character !== character ||
    reviewed.confidence === "unresolved" ||
    !reviewed.sources.length ||
    !reviewed.components.length ||
    reviewed.components.some((part) => !isHanziCharacter(part))
  ) {
    return false;
  }
  if (reviewed.structure === "atomic") {
    return (
      reviewed.components.length === 1 && reviewed.components[0] === character
    );
  }
  return !reviewed.components.includes(character);
}

/** A reviewed choice, accepted only when its own description parses to the same parts. */
function reviewedComposition(
  character: string,
  radical: string,
  reviewed: ReviewedComposition
): HanziComposition | null {
  if (!isUsableReview(character, reviewed)) {
    return null;
  }
  if (reviewed.decomposition) {
    const parsed = findHanziComposition(
      { [character]: [radical, reviewed.decomposition] },
      character
    );
    if (
      !parsed ||
      parsed.components.join("") !== reviewed.components.join("") ||
      parsed.structure !== reviewed.structure ||
      (parsed.glyphVariation && !reviewed.approximate)
    ) {
      return null;
    }
  }
  return {
    radical,
    decomposition: reviewed.decomposition,
    components: reviewed.components,
    structure: reviewed.structure,
    glyphVariation: reviewed.approximate,
    note: reviewed.note || null,
  };
}

/** The leaf components of an ideographic description, or null if any operand is unusable. */
function describedComponents(tokens: string[]) {
  const components: string[] = [];
  let cursor = 0;

  const readNode = (): boolean => {
    const token = tokens[cursor];
    cursor += 1;
    if (!token) {
      return false;
    }
    const arity = operatorArity.get(token) ?? 0;
    if (arity) {
      for (let child = 0; child < arity; child += 1) {
        if (!readNode()) {
          return false;
        }
      }
      return true;
    }
    if (!componentPattern.test(token)) {
      return false;
    }
    components.push(token);
    return true;
  };

  // Reject the whole description if any operand is unknown, unsupported, or missing.
  return readNode() && cursor === tokens.length ? components : null;
}

export function findHanziComposition(
  index: HanziIndex,
  character: string,
  reviewed?: ReviewedComposition
): HanziComposition | null {
  const entry = index[character];
  if (!entry) {
    return null;
  }

  const [radical, decomposition] = entry;
  if (reviewed) {
    return reviewedComposition(character, radical, reviewed);
  }
  const glyphVariation = decomposition.startsWith("〾");
  const tokens = Array.from(
    glyphVariation ? decomposition.slice(1) : decomposition
  );
  const components = describedComponents(tokens);
  if (!components) {
    return null;
  }
  const structure =
    tokens.length === 1 && tokens[0] === character ? "atomic" : "compound";
  if (structure === "compound" && components.includes(character)) {
    return null;
  }

  return {
    radical,
    decomposition,
    structure,
    glyphVariation,
    components,
    note: null,
  };
}

export function groupHanziComponents(components: readonly string[]) {
  const counts = new Map<string, number>();
  for (const hanzi of components) {
    counts.set(hanzi, (counts.get(hanzi) ?? 0) + 1);
  }
  return [...counts].map(([hanzi, count]) => ({ hanzi, count }));
}
