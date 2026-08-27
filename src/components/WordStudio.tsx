import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { enrollItem, saveLivingLink, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { Eyebrow } from './ui/Eyebrow'
import { StudioCard } from './ui/StudioCard'

type WordItem = Extract<BuildItem, { type: 'word' }>

export function WordStudio({ item }: { item: WordItem }) {
  const queryClient = useQueryClient()
  const meaning = splitMeaning(item.meaning)
  const [story, setStory] = useState(item.livingLink)
  const [showLivingLink, setShowLivingLink] = useState(Boolean(item.livingLink))
  const [showValidation, setShowValidation] = useState(false)
  const finishMutation = useMutation({
    mutationFn: async () => {
      const trimmedStory = story.trim()
      if (trimmedStory) await saveLivingLink({ data: { wordId: item.id, story: trimmedStory } })
      return enrollItem({ data: { itemType: 'word', itemId: item.id } })
    },
    onSuccess: async () => {
      setShowValidation(false)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <StudioCard>
      <header className="px-7 pt-6 pb-5 max-[720px]:px-4">
        <Eyebrow>Новое слово · #{item.rank}</Eyebrow>
        <div className="mt-3 flex items-center gap-5">
          <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          <span className="font-hanzi text-[76px] font-semibold leading-none" lang="zh-CN">{item.hanzi}</span>
          <div className="min-w-0"><strong className="text-lg text-jade">{item.pinyin}</strong><span className="mt-1 block text-[24px] font-semibold leading-[1.1] tracking-[-.025em] text-ink">{meaning.primary}</span></div>
        </div>
      </header>
      <div className="flex items-center gap-2.5 border-y border-line px-7 py-4 max-[720px]:px-4 [&>span]:flex [&>span]:items-center [&>span]:gap-2.5 [&_b]:font-hanzi [&_b]:text-[28px] [&_b]:font-semibold [&_b]:leading-none [&_i]:not-italic [&_i]:text-[#93a09a] [&>strong]:ml-auto [&>strong]:text-xs">
        {item.characterIds.map((character, index) => (
          <span key={`${character}-${index}`}>
            <b lang="zh-CN">{character}</b>
            {index < item.characterIds.length - 1 ? <i>+</i> : null}
          </span>
        ))}
        <i>→</i>
        <strong>{meaning.primary}</strong>
      </div>
      {item.characterIds.length > 1 && showLivingLink ? (
        <label className="mx-7 mt-5 mb-6 block max-[720px]:mx-4">
          <span className="mb-2 flex items-center gap-[7px] text-xs font-extrabold"><Link2 size={17} /> Living Link</span>
          <textarea className={`w-full resize-y rounded-[11px] border bg-white px-[15px] py-[12px] text-[13px] leading-normal text-ink outline-0 focus:border-jade focus:shadow-[0_0_0_3px_rgba(23,107,91,.1)] ${showValidation && story.trim().length > 0 && story.trim().length < 4 ? 'border-fluenc-red shadow-[0_0_0_3px_rgba(201,87,70,.1)]' : 'border-[#cdd7d1]'}`} aria-invalid={showValidation && story.trim().length > 0 && story.trim().length < 4} value={story} onChange={(event) => setStory(event.target.value)} rows={2} placeholder="Свяжите знакомые иероглифы со значением." />
        </label>
      ) : item.characterIds.length > 1 ? (
        <div className="mx-7 my-5 max-[720px]:mx-4"><Button variant="secondary" type="button" onClick={() => setShowLivingLink(true)}><Link2 size={16} /> Нужна связь?</Button></div>
      ) : <div className="h-5" />}
      <footer className="flex justify-end border-t border-line px-7 py-5 max-[720px]:px-4">
        <Button type="button" disabled={finishMutation.isPending} onClick={() => { const length = story.trim().length; if (length === 0 || length >= 4) finishMutation.mutate(); else setShowValidation(true) }}>
          <Check size={17} /> {finishMutation.isPending ? 'Сохраняю…' : 'Слово изучено'}
        </Button>
      </footer>
      {showValidation && story.trim().length > 0 && story.trim().length < 4 ? <p className="m-0 bg-[#fae8e4] px-[30px] py-2.5 text-xs leading-[1.45] text-[#9f3528]" role="alert">Либо оставьте связь пустой, либо опишите её хотя бы четырьмя символами.</p> : null}
      {finishMutation.isError ? <p className="m-0 bg-[#fae8e4] px-[30px] py-2.5 text-xs leading-[1.45] text-[#9f3528]" role="alert">Не удалось закончить Build. Попробуйте ещё раз.</p> : null}
    </StudioCard>
  )
}
