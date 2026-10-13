const HANZI = /\p{Script=Han}/u;

export interface SentenceToken {
  text: string;
  /** False for a run of Hanzi that no curriculum word covers. */
  word: boolean;
}

/**
 * Split a sentence into curriculum words by longest match from the left. Hanzi no word covers
 * become single-character tokens; punctuation and other script are dropped.
 */
export function segmentSentence(
  hanzi: string,
  words: ReadonlySet<string>,
  longestWord = 4
): SentenceToken[] {
  const characters = Array.from(hanzi);
  const tokens: SentenceToken[] = [];
  let index = 0;
  while (index < characters.length) {
    const character = characters[index] ?? "";
    if (!HANZI.test(character)) {
      index += 1;
      continue;
    }
    let matched = "";
    for (let length = longestWord; length > 0; length -= 1) {
      const candidate = characters.slice(index, index + length).join("");
      if (
        Array.from(candidate).length === length &&
        Array.from(candidate).every((item) => HANZI.test(item)) &&
        words.has(candidate)
      ) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      tokens.push({ text: matched, word: true });
      index += Array.from(matched).length;
    } else {
      tokens.push({ text: character, word: false });
      index += 1;
    }
  }
  return tokens;
}
