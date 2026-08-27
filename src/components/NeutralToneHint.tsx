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
      className={`w-max rounded-md bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold leading-none text-accent uppercase ${className}`.trim()}
      title={`Neutral tone, as in ${example.text} · ${example.pinyin}`}
    >
      neutral
    </span>
  )
}

export function NeutralToneExample({ text, pinyin, className = '' }: Props) {
  const example = getNeutralToneExample(text, pinyin)
  if (!example) return null

  return (
    <span className={`text-[10px] text-muted ${className}`.trim()}>
      As in <span className="font-hanzi font-semibold text-ink" lang="zh-CN">{example.text}</span> · <strong className="text-accent">{example.pinyin}</strong>
    </span>
  )
}
