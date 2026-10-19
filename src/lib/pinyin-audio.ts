const toneMarks: Record<string, [string, number]> = {
  ā: ["a", 1],
  á: ["a", 2],
  ǎ: ["a", 3],
  à: ["a", 4],
  ē: ["e", 1],
  é: ["e", 2],
  ě: ["e", 3],
  è: ["e", 4],
  ī: ["i", 1],
  í: ["i", 2],
  ǐ: ["i", 3],
  ì: ["i", 4],
  ō: ["o", 1],
  ó: ["o", 2],
  ǒ: ["o", 3],
  ò: ["o", 4],
  ū: ["u", 1],
  ú: ["u", 2],
  ǔ: ["u", 3],
  ù: ["u", 4],
  ǖ: ["ü", 1],
  ǘ: ["ü", 2],
  ǚ: ["ü", 3],
  ǜ: ["ü", 4],
};

const neutralToneExamples: Record<string, { text: string; pinyin: string }> = {
  们: { text: "我们", pinyin: "wǒmen" },
  們: { text: "我們", pinyin: "wǒmen" },
  么: { text: "什么", pinyin: "shénme" },
  麼: { text: "什麼", pinyin: "shénme" },
  的: { text: "我的", pinyin: "wǒde" },
  地: { text: "慢慢地", pinyin: "mànmàn de" },
  子: { text: "孩子", pinyin: "háizi" },
  了: { text: "好了", pinyin: "hǎo le" },
  吗: { text: "好吗", pinyin: "hǎo ma" },
  嗎: { text: "好嗎", pinyin: "hǎo ma" },
  呢: { text: "你呢", pinyin: "nǐ ne" },
  着: { text: "看着", pinyin: "kànzhe" },
  著: { text: "看著", pinyin: "kànzhe" },
  吧: { text: "走吧", pinyin: "zǒu ba" },
  嘛: { text: "对嘛", pinyin: "duì ma" },
  耶: { text: "好耶", pinyin: "hǎo ye" },
};

const MARKED_TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-4]/;
const PHRASE_PUNCTUATION = /[\s,/.!?。！？]/;
const PLAIN_LETTER = /^[a-zü]$/;
const TONE_DIGIT = /^[1-4]$/;

export function getNeutralToneExample(text: string, pinyin: string) {
  const hasMarkedTone = MARKED_TONE.test(pinyin);
  return hasMarkedTone ? null : (neutralToneExamples[text] ?? null);
}

export function getRecordedPinyinPath(pinyin: string) {
  const source = pinyin.trim().toLocaleLowerCase();
  if (!source || PHRASE_PUNCTUATION.test(source)) {
    return null;
  }

  let syllable = "";
  let tone = 0;

  for (const character of source) {
    const marked = toneMarks[character];
    if (marked) {
      const [letter, markedTone] = marked;
      syllable += letter;
      tone = markedTone;
    } else if (PLAIN_LETTER.test(character)) {
      syllable += character;
    } else if (TONE_DIGIT.test(character)) {
      tone = Number(character);
    } else {
      return null;
    }
  }

  if (!tone) {
    return null;
  }

  const recording = `${syllable.replaceAll("ü", "uu")}${tone}`;
  return `/audio/pinyin/${recording}.mp3`;
}
