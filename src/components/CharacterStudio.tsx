import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { directCharacters } from '../lib/character-props'
import { saveEnrollment, saveMovieOffline } from '../offline/progress'
import { ClueForm } from './character-studio/ClueForm'
import type { CharacterItem, Cue } from './character-studio/types'
import { WritingModal } from './character-studio/WritingModal'
import { CharacterTarget, CharacterScene, type Studio } from './character-studio/CharacterScene'
import './character-studio/studio.css'

const cueKey = (cue: Cue) => `${cue.kind}:${cue.code}`
const actorLabels = { male: 'Male actor', female: 'Female actor', fictional: 'Fictional actor', wildcard: 'Wildcard actor' }

export function CharacterStudio({ item }: { item: CharacterItem }) {
  const queryClient = useQueryClient()
  const [writeOpen, setWriteOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const [screen, setScreen] = useState<'scene' | 'fill'>('scene')
  const [showShapeNote, setShowShapeNote] = useState(false)
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
  const finishMutation = useMutation({
    mutationFn: async () => {
      const name = (kind: Cue['kind']) => cues.find(cue => cue.kind === kind)?.name.trim() ?? ''
      await saveMovieOffline({
        characterId: item.id, actorKey: item.movie.actorKey, actorName: name('actor'),
        finalKey: item.movie.finalKey, setName: name('set'), tone: item.movie.tone, roomName: name('room'),
        props: cues.filter(cue => cue.kind === 'prop').map(cue => ({ component: cue.code, propName: cue.name.trim() })),
      })
      await saveEnrollment({ itemType: 'character', itemId: item.id })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
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
