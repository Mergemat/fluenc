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
    ? 'border-jade bg-jade text-white shadow-[0_0_0_4px_rgba(23,107,91,.12)]'
    : speech.status === 'error'
      ? 'border-[#e3b2aa] bg-[#fff3f1] text-fluenc-red'
      : ''
  const shapeClass = label
    ? 'inline-flex h-10 w-max min-w-max flex-none items-center justify-center gap-[7px] rounded-[10px] px-3 text-[11px] font-bold whitespace-nowrap'
    : 'grid size-[35px] shrink-0 place-items-center rounded-full'

  return (
    <button
      className={`${shapeClass} border border-line bg-white text-ink transition-transform active:scale-[.96] hover:border-jade hover:bg-jade hover:text-white ${stateClass} ${className}`.trim()}
      type="button"
      disabled={speech.status === 'loading'}
      onClick={() => speech.speak(text, pinyin)}
      aria-label={label ? `${label}: ${text}, ${pinyin}` : neutralExample ? `Нейтральный тон в примере ${neutralExample.text}` : `Произнести ${text}`}
      title={speech.status === 'error' ? 'Не удалось получить произношение' : neutralExample ? `Нейтральный тон в слове: ${neutralExample.text} · ${neutralExample.pinyin}` : undefined}
    >
      {speech.status === 'loading'
        ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
        : <AudioLines size={18} />}
      {label ? <span>{speech.status === 'loading' ? 'Загружаю…' : label}</span> : null}
    </button>
  )
}
