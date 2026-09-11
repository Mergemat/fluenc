import { ArrowRight, Link2 } from 'lucide-react'
import { useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { useProgressMutation } from '../offline/useProgressMutation'
import { saveEnrollment, saveLivingLinkOffline } from '../offline/progress'
import type { BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { DictionaryMeanings } from './DictionaryMeanings'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type WordItem = Extract<BuildItem, { type: 'word' }>

export function WordStudio({ item }: { item: WordItem }) {
  const singleCharacter = Array.from(item.hanzi).length === 1
  const meaning = getItemMeaning(item)
  const [story, setStory] = useState(item.livingLink)
  const [showLivingLink, setShowLivingLink] = useState(Boolean(item.livingLink))
  const [showValidation, setShowValidation] = useState(false)
  const linkTooShort = story.trim().length > 0 && story.trim().length < 4
  const finishMutation = useProgressMutation(async () => {
    const trimmedStory = story.trim()
    if (trimmedStory) await saveLivingLinkOffline({ wordId: item.id, story: trimmedStory })
    return saveEnrollment({ itemType: 'word', itemId: item.id })
  })

  return <article className="word-studio">
    <div className="word-target recall-target">
      <p className="study-label">{singleCharacter ? 'Character reading' : 'Word'} {item.rank}</p>
      <p className="recall-hanzi recall-word font-hanzi" lang="zh-CN">{item.hanzi}</p>
      <div className="answer-sound"><strong>{item.pinyin}</strong><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
      <p className="answer-meaning">{meaning.primary}</p>
      <DictionaryMeanings meanings={meaning.alternatives} />
    </div>
    {item.characterIds.length > 1 ? <section className="word-connections">
      <div className="word-parts"><span className="study-label">Character parts</span><div>
        {item.characterIds.map((character, index) => <span key={`${character}-${index}`} className="contents"><span className="word-part font-hanzi" lang="zh-CN">{character}</span>{index < item.characterIds.length - 1 ? <span className="text-faint">+</span> : null}</span>)}
      </div></div>
      <div className="word-link">
        <label className="study-label" htmlFor="word-story">Memory link <span>Optional</span></label>
        {showLivingLink ? <textarea id="word-story" aria-invalid={showValidation && linkTooShort} value={story} onChange={(event) => setStory(event.target.value)} placeholder="What makes these parts mean this word?" /> : <button type="button" onClick={() => setShowLivingLink(true)}><Link2 size={16} /> Add a memory link</button>}
      </div>
    </section> : null}
    <footer className="lesson-footer"><p>{item.characterIds.length > 1 ? 'Read the characters as one word.' : 'Learn this reading and meaning.'}</p><Button type="button" disabled={finishMutation.isPending} onClick={() => { if (!linkTooShort) finishMutation.mutate(); else setShowValidation(true) }}>{finishMutation.isPending ? 'Saving…' : 'Add to review'} <ArrowRight size={16} /></Button></footer>
    {showValidation && linkTooShort ? <ErrorNote>Write at least four characters or leave it empty.</ErrorNote> : null}
    {finishMutation.isError ? <ErrorNote>Could not finish the lesson. Try again.</ErrorNote> : null}
  </article>
}
