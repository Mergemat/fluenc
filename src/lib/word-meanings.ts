import { z } from "zod";

import {
  type DictionaryReading,
  dictionaryPinyin,
  samePronunciation,
  verifyDictionaryReading,
} from "./curriculum-readings";

const referenceSchema = z.object({
  hanzi: z.string().min(1),
  sourcePinyin: z.string().min(1),
  sourceSense: z.string().min(1),
});
const identitySchema = z.object({
  id: z.number().int().positive(),
  hanzi: z.string().min(1),
});
const meaningSchema = identitySchema.extend({
  pinyin: z.string().min(1),
  meaning: z.string().trim().min(1).max(100),
  note: z.string().min(1),
  sourceReferences: z.array(referenceSchema).optional(),
});
const reviewSchema = z.union([
  meaningSchema
    .extend({ sourcePinyin: z.string().min(1), sourceSense: z.string().min(1) })
    .strict(),
  meaningSchema
    .extend({
      composition: z.array(referenceSchema).min(2),
      pronunciationRule: z.literal("reduplication-neutral").optional(),
    })
    .strict(),
  identitySchema.extend({ excludeReason: z.string().min(1) }).strict(),
]);

interface FrequencyWord {
  hanzi: string;
  id: number;
  rank: number;
}

const WHITESPACE = /\s/;
const TONE_NUMBER = /[1-5]$/;

/**
 * A repeated one-syllable verb (看看): the second syllable takes the neutral tone. Only a verb
 * sense repeated with the same character and reading qualifies.
 */
function reduplicatedReading(
  hanzi: string,
  composition: { hanzi: string; sourcePinyin: string; sourceSense: string }[]
) {
  const [first, second, ...rest] = composition;
  if (
    !(first && second) ||
    rest.length ||
    first.hanzi !== second.hanzi ||
    first.sourcePinyin !== second.sourcePinyin ||
    WHITESPACE.test(second.sourcePinyin) ||
    !first.sourceSense.startsWith("to ")
  ) {
    throw new Error(`Invalid verb reduplication: ${hanzi}`);
  }
  return [first.sourcePinyin, second.sourcePinyin.replace(TONE_NUMBER, "5")];
}

export function resolveWordMeanings(
  words: readonly FrequencyWord[],
  reviews: unknown,
  dictionary: Record<string, DictionaryReading[]>
) {
  const entries = z.array(reviewSchema).parse(reviews);
  const expected = new Map(words.map((word) => [word.id, word]));
  const reviewed = new Map<number, z.infer<typeof reviewSchema>>();
  for (const entry of entries) {
    if (
      expected.get(entry.id)?.hanzi !== entry.hanzi ||
      reviewed.has(entry.id)
    ) {
      throw new Error(
        `Unexpected or duplicate word review: ${entry.id} ${entry.hanzi}`
      );
    }
    reviewed.set(entry.id, entry);
  }
  const missing = words.filter((word) => !reviewed.has(word.id));
  if (missing.length) {
    throw new Error(
      `Missing reviewed words: ${missing.map((word) => word.hanzi).join(" ")}`
    );
  }

  return words.flatMap((word) => {
    const review = reviewed.get(word.id);
    if (!review || "excludeReason" in review) {
      return [];
    }

    const checkReference = (reference: z.infer<typeof referenceSchema>) =>
      verifyDictionaryReading(
        reference.hanzi,
        { ...reference, pinyin: dictionaryPinyin(reference.sourcePinyin) },
        dictionary
      );
    const referencedMeanings = (review.sourceReferences ?? []).flatMap(
      (reference) => checkReference(reference).senses
    );
    let dictionaryMeanings: string[];
    if ("composition" in review) {
      if (
        review.composition.map((part) => part.hanzi).join("") !== word.hanzi
      ) {
        throw new Error(`Composition does not spell word: ${word.hanzi}`);
      }
      review.composition.forEach(checkReference);
      const parts =
        review.pronunciationRule === "reduplication-neutral"
          ? reduplicatedReading(word.hanzi, review.composition)
          : review.composition.map((part) => part.sourcePinyin);
      if (!samePronunciation(review.pinyin, parts.join(" "))) {
        throw new Error(`Composition reading mismatch: ${word.hanzi}`);
      }
      dictionaryMeanings = referencedMeanings;
    } else {
      const reading = verifyDictionaryReading(word.hanzi, review, dictionary);
      dictionaryMeanings = [...reading.senses, ...referencedMeanings];
    }
    return [
      {
        ...word,
        pinyin: review.pinyin,
        meaning: review.meaning,
        dictionaryMeanings: [...new Set(dictionaryMeanings)],
      },
    ];
  });
}
