import { AudioLines, LoaderCircle } from 'lucide-react'

import { useMandarinSpeech } from '../hooks/useMandarinSpeech'
import { getNeutralToneExample } from '../lib/pinyinAudio'

type Props = {
  text: string
  pinyin: string
  label?: string
  className?: string
}

export function MandarinAudioButton({ text, pinyin, label, className = '' }: Props) {
  const speech = useMandarinSpeech()
  const neutralExample = getNeutralToneExample(text, pinyin)
  const stateClass = speech.status === 'speaking'
    ? 'border-accent bg-accent text-white'
    : speech.status === 'error'
      ? 'border-danger/40 bg-danger/5 text-danger'
      : ''
  const shapeClass = label
    ? 'inline-flex h-10 w-max min-w-max flex-none items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold whitespace-nowrap'
    : 'grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper'

  return (
    <button
      className={`${shapeClass} text-ink hover:border-accent hover:bg-accent hover:text-white ${stateClass} ${className}`.trim()}
      type="button"
      disabled={speech.status === 'loading'}
      onClick={() => speech.speak(text, pinyin)}
      aria-label={label ? `${label}: ${text}, ${pinyin}` : neutralExample ? `Neutral tone, as in ${neutralExample.text}` : `Pronounce ${text}`}
      title={speech.status === 'error'
        ? 'Could not get pronunciation'
        : neutralExample
          ? `Neutral tone, as in ${neutralExample.text} · ${neutralExample.pinyin}`
          : undefined}
    >
      {speech.status === 'loading'
        ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={17} />
        : <AudioLines size={17} />}
      {label ? <span>{speech.status === 'loading' ? 'Loading…' : label}</span> : null}
    </button>
  )
}
