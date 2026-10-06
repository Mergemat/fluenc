export interface ToneDetail {
  contour: string;
  label: string;
  mark: string;
  motion: string;
  syllable: string;
}

export const toneDetails: Record<number, ToneDetail> = {
  1: {
    mark: "ā",
    syllable: "mā",
    label: "High level",
    contour: "→",
    motion: "hold the pitch flat",
  },
  2: {
    mark: "á",
    syllable: "má",
    label: "Rising",
    contour: "↗",
    motion: "let the pitch rise",
  },
  3: {
    mark: "ǎ",
    syllable: "mǎ",
    label: "Dipping",
    contour: "↘↗",
    motion: "dip down, then rise",
  },
  4: {
    mark: "à",
    syllable: "mà",
    label: "Falling",
    contour: "↘",
    motion: "drop the pitch sharply",
  },
  5: {
    mark: "a",
    syllable: "ma",
    label: "Neutral",
    contour: "•",
    motion: "say it short and light",
  },
};

export function getToneMark(tone: number) {
  return toneDetails[tone]?.mark ?? String(tone);
}

export function getToneSyllable(tone: number) {
  return toneDetails[tone]?.syllable ?? String(tone);
}

export function getToneDetail(tone: number) {
  return toneDetails[tone];
}
