// PROTOTYPE: Notebook won round 1. Round 2 compares five clue groupings.
// First picture the character and all clues, then fill the associations. No persistence.
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getHanziCompositions } from '../server/hanzi'
import { PrototypeSwitcher } from './ui/PrototypeSwitcher'
import { ClueForm } from './character-studio-prototype/ClueForm'
import { denseCharacter, repeatedCharacter, shapeCharacter, directCharacter, directCharacters, exampleCharacters, type CharacterItem, type Cue, type Sample } from './character-studio-prototype/data'
import { CharacterTarget, DirectCharacter, PropShelf, Notebook, SoundAndShape, SceneCast, ClueStrip, type Studio } from './character-studio-prototype/SceneVariants'
import './character-studio-prototype/studio.css'

const cueKey = (cue: Cue) => `${cue.kind}:${cue.code}`
const actorLabels = { male: 'Male actor', female: 'Female actor', fictional: 'Fictional actor', wildcard: 'Wildcard actor' }

export function CharacterStudioPrototype({ items, example }: { items: CharacterItem[]; example: boolean }) {
  const [sample, setSample] = useState<Sample>('sequence')
  const samples = { sequence: exampleCharacters, dense: [denseCharacter], missing: [exampleCharacters[1]], direct: [directCharacter], repeated: [repeatedCharacter], shape: [shapeCharacter] }
  const queue = example ? samples[sample] : items
  const { variant = 'b' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [index, setIndex] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [screen, setScreen] = useState<'scene' | 'fill'>('scene')
  const [finished, setFinished] = useState(false)
  const [showShapeNote, setShowShapeNote] = useState(false)
  const [showState, setShowState] = useState(false)
  const item = queue[index]
  const direct = directCharacters.has(item.hanzi)
  const { data: compositions } = useQuery({
    queryKey: ['hanzi-compositions', item.hanzi],
    queryFn: () => getHanziCompositions({ data: { characters: [item.hanzi] } }),
  })
  const decomposition = compositions?.[item.hanzi]?.decomposition
  const simpleParts = item.movie.components.length === 2 && item.movie.components.every(part => part.count === 1) && decomposition?.slice(1) === item.movie.components.map((part) => part.hanzi).join('')
  const layout = simpleParts && decomposition?.startsWith('⿰') ? 'horizontal' : simpleParts && decomposition?.startsWith('⿱') ? 'vertical' : undefined
  const positions = layout === 'horizontal' ? ['Left', 'Right'] : layout === 'vertical' ? ['Top', 'Bottom'] : []
  const initialCues: Cue[] = direct ? [
    { id: 'prop', kind: 'prop', code: item.hanzi, name: item.movie.components.find(part => part.hanzi === item.hanzi)?.propName ?? '', role: 'Reusable prop' },
  ] : [
    { id: 'actor', kind: 'actor', code: item.movie.actorKey, name: item.movie.actorName, role: actorLabels[item.movie.actorCategory] },
    { id: 'set', kind: 'set', code: item.movie.finalKey, name: item.movie.setName, role: 'Place code' },
    { id: 'room', kind: 'room', code: String(item.movie.tone), name: item.movie.roomName, role: 'Tone room' },
    ...item.movie.components.map((part, partIndex): Cue => ({ id: `prop-${partIndex}`, kind: 'prop', code: part.hanzi, name: part.propName, count: part.count, role: 'Prop', position: positions[partIndex] })),
  ]
  const cues = initialCues.map((cue) => ({ ...cue, name: names[cueKey(cue)] ?? cue.name }))
  const studio: Studio = { item, cues, layout, meaning: splitMeaning(item.meaning).primary }
  const next = () => {
    if (index + 1 < queue.length) setIndex(index + 1)
    else setFinished(true)
    setScreen('scene')
  }

  useEffect(() => {
    console.info('Character Studio prototype', { variant, example, sample, screen, character: item.hanzi, pinyin: item.pinyin, meaning: studio.meaning, cues, index, finished })
  }, [variant, example, sample, screen, item.hanzi, names, index, finished, decomposition])

  return <article className={`cs-prototype cs-variant-${variant} cs-screen-${screen} ${direct ? 'cs-direct-lesson' : ''} ${cues.length > 5 ? 'cs-dense' : ''}`}>
    <header className="cs-toolbar"><span>Character studio <small>{index + 1}/{queue.length}</small></span><div className="cs-example-switch" aria-label="Prototype content"><button type="button" aria-pressed={!example} onClick={() => void navigate({ search: (previous) => ({ ...previous, variant, example: undefined }), replace: true })}>Yours</button><button type="button" aria-pressed={example} onClick={() => void navigate({ search: (previous) => ({ ...previous, variant, example: 'ming' }), replace: true })}>Example</button></div></header>
    {screen === 'scene' ? <>
      <div className="cs-workspace" aria-label="Character and all clues">
        {direct ? <DirectCharacter {...studio} /> : <>
          {variant === 'a' ? <PropShelf {...studio} /> : null}
          {variant === 'b' ? <Notebook {...studio} /> : null}
          {variant === 'c' ? <SoundAndShape {...studio} /> : null}
          {variant === 'd' ? <SceneCast {...studio} /> : null}
          {variant === 'e' ? <ClueStrip {...studio} /> : null}
        </>}
      </div>
      <footer className="cs-scene-actions"><p><span>1 / 2</span>{item.movie.componentNote ? <button type="button" className="cs-shape-note-button" onClick={() => setShowShapeNote(true)}>Shape note</button> : direct ? 'Picture your prop.' : 'Picture the scene.'}</p><button className="cs-next" type="button" onClick={() => setScreen('fill')}>{direct ? 'Choose a prop' : 'Fill in clues'} <ArrowRight size={18} /></button></footer>
    </> : <div className="cs-fill-screen">
      <CharacterTarget studio={studio} />
      <ClueForm cues={cues} onChange={(cue, value) => setNames((previous) => ({ ...previous, [cueKey(cue)]: value }))} onBack={() => setScreen('scene')} onNext={next} />
    </div>}
    <PrototypeSwitcher screen={screen} onScreenChange={(nextScreen) => { setScreen(nextScreen); setFinished(false) }} sample={sample} example={example} onSampleChange={(nextSample) => { setSample(nextSample); setIndex(0); setNames({}); setFinished(false) }} onShowState={() => setShowState(true)} />
    {finished ? <div className="cs-finished" role="status"><Check size={30} /><h2>That’s the flow.</h2><p>{queue.length} {queue.length === 1 ? 'character' : 'characters'} tried. Your real progress stays as it was.</p><button className="cs-next" type="button" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={16} />Try again</button></div> : null}
    {showShapeNote ? <div className="cs-state-panel cs-shape-note" role="dialog" aria-modal="true" aria-label="Shape note"><header><strong>{item.hanzi} · Shape note</strong><button className="cs-state-close" type="button" aria-label="Close shape note" onClick={() => setShowShapeNote(false)}><X size={18} /></button></header><p>{item.movie.componentNote}</p></div> : null}
    {showState ? <div className="cs-state-panel" role="dialog" aria-modal="true" aria-label="Prototype state"><header><strong>Prototype state</strong><button className="cs-state-close" type="button" aria-label="Close prototype state" onClick={() => setShowState(false)}><X size={18} /></button></header><pre>{JSON.stringify({ variant, example, sample, screen, character: item.hanzi, pinyin: item.pinyin, meaning: studio.meaning, cues, index, finished, persistence: 'none' }, null, 2)}</pre></div> : null}
  </article>
}
