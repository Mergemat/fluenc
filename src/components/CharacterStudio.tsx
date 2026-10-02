import { ArrowRight, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { directCharacters } from '../lib/character-props'
import { useProgressMutation } from '../offline/useProgressMutation'
import { saveEnrollment, saveMovieOffline } from '../offline/progress'
import { characterCues } from './character-studio/cues'
import { ClueForm } from './character-studio/ClueForm'
import type { CharacterItem, Cue } from './character-studio/types'
import { WritingModal } from './character-studio/WritingModal'
import { CharacterTarget, CharacterScene, type Studio } from './character-studio/CharacterScene'
import './character-studio/studio.css'

const cueKey = (cue: Cue) => `${cue.kind}:${cue.code}`

export function CharacterStudio({ item }: { item: CharacterItem }) {
  const [writeOpen, setWriteOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const [screen, setScreen] = useState<'scene' | 'fill'>('scene')
  const [showShapeNote, setShowShapeNote] = useState(false)
  const direct = directCharacters.has(item.hanzi)
  const cues = characterCues(item).map((cue) => ({ ...cue, name: names[cueKey(cue)] ?? cue.name }))
  const { primary, alternatives } = getItemMeaning(item)
  const studio: Studio = { item, cues, meaning: [primary, ...alternatives.slice(0, 1)].join('; ') }
  const finishMutation = useProgressMutation(async () => {
    const name = (kind: Cue['kind']) => cues.find(cue => cue.kind === kind)?.name.trim() ?? ''
    const movie = await saveMovieOffline({
      characterId: item.id, actorKey: item.movie.actorKey, actorName: name('actor'),
      finalKey: item.movie.finalKey, setName: name('set'), tone: item.movie.tone, roomName: name('room'),
      props: cues.filter(cue => cue.kind === 'prop').map(cue => ({ component: cue.code, propName: cue.name.trim() })),
    })
    const enrollment = await saveEnrollment({ itemType: 'character', itemId: item.id })
    return { ...enrollment, palace: movie.palace }
  })

  return <article className={`cs-studio cs-screen-${screen} ${direct ? 'cs-direct-lesson' : ''} ${cues.length > 5 ? 'cs-dense' : ''}`}>
    <header className="cs-toolbar"><span>Character studio <small>{item.rank}</small></span><button className="cs-write-button" type="button" onClick={() => setWriteOpen(true)}><Pencil size={14} /> Write</button></header>
    {screen === 'scene' ? <>
      <div className="cs-workspace" aria-label="Character and all clues">
        <CharacterScene key={item.hanzi} studio={studio} direct={direct} />
      </div>
      <footer className="cs-scene-actions"><p><span>1 / 2</span>{item.movie.componentNote ? <button type="button" className="cs-shape-note-button" onClick={() => setShowShapeNote(true)}>Shape note</button> : direct ? 'Picture your prop.' : 'Picture the scene.'}</p><button className="cs-next" type="button" onClick={() => setScreen('fill')}>{direct ? 'Choose a prop' : 'Fill in clues'} <ArrowRight size={18} /></button></footer>
    </> : <div className="cs-fill-screen">
      <CharacterTarget studio={studio} />
      <ClueForm cues={cues} onChange={(cue, value) => setNames((previous) => ({ ...previous, [cueKey(cue)]: value }))} onBack={() => setScreen('scene')} onNext={() => finishMutation.mutate()} pending={finishMutation.isPending} error={finishMutation.isError} />
    </div>}
    {writeOpen ? <WritingModal character={item.hanzi} onClose={() => setWriteOpen(false)} /> : null}
    {showShapeNote ? <div className="cs-state-panel cs-shape-note" role="dialog" aria-modal="true" aria-label="Shape note"><header><strong>{item.hanzi} · Shape note</strong><button className="cs-state-close" type="button" aria-label="Close shape note" onClick={() => setShowShapeNote(false)}><X size={18} /></button></header><p>{item.movie.componentNote}</p></div> : null}
  </article>
}
