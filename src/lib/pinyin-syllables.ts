// Standard Mandarin syllables without tones, grouped by initial. "r" is the erhua suffix 儿.
const groups = {
  "": "a ai an ang ao e ei en eng er o ou",
  b: "ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu",
  p: "pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu",
  m: "ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu",
  f: "fa fan fang fei fen feng fo fou fu",
  d: "da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo",
  t: "ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo",
  n: "na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe",
  l: "la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lü lüe",
  g: "ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo",
  k: "ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo",
  h: "ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo",
  j: "ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun",
  q: "qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun",
  x: "xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun",
  zh: "zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo",
  ch: "cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo",
  sh: "sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo",
  r: "r ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo",
  z: "za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo",
  c: "ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo",
  s: "sa sai san sang sao se sen seng si song sou su suan sui sun suo",
  y: "ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun",
  w: "wa wai wan wang wei wen weng wo wu",
};

export const toneless = new Set(Object.values(groups).join(" ").split(" "));

const TONE_MARKS: Record<string, number> = {
  "\u0304": 1,
  "\u0301": 2,
  "\u030c": 3,
  "\u0300": 4,
};
const MARKS_BY_TONE = ["", "\u0304", "\u0301", "\u030c", "\u0300"];
const UMLAUT = "\u0308";
const VOWELS = new Set(Array.from("aeiouü"));

/** A toned syllable as its toneless spelling and tone (5 when neutral), or null if not Mandarin. */
export function parseSyllable(syllable: string) {
  let base = "";
  let tone = 5;
  let marks = 0;
  for (const char of syllable.toLowerCase().normalize("NFD")) {
    const marked = TONE_MARKS[char];
    if (marked) {
      tone = marked;
      marks += 1;
    } else if (char === UMLAUT && base.endsWith("u")) {
      base = `${base.slice(0, -1)}ü`;
    } else {
      base += char;
    }
  }
  return marks <= 1 && toneless.has(base) ? { base, tone } : null;
}

/** The standard spelling: the mark goes on a or e, on the o of ou, otherwise on the last vowel. */
export function markTone(base: string, tone: number) {
  const letters = Array.from(base);
  if (tone === 5 || !letters.some((letter) => VOWELS.has(letter))) {
    return base;
  }
  let index = letters.findIndex((letter) => letter === "a" || letter === "e");
  if (index < 0) {
    index = base.includes("ou")
      ? base.indexOf("ou")
      : letters.findLastIndex((letter) => VOWELS.has(letter));
  }
  letters[index] = `${letters[index]}${MARKS_BY_TONE[tone]}`.normalize("NFC");
  return letters.join("");
}

/** A single syllable spelled with standard tone-mark placement, in lowercase NFC. */
export function isStandardSyllable(syllable: string) {
  const parsed = parseSyllable(syllable);
  return (
    parsed !== null &&
    syllable === syllable.normalize("NFC") &&
    markTone(parsed.base, parsed.tone) === syllable
  );
}

const SEPARATORS = /[\s'’-]/g;

/**
 * Split a word's reading into one syllable per character. Each piece must be a Mandarin syllable
 * and, where `readings` knows the character, one of its readings without tones (tones may change
 * in words: 一 yí, 不 bú). Returns null when no split, or more than one, fits.
 */
export function splitReading(
  hanzi: string,
  reading: string,
  readings: (character: string) => readonly string[] | undefined
) {
  const characters = Array.from(hanzi);
  const letters = Array.from(
    reading.normalize("NFC").toLowerCase().replace(SEPARATORS, "")
  );
  const found: string[][] = [];
  const walk = (position: number, offset: number, taken: string[]) => {
    if (found.length > 1) {
      return;
    }
    if (position === characters.length) {
      if (offset === letters.length) {
        found.push(taken);
      }
      return;
    }
    const known = readings(characters[position] ?? "");
    for (
      let end = offset + 1;
      end <= Math.min(letters.length, offset + 6);
      end += 1
    ) {
      const piece = letters.slice(offset, end).join("");
      const parsed = parseSyllable(piece);
      if (parsed && (!known || known.includes(parsed.base))) {
        walk(position + 1, end, [...taken, piece]);
      }
    }
  };
  walk(0, 0, []);
  return found.length === 1 ? (found[0] ?? null) : null;
}
