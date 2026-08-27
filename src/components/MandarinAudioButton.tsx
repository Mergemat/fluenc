import { LoaderCircle } from 'lucide-react'

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
    ? 'text-glaze'
    : speech.status === 'error'
      ? 'text-danger'
      : ''

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-muted hover:text-ink ${
        label ? 'px-2 text-sm font-medium' : 'size-10 shrink-0'
      } ${stateClass} ${className}`.trim()}
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
        : <AudioGlyph />}
      {label ? <span>{speech.status === 'loading' ? 'Loading…' : label}</span> : null}
    </button>
  )
}

function AudioGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="17">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}
