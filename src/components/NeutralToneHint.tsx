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
      className={`w-max text-[10px] uppercase tracking-wide text-faint ${className}`.trim()}
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
    <span className={`text-xs text-muted ${className}`.trim()}>
      As in <span className="font-hanzi" lang="zh-CN">{example.text}</span> · {example.pinyin}
    </span>
  )
}
