import { getNeutralToneExample } from '../lib/pinyinAudio'

type Props = {
  text: string
  pinyin: string
  className?: string
}

export function NeutralToneBadge({ text, pinyin, className = '' }: Props) {
  const example = getNeutralToneExample(text, pinyin)
  if (!example) return null

  return (
    <span
      className={`w-max rounded-md bg-[#f4ded9] px-1.5 py-1 text-[9px] font-extrabold leading-none text-[#9c3f32] uppercase ${className}`.trim()}
      title={`Нейтральный тон в слове ${example.text} · ${example.pinyin}`}
    >
      нейтр.
    </span>
  )
}

export function NeutralToneExample({ text, pinyin, className = '' }: Props) {
  const example = getNeutralToneExample(text, pinyin)
  if (!example) return null

  return (
    <span className={`text-[10px] text-muted ${className}`.trim()}>
      В слове <span className="font-hanzi font-semibold text-ink" lang="zh-CN">{example.text}</span> · <strong className="text-jade">{example.pinyin}</strong>
    </span>
  )
}
