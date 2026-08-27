import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { enrollItem, saveLivingLink, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { Card, ErrorNote } from './ui/Layout'

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
    <Card>
      <header className="p-5 pb-4">
        <p className="m-0 mb-3 text-[10px] font-bold tracking-[.12em] text-faint uppercase">New word · #{item.rank}</p>
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-hanzi text-6xl leading-none font-semibold tracking-tight sm:text-7xl" lang="zh-CN">{item.hanzi}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-base text-accent">{item.pinyin}</strong>
              <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
            </div>
            <span className="mt-0.5 block text-xl font-semibold tracking-tight">{meaning.primary}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-y border-line px-5 py-3.5 text-sm">
        {item.characterIds.map((character, index) => (
          <span key={`${character}-${index}`} className="flex items-center gap-2">
            <b className="font-hanzi text-2xl leading-none font-semibold" lang="zh-CN">{character}</b>
            {index < item.characterIds.length - 1 ? <i className="text-faint not-italic">+</i> : null}
          </span>
        ))}
        <i className="text-faint not-italic">→</i>
        <strong className="text-xs font-semibold">{meaning.primary}</strong>
      </div>

      {item.characterIds.length > 1 && showLivingLink ? (
        <label className="block p-5">
          <span className="mb-2 flex items-center gap-1.5 text-xs font-bold"><Link2 size={15} /> Living link</span>
          <textarea
            className={`w-full resize-y rounded-xl border bg-paper px-3.5 py-2.5 text-sm leading-relaxed focus:border-accent ${showValidation && story.trim().length > 0 && story.trim().length < 4 ? 'border-danger' : 'border-line'}`}
            aria-invalid={showValidation && story.trim().length > 0 && story.trim().length < 4}
            value={story}
            onChange={(event) => setStory(event.target.value)}
            rows={2}
            placeholder="Connect the familiar characters to the meaning."
          />
        </label>
      ) : item.characterIds.length > 1 ? (
        <div className="p-5">
          <Button variant="secondary" type="button" onClick={() => setShowLivingLink(true)}>
            <Link2 size={15} /> Need a link?
          </Button>
        </div>
      ) : null}

      <footer className="border-t border-line p-5">
        <Button
          className="w-full sm:w-auto"
          type="button"
          disabled={finishMutation.isPending}
          onClick={() => { const length = story.trim().length; if (length === 0 || length >= 4) finishMutation.mutate(); else setShowValidation(true) }}
        >
          <Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Mark as learned'}
        </Button>
      </footer>
      {showValidation && story.trim().length > 0 && story.trim().length < 4
        ? <ErrorNote>Either leave the link empty, or write at least four characters.</ErrorNote>
        : null}
      {finishMutation.isError ? <ErrorNote>Could not finish the lesson. Try again.</ErrorNote> : null}
    </Card>
  )
}
