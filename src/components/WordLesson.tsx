// A word lesson on the character lesson's skeleton: the word glossed character by character,
// its meaning and sound, one optional memory-link row, and "add to reviews". Enter saves.
import { Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { saveEnrollment, saveLivingLinkOffline } from '../offline/progress'
import { useProgressMutation } from '../offline/useProgressMutation'
import type { BuildItem } from '../lib/learner-views'
import { DitherButton } from './dither-kit/button'
import { WordGloss } from './ReviewCard'
import { Rule } from './ui/Dither'
import { AudioButton } from './ui/Hanzi'
import { useToast } from './ui/Toast'

type WordItem = Extract<BuildItem, { type: 'word' }>

export function WordLesson({ item }: { item: WordItem }) {
  const meaning = getItemMeaning(item)
  const syllables = item.syllables ?? null
  const single = Array.from(item.hanzi).length === 1
  const [story, setStory] = useState(item.livingLink)
  const trimmed = story.trim()
  // The server keeps links of four or more characters; anything shorter is a typo, not a link.
  const tooShort = trimmed.length > 0 && trimmed.length < 4
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const finish = useProgressMutation(async () => {
    if (trimmed) await saveLivingLinkOffline({ wordId: item.id, story: trimmed })
    return saveEnrollment({ itemType: 'word', itemId: item.id })
  })

  const primary = () => {
    if (tooShort) { input.current?.focus(); return }
    if (finish.isPending) return
    finish.mutate(undefined, { onSuccess: () => toast(<><b className="font-hanzi">{item.hanzi}</b><span>added to reviews</span></>) })
  }
  const primaryRef = useRef(primary)
  primaryRef.current = primary

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a, [role=dialog]')) return
      event.preventDefault()
      primaryRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const prompt = single ? 'what makes this reading stick?' : `why ${item.characterParts.map(part => part.meaning).join(' + ')} means “${meaning.primary}”`

  return <article className="dx-studio dx-word-lesson" data-hanzi={item.hanzi} data-leaving={finish.isPending}>
    <section className="dx-read dx-word-read" aria-label="Word">
      <WordGloss hanzi={item.hanzi} syllables={syllables} glosses={item.characterParts.map(part => part.meaning)} revealed />
      <div className="dx-ident">
        <h1 className="dx-meaning">{meaning.primary}</h1>
        <p className="dx-alt">{meaning.also ? `also ${meaning.also}` : ' '}</p>
        <div className="dx-sound">{syllables ? null : <span className="dx-py dx-py-plain">{item.pinyin}</span>}<AudioButton text={item.hanzi} pinyin={item.pinyin} label="listen" /></div>
      </div>
    </section>

    <section className="dx-clues" aria-label="Memory link">
      <div className="dx-label"><span>memory link</span><Rule /><span>optional</span></div>
      <div className="dx-rows">
        <label className="dx-row" data-kind="link" data-empty={!trimmed}>
          <span className="dx-code"><Link2 size={18} /></span>
          <span className="dx-role">{prompt}</span>
          <input ref={input} className="dx-input" value={story} placeholder={single ? 'a picture, a pun, a phrase' : 'a picture that joins the parts'}
            aria-label="Memory link" aria-invalid={tooShort} autoComplete="off" spellCheck={false} enterKeyHint="done" disabled={finish.isPending}
            onChange={event => setStory(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.currentTarget.blur(); return }
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              primary()
            }} />
        </label>
      </div>
    </section>

    <footer className="dx-actions">
      <DitherButton className="dx-action" color={tooShort ? 'grey' : 'blue'} variant={tooShort ? 'dotted' : 'gradient'} disabled={finish.isPending} onClick={primary}>
        <span role={finish.isError ? 'alert' : undefined}>{finish.isPending ? 'saving' : tooShort ? 'memory link needs 4+ characters' : finish.isError ? 'could not save — try again' : 'add to reviews'}</span>
        <kbd>↵</kbd>
      </DitherButton>
    </footer>
  </article>
}
