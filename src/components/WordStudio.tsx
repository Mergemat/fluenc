import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { saveEnrollment, saveLivingLinkOffline } from '../offline/progress'
import type { BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type WordItem = Extract<BuildItem, { type: 'word' }>

export function WordStudio({ item }: { item: WordItem }) {
  const queryClient = useQueryClient()
  const meaning = getItemMeaning(item)
  const [story, setStory] = useState(item.livingLink)
  const [showLivingLink, setShowLivingLink] = useState(Boolean(item.livingLink))
  const [showValidation, setShowValidation] = useState(false)
  const linkTooShort = story.trim().length > 0 && story.trim().length < 4
  const finishMutation = useMutation({
    mutationFn: async () => {
      const trimmedStory = story.trim()
      if (trimmedStory) await saveLivingLinkOffline({ wordId: item.id, story: trimmedStory })
      return saveEnrollment({ itemType: 'word', itemId: item.id })
    },
    onSuccess: async () => {
      setShowValidation(false)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <article className="grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <section className="study-card flex min-h-[520px] flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-3"><span className="study-label">Word {item.rank}</span><span className="rounded-md bg-canvas px-2 py-1 text-[10px] font-bold text-muted">NEW</span></div><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Listen" /></header>
        <div className="grid flex-1 place-items-center px-6 py-12">
          <div className="grid justify-items-center text-center">
            <span className="font-hanzi text-[clamp(5rem,16vw,10rem)] font-semibold leading-none text-glaze" lang="zh-CN">{item.hanzi}</span>
            <strong className="mt-6 text-3xl font-black tracking-[-0.04em]">{item.pinyin}</strong>
            <p className="m-0 mt-1 text-lg font-bold text-muted">{meaning.primary}</p>
          </div>
        </div>
      </section>

      <aside className="study-card flex flex-col overflow-hidden">
        <header className="border-b border-line px-5 py-4"><p className="study-label m-0">Make the connection</p><p className="mb-0 mt-1 text-sm text-muted">Read the known characters as one unit.</p></header>
        <div className="flex flex-1 flex-col gap-7 p-5">
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] font-bold text-glaze">01</span><h2 className="m-0 text-sm font-black">Character parts</h2></div>
            <div className="flex items-center gap-2">
              {item.characterIds.map((character, index) => <span key={`${character}-${index}`} className="contents"><span className="grid size-16 place-items-center rounded-xl border border-line bg-canvas font-hanzi text-3xl font-bold text-glaze" lang="zh-CN">{character}</span>{index < item.characterIds.length - 1 ? <span className="font-bold text-faint">+</span> : null}</span>)}
            </div>
          </section>

          {item.characterIds.length > 1 ? (
            <section>
              <div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] font-bold text-glaze">02</span><h2 className="m-0 text-sm font-black">Living link</h2><span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-faint">Optional</span></div>
              {showLivingLink ? <textarea className={`min-h-28 w-full resize-none rounded-xl border bg-canvas p-3.5 text-sm font-medium leading-relaxed ${showValidation && linkTooShort ? 'border-danger' : 'border-line'} focus:border-ink`} value={story} onChange={(event) => setStory(event.target.value)} placeholder="What makes these parts mean this word?" /> : <button className="grid w-full justify-items-center gap-2 rounded-xl border border-dashed border-line px-4 py-7 text-sm font-bold text-muted hover:border-ink hover:text-ink" type="button" onClick={() => setShowLivingLink(true)}><Link2 size={18} /> Add a memory link</button>}
            </section>
          ) : null}
        </div>
        <footer className="border-t border-line p-5">
          <Button type="button" disabled={finishMutation.isPending} onClick={() => { const length = story.trim().length; if (length === 0 || length >= 4) finishMutation.mutate(); else setShowValidation(true) }}><Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Add to review'}</Button>
          {showValidation && linkTooShort ? <div className="mt-3"><ErrorNote>Write at least four characters or leave it empty.</ErrorNote></div> : null}
          {finishMutation.isError ? <div className="mt-3"><ErrorNote>Could not finish the lesson. Try again.</ErrorNote></div> : null}
        </footer>
      </aside>
    </article>
  )
}
