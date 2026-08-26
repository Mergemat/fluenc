import { MandarinAudioButton } from './MandarinAudioButton'

type Props = {
  pinyin: string
  label?: string | null
  className?: string
}

export function ToneAudioButton({ pinyin, label = 'Проиграть звук', className }: Props) {
  return (
    <MandarinAudioButton
      className={className}
      text={pinyin === 'ma' ? '吗' : '妈'}
      pinyin={pinyin}
      label={label ?? undefined}
    />
  )
}
