import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { enrollItem, saveLivingLink, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

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
  const linkTooShort = story.trim().length > 0 && story.trim().length < 4

  return (
    <article className="flex min-h-[calc(100dvh-190px)] flex-col">
      <header className="grid justify-items-center text-center">
        <p className="m-0 mb-4 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">Word · {item.rank}</p>
        <div
          className="grid place-items-center rounded-[2rem] px-9 py-3"
          style={{
            background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
            boxShadow: '0 16px 36px rgb(43 58 66 / 0.16), 0 2px 6px rgb(43 58 66 / 0.06), inset 0 1px 0 #fff',
          }}
        >
          <span className="font-hanzi text-6xl leading-none font-semibold text-glaze" lang="zh-CN">{item.hanzi}</span>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">
          <strong className="text-lg font-light tracking-[0.04em]">{item.pinyin}</strong>
          <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-faint">{meaning.primary}</span>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-8 py-6">
        {item.characterIds.length > 1 ? (
          <div className="flex flex-wrap items-baseline justify-center gap-2">
            {item.characterIds.map((character, index) => (
              <span key={`${character}-${index}`} className="flex items-baseline gap-2">
                <b className="font-hanzi text-3xl leading-none font-semibold text-glaze" lang="zh-CN">{character}</b>
                {index < item.characterIds.length - 1 ? <i className="text-faint not-italic">+</i> : null}
              </span>
            ))}
          </div>
        ) : null}

        {item.characterIds.length > 1 && showLivingLink ? (
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-faint">Living link</span>
            <textarea
              className={`w-full resize-none rounded-2xl bg-white/60 p-3.5 text-[15px] leading-relaxed font-medium shadow-[0_2px_8px_rgb(43_58_66/0.06)] outline-none placeholder:text-faint focus:shadow-[0_0_0_2px_rgb(47_109_158/0.3)] ${showValidation && linkTooShort ? 'shadow-[0_0_0_2px_rgb(176_64_44/0.45)]' : ''}`}
              aria-invalid={showValidation && linkTooShort}
              value={story}
              onChange={(event) => setStory(event.target.value)}
              rows={2}
              placeholder="Connect the characters to the meaning."
            />
          </label>
        ) : item.characterIds.length > 1 ? (
          <div className="grid justify-items-center">
            <Button variant="ghost" className="px-3" type="button" onClick={() => setShowLivingLink(true)}>
              <Link2 size={15} /> Need a link?
            </Button>
          </div>
        ) : null}

        {showValidation && linkTooShort
          ? <ErrorNote>Either leave the link empty, or write at least four characters.</ErrorNote>
          : null}
        {finishMutation.isError ? <ErrorNote>Could not finish the lesson. Try again.</ErrorNote> : null}
      </div>

      <footer className="pt-2">
        <Button
          type="button"
          disabled={finishMutation.isPending}
          onClick={() => { const length = story.trim().length; if (length === 0 || length >= 4) finishMutation.mutate(); else setShowValidation(true) }}
        >
          <Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Learned'}
        </Button>
      </footer>
    </article>
  )
}
