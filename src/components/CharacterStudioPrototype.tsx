// PROTOTYPE: A selected. Props sit to the right and select their character strokes.
// First picture the character and all clues, then fill the associations. No persistence.
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { ClueForm } from './character-studio-prototype/ClueForm'
import { directCharacters, exampleQueues, type CharacterItem, type Cue, type Example } from './character-studio-prototype/data'
import { CharacterTarget, CharacterScene, type Studio } from './character-studio-prototype/CharacterScene'
import './character-studio-prototype/studio.css'

const cueKey = (cue: Cue) => `${cue.kind}:${cue.code}`
const actorLabels = { male: 'Male actor', female: 'Female actor', fictional: 'Fictional actor', wildcard: 'Wildcard actor' }

export function CharacterStudioPrototype({ items, example }: { items: CharacterItem[]; example?: Example }) {
  const queue = example ? exampleQueues[example] : items
  const navigate = useNavigate({ from: '/' })
  const [index, setIndex] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [screen, setScreen] = useState<'scene' | 'fill'>('scene')
  const [finished, setFinished] = useState(false)
  const [showShapeNote, setShowShapeNote] = useState(false)
  const item = queue[index]
  const direct = directCharacters.has(item.hanzi)
  const initialCues: Cue[] = direct ? [
    { id: 'prop', kind: 'prop', code: item.hanzi, name: item.movie.components.find(part => part.hanzi === item.hanzi)?.propName ?? '', role: 'Reusable prop' },
  ] : [
    { id: 'actor', kind: 'actor', code: item.movie.actorKey, name: item.movie.actorName, role: actorLabels[item.movie.actorCategory] },
    { id: 'set', kind: 'set', code: item.movie.finalKey, name: item.movie.setName, role: 'Place code' },
    { id: 'room', kind: 'room', code: String(item.movie.tone), name: item.movie.roomName, role: 'Tone room' },
    ...item.movie.components.map((part, partIndex): Cue => ({ id: `prop-${partIndex}`, kind: 'prop', code: part.hanzi, name: part.propName, count: part.count, role: 'Prop' })),
  ]
  const cues = initialCues.map((cue) => ({ ...cue, name: names[cueKey(cue)] ?? cue.name }))
  const studio: Studio = { item, cues, meaning: getItemMeaning(item).primary }
  const next = () => {
    if (index + 1 < queue.length) setIndex(index + 1)
    else setFinished(true)
    setScreen('scene')
  }

  useEffect(() => {
    console.info('Character Studio prototype', { example, screen, character: item.hanzi, pinyin: item.pinyin, meaning: studio.meaning, cues, index, finished })
  }, [example, screen, item.hanzi, names, index, finished])

  return <article className={`cs-prototype cs-screen-${screen} ${direct ? 'cs-direct-lesson' : ''} ${cues.length > 5 ? 'cs-dense' : ''}`}>
    <header className="cs-toolbar"><span>Character studio <small>{index + 1}/{queue.length}</small></span><div className="cs-example-switch" aria-label="Prototype content"><button type="button" aria-pressed={!example} onClick={() => void navigate({ search: (previous) => ({ ...previous, example: undefined }), replace: true })}>Yours</button><button type="button" aria-pressed={Boolean(example)} onClick={() => void navigate({ search: (previous) => ({ ...previous, example: 'ming' }), replace: true })}>Example</button></div></header>
    {screen === 'scene' ? <>
      <div className="cs-workspace" aria-label="Character and all clues">
        <CharacterScene key={item.hanzi} studio={studio} direct={direct} />
      </div>
      <footer className="cs-scene-actions"><p><span>1 / 2</span>{item.movie.componentNote ? <button type="button" className="cs-shape-note-button" onClick={() => setShowShapeNote(true)}>Shape note</button> : direct ? 'Picture your prop.' : 'Picture the scene.'}</p><button className="cs-next" type="button" onClick={() => setScreen('fill')}>{direct ? 'Choose a prop' : 'Fill in clues'} <ArrowRight size={18} /></button></footer>
    </> : <div className="cs-fill-screen">
      <CharacterTarget studio={studio} />
      <ClueForm cues={cues} onChange={(cue, value) => setNames((previous) => ({ ...previous, [cueKey(cue)]: value }))} onBack={() => setScreen('scene')} onNext={next} />
    </div>}
    {finished ? <div className="cs-finished" role="status"><Check size={30} /><h2>That’s the flow.</h2><p>{queue.length} {queue.length === 1 ? 'character' : 'characters'} tried. Your real progress stays as it was.</p><button className="cs-next" type="button" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={16} />Try again</button></div> : null}
    {showShapeNote ? <div className="cs-state-panel cs-shape-note" role="dialog" aria-modal="true" aria-label="Shape note"><header><strong>{item.hanzi} · Shape note</strong><button className="cs-state-close" type="button" aria-label="Close shape note" onClick={() => setShowShapeNote(false)}><X size={18} /></button></header><p>{item.movie.componentNote}</p></div> : null}
  </article>
}
