export interface SentenceIdentity {
  hanzi: string;
  id: string;
}

export interface SentenceConflict {
  first: string;
  kind: "exact" | "template";
  second: string;
}

const PUNCTUATION_AND_SPACE = /[\p{P}\p{Z}\s]/gu;
const PRONOUNS = /我们|你们|他们|她们|它们|我|你|您|他|她|它/gu;
// Normalize quantities, not 一 in lexical words such as 一起, 一定, or 一切.
const QUANTITIES =
  /[零〇一二两三四五六七八九十百千万亿\d]+(?=个|本|只|条|张|位|件|杯|岁|年|月|天|小时|分钟|点|块|元|次|人)/gu;
const DIGITS = /\d+/gu;
const SPEAKING_FRAME = /[对跟向](〈人\d+〉)说/gu;

export function sentenceTextKey(hanzi: string) {
  return hanzi.normalize("NFKC").replace(PUNCTUATION_AND_SPACE, "");
}

/** A teaching template, not a claim that the sentences have identical meanings. */
export function sentenceTemplateKey(hanzi: string) {
  const roles = new Map<string, number>();
  return sentenceTextKey(hanzi)
    .replace(QUANTITIES, "〈数〉")
    .replace(DIGITS, "〈数〉")
    .replace(PRONOUNS, (pronoun) => {
      if (!roles.has(pronoun)) {
        roles.set(pronoun, roles.size);
      }
      return `〈人${roles.get(pronoun)}〉`;
    })
    .replace(SPEAKING_FRAME, "$1说");
}

/**
 * Report every pair sharing punctuation-independent text or a superficial teaching template.
 * Keep repeated words intact: 看 and 看看, or 人人 and 人, teach different constructions.
 * Editorial review handles semantic similarity and suitability beyond these narrow checks.
 */
export function findSentenceConflicts(
  sentences: readonly SentenceIdentity[]
): SentenceConflict[] {
  const templates = new Map<string, SentenceIdentity[]>();
  const conflicts: SentenceConflict[] = [];
  for (const sentence of sentences) {
    const key = sentenceTemplateKey(sentence.hanzi);
    const earlier = templates.get(key) ?? [];
    for (const first of earlier) {
      conflicts.push({
        first: first.id,
        second: sentence.id,
        kind:
          sentenceTextKey(first.hanzi) === sentenceTextKey(sentence.hanzi)
            ? "exact"
            : "template",
      });
    }
    earlier.push(sentence);
    templates.set(key, earlier);
  }
  return conflicts;
}
