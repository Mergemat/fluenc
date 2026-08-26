export type ToneDetail = {
  mark: string
  syllable: string
  label: string
  contour: string
  motion: string
}

export const toneDetails: Record<number, ToneDetail> = {
  1: { mark: 'ā', syllable: 'mā', label: 'Ровный высокий', contour: '→', motion: 'держите голос ровно' },
  2: { mark: 'á', syllable: 'má', label: 'Восходящий', contour: '↗', motion: 'поднимите голос' },
  3: { mark: 'ǎ', syllable: 'mǎ', label: 'Низкий с подъёмом', contour: '↘↗', motion: 'опустите и поднимите голос' },
  4: { mark: 'à', syllable: 'mà', label: 'Резко падающий', contour: '↘', motion: 'резко опустите голос' },
  5: { mark: 'a', syllable: 'ma', label: 'Нейтральный', contour: '•', motion: 'скажите коротко и легко' },
}

export function getToneMark(tone: number) {
  return toneDetails[tone]?.mark ?? String(tone)
}

export function getToneSyllable(tone: number) {
  return toneDetails[tone]?.syllable ?? String(tone)
}

export function getToneDetail(tone: number) {
  return toneDetails[tone]
}
