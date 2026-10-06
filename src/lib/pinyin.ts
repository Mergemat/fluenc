const tonedVowels: Record<string, { base: string; tone: number }> = {
  ā: { base: "a", tone: 1 },
  á: { base: "a", tone: 2 },
  ǎ: { base: "a", tone: 3 },
  à: { base: "a", tone: 4 },
  ē: { base: "e", tone: 1 },
  é: { base: "e", tone: 2 },
  ě: { base: "e", tone: 3 },
  è: { base: "e", tone: 4 },
  ī: { base: "i", tone: 1 },
  í: { base: "i", tone: 2 },
  ǐ: { base: "i", tone: 3 },
  ì: { base: "i", tone: 4 },
  ō: { base: "o", tone: 1 },
  ó: { base: "o", tone: 2 },
  ǒ: { base: "o", tone: 3 },
  ò: { base: "o", tone: 4 },
  ū: { base: "u", tone: 1 },
  ú: { base: "u", tone: 2 },
  ǔ: { base: "u", tone: 3 },
  ù: { base: "u", tone: 4 },
  ǖ: { base: "ü", tone: 1 },
  ǘ: { base: "ü", tone: 2 },
  ǚ: { base: "ü", tone: 3 },
  ǜ: { base: "ü", tone: 4 },
};

const standardInitials = [
  "zh",
  "ch",
  "sh",
  "b",
  "p",
  "m",
  "f",
  "d",
  "t",
  "n",
  "l",
  "g",
  "k",
  "h",
  "j",
  "q",
  "x",
  "r",
  "z",
  "c",
  "s",
  "y",
  "w",
];
const fakeIFinals = new Set(["zhi", "chi", "shi", "ri", "zi", "ci", "si"]);

export interface MovieCoordinates {
  actorCategory: "male" | "female" | "fictional" | "wildcard";
  actorKey: string;
  finalKey: string;
  syllable: string;
  tone: number;
}

export const defaultToneRooms: Record<number, string> = {
  1: "Entrance hall",
  2: "Kitchen",
  3: "Bedroom",
  4: "Bathroom",
  5: "Rooftop",
};

const SYLLABLE_SEPARATOR = /[\s,/]+/;
const TONE_DIGIT = /^[1-5]$/;
const WILDCARD_ACTOR = /^[jqx]u$/;
// Finals written in a contracted form, and bare nasal finals, spelled out in full.
const CONTRACTED_FINALS: Record<string, string> = {
  iu: "iou",
  ui: "uei",
  un: "uen",
};
const BARE_FINALS: Record<string, string> = { n: "en", ng: "eng" };

function getActorCategory(actorKey: string): MovieCoordinates["actorCategory"] {
  if (actorKey.includes("ü") || WILDCARD_ACTOR.test(actorKey)) {
    return "wildcard";
  }
  if (actorKey.includes("u") || actorKey === "w") {
    return "fictional";
  }
  if (actorKey.includes("i") || actorKey === "y") {
    return "female";
  }
  return "male";
}

/** The first syllable without tone marks, and its tone (5 when neutral). */
function readSyllable(pinyin: string) {
  const source = pinyin.toLowerCase().split(SYLLABLE_SEPARATOR)[0] || "";
  let tone = 5;
  let syllable = "";
  for (const char of source) {
    const toned = tonedVowels[char];
    if (toned) {
      const { base, tone: markedTone } = toned;
      syllable += base;
      tone = markedTone;
    } else if (TONE_DIGIT.test(char)) {
      tone = Number(char);
    } else {
      syllable += char;
    }
  }
  return { syllable: syllable.replace("u:", "ü").replace("v", "ü"), tone };
}

/** The actor and final for an initial, moving a medial i, u or ü onto the actor. */
function actorAndFinal(initial: string, rest: string) {
  if (initial === "w") {
    return { actorKey: "w", final: rest === "u" ? "" : rest };
  }
  if (initial === "y") {
    if (rest.startsWith("i")) {
      return { actorKey: "y", final: rest.slice(1) };
    }
    if (rest.startsWith("u")) {
      return { actorKey: "yü", final: rest.slice(1) };
    }
    return { actorKey: "y", final: rest };
  }
  const final = CONTRACTED_FINALS[rest] ?? rest;
  const carriedVowel = final.at(0);
  if (carriedVowel === "i" || carriedVowel === "u" || carriedVowel === "ü") {
    return { actorKey: `${initial}${carriedVowel}`, final: final.slice(1) };
  }
  return { actorKey: initial || "ø", final };
}

export function getMovieCoordinates(pinyin: string): MovieCoordinates {
  const { syllable, tone } = readSyllable(pinyin);
  if (syllable === "er") {
    return {
      syllable,
      actorKey: "ø",
      finalKey: "ø",
      tone,
      actorCategory: "male",
    };
  }

  const initial =
    standardInitials.find((candidate) => syllable.startsWith(candidate)) ?? "";
  if (fakeIFinals.has(syllable)) {
    return {
      syllable,
      actorKey: initial,
      finalKey: "ø",
      tone,
      actorCategory: "male",
    };
  }

  const { actorKey, final } = actorAndFinal(
    initial,
    syllable.slice(initial.length)
  );
  return {
    syllable,
    actorKey,
    finalKey: (BARE_FINALS[final] ?? final) || "ø",
    tone,
    actorCategory: getActorCategory(actorKey),
  };
}
