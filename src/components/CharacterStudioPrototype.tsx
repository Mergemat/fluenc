// PROTOTYPE: character canvas, scene sentence, and split shape/sound workspace.
// Tap any visible clue to edit its association at the thumb rail. No persistence.
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronLeft, ChevronRight, CookingPot, DoorOpen, House, RotateCcw, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { getHanziCompositions } from '../server/hanzi'
import { MandarinAudioButton } from './MandarinAudioButton'
import { PrototypeSwitcher } from './ui/PrototypeSwitcher'
import { exampleCharacters, type CharacterItem, type Cue } from './character-studio-prototype/data'
import './character-studio-prototype/studio.css'

type Studio = {
  item: CharacterItem
  meaning: string
  cues: Cue[]
  selected: string
  layout?: 'horizontal' | 'vertical'
  example: boolean
  select: (cue: Cue) => void
}

const cueKey = (cue: Cue) => `${cue.kind}:${cue.code}`

export function CharacterStudioPrototype({ items, example }: { items: CharacterItem[]; example: boolean }) {
  const queue = example ? exampleCharacters : items
  const { variant = 'a' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [index, setIndex] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [showState, setShowState] = useState(false)
  const [needsClue, setNeedsClue] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const item = queue[index]
  const { data: compositions } = useQuery({
    queryKey: ['hanzi-compositions', item.hanzi],
    queryFn: () => getHanziCompositions({ data: { characters: [item.hanzi] } }),
  })
  const decomposition = compositions?.[item.hanzi]?.decomposition
  const simpleParts = item.movie.components.length === 2 && decomposition?.slice(1) === item.movie.components.map((part) => part.hanzi).join('')
  const layout = simpleParts && decomposition?.startsWith('⿰') ? 'horizontal' : simpleParts && decomposition?.startsWith('⿱') ? 'vertical' : undefined
  const positions = layout === 'horizontal' ? ['Left', 'Right'] : layout === 'vertical' ? ['Top', 'Bottom'] : []
  const initialCues: Cue[] = [
    { id: 'actor', kind: 'actor', code: item.movie.actorKey, name: item.movie.actorName, role: 'Actor' },
    { id: 'set', kind: 'set', code: item.movie.finalKey, name: item.movie.setName, role: 'Set' },
    { id: 'room', kind: 'room', code: String(item.movie.tone), name: item.movie.roomName, role: 'Tone room' },
    ...item.movie.components.map((part, partIndex): Cue => ({ id: `prop-${partIndex}`, kind: 'prop', code: part.hanzi, name: part.propName, role: 'Prop', position: positions[partIndex] })),
  ]
  const cues = initialCues.map((cue) => ({ ...cue, name: names[cueKey(cue)] ?? cue.name }))
  const missing = cues.find((cue) => !cue.name.trim())
  const activeCue = cues.find((cue) => cue.id === selected) ?? missing ?? cues[0]
  const select = (cue: Cue) => {
    setSelected(cue.id)
    input.current?.focus({ preventScroll: true })
  }
  const studio: Studio = { item, cues, layout, meaning: splitMeaning(item.meaning).primary, example, selected: activeCue.id, select }
  const next = () => {
    if (missing) {
      setNeedsClue(true)
      select(missing)
      return
    }
    setNeedsClue(false)
    setSelected(null)
    if (index + 1 < queue.length) setIndex(index + 1)
    else setFinished(true)
    input.current?.blur()
  }
  const cycleCue = (direction: number) => {
    const current = cues.findIndex((cue) => cue.id === activeCue.id)
    select(cues[(current + direction + cues.length) % cues.length])
  }

  useEffect(() => {
    console.info('Character Studio prototype', { variant, example, character: item.hanzi, pinyin: item.pinyin, meaning: studio.meaning, cues, selected: activeCue.id, index, finished })
  }, [variant, example, item.hanzi, names, selected, index, finished, decomposition])

  return <article className={`cs-prototype cs-variant-${variant} ${cues.length > 7 ? 'cs-dense' : ''}`}>
    <header className="cs-toolbar"><span>Character studio <small>{index + 1}/{queue.length}</small></span><div className="cs-example-switch" aria-label="Prototype content"><button type="button" aria-pressed={!example} onClick={() => void navigate({ search: (previous) => ({ ...previous, variant, example: undefined }), replace: true })}>Yours</button><button type="button" aria-pressed={example} onClick={() => void navigate({ search: (previous) => ({ ...previous, variant, example: 'ming' }), replace: true })}>Example</button></div></header>
    <div className="cs-workspace">
      {variant === 'a' ? <CharacterCanvasVariant {...studio} /> : null}
      {variant === 'b' ? <SceneSentenceVariant {...studio} /> : null}
      {variant === 'c' ? <ShapeSoundVariant {...studio} /> : null}
    </div>
    <section className="cs-thumb-rail" aria-label="Edit selected clue">
      <div className="cs-editor-label"><label htmlFor="cs-clue-input"><span className={`cs-dot cs-dot-${activeCue.kind}`} />{activeCue.role}<b>{activeCue.kind === 'room' ? `Tone ${activeCue.code}` : activeCue.code}</b></label><div><button type="button" aria-label="Previous clue" onClick={() => cycleCue(-1)}><ChevronLeft size={15} /></button><span>{cues.findIndex((cue) => cue.id === activeCue.id) + 1}/{cues.length}</span><button type="button" aria-label="Next clue" onClick={() => cycleCue(1)}><ChevronRight size={15} /></button></div></div>
      <form onSubmit={(event) => { event.preventDefault(); next() }}>
        <input ref={input} id="cs-clue-input" aria-label={`${activeCue.role} for ${activeCue.code}`} autoComplete="off" spellCheck={false} enterKeyHint="next" placeholder={`Name your ${activeCue.kind}`} value={activeCue.name} onChange={(event) => { setSelected(activeCue.id); setNames((previous) => ({ ...previous, [cueKey(activeCue)]: event.target.value })); setNeedsClue(false) }} />
        <button className="cs-next" type="submit">Next <ArrowRight size={18} /></button>
      </form>
      <p aria-live="polite">{needsClue && missing ? `Choose your ${missing.kind} to continue.` : item.movie.isPrimitive ? 'Picture this prop. Then go on.' : 'Picture the scene. Then go on.'}</p>
    </section>
    <PrototypeSwitcher onShowState={() => setShowState(true)} />
    {finished ? <div className="cs-finished" role="status"><Check size={30} /><h2>That’s the flow.</h2><p>{queue.length} {queue.length === 1 ? 'character' : 'characters'} tried. Your real progress stays as it was.</p><button className="cs-next" type="button" onClick={() => { setIndex(0); setFinished(false) }}><RotateCcw size={16} />Try again</button></div> : null}
    {showState ? <div className="cs-state-panel" role="dialog" aria-modal="true" aria-label="Prototype state"><header><strong>Prototype state</strong><button className="cs-state-close" type="button" aria-label="Close prototype state" onClick={() => setShowState(false)}><X size={18} /></button></header><pre>{JSON.stringify({ variant, example, character: item.hanzi, pinyin: item.pinyin, meaning: studio.meaning, cues, selected: activeCue.id, index, finished, persistence: 'none' }, null, 2)}</pre></div> : null}
  </article>
}

function CueThumbnail({ cue, example }: { cue: Cue; example: boolean }) {
  const tile = example ? cue.kind === 'actor' && cue.name === 'Michelle Yeoh' ? 'actor' : cue.kind === 'set' && cue.name === 'My primary school' ? 'set' : cue.kind === 'prop' && cue.name === 'Sun' ? 'sun' : cue.kind === 'prop' && cue.name === 'Moon' ? 'moon' : null : null
  return <span className={`cs-thumb ${tile ? `cs-photo cs-photo-${tile}` : ''}`} aria-hidden="true">{!tile ? cue.kind === 'actor' ? <UserRound size={18} /> : cue.kind === 'set' ? <House size={18} /> : cue.kind === 'room' ? /kitchen/i.test(cue.name) ? <CookingPot size={18} /> : <DoorOpen size={18} /> : <span className="font-hanzi">{cue.code}</span> : null}</span>
}

function CueButton({ cue, studio, picture = false }: { cue: Cue; studio: Studio; picture?: boolean }) {
  const tone = getToneDetail(studio.item.movie.tone)
  return <button className={`cs-cue cs-cue-${cue.kind} ${studio.selected === cue.id ? 'cs-selected' : ''} ${cue.name.trim() ? '' : 'cs-unset'}`} type="button" onClick={() => studio.select(cue)} aria-label={`Edit ${cue.role}: ${cue.name || cue.code}`} aria-pressed={studio.selected === cue.id}>
    <span className="cs-cue-top">{picture ? <CueThumbnail cue={cue} example={studio.example} /> : null}<b className={cue.kind === 'prop' ? 'font-hanzi' : ''} lang={cue.kind === 'prop' ? 'zh-CN' : undefined}>{cue.kind === 'room' ? tone.contour : cue.code}</b><small>{cue.position || cue.role}</small></span>
    <strong>{cue.name || `Choose ${cue.kind}`}</strong>
  </button>
}

function CharacterTarget({ studio }: { studio: Studio }) {
  const tone = getToneDetail(studio.item.movie.tone)
  return <div className="cs-character-target">
    <span className="cs-target-hanzi font-hanzi" lang="zh-CN">{studio.item.hanzi}</span>
    <div className="cs-target-pinyin"><strong>{studio.item.pinyin}</strong><MandarinAudioButton text={studio.item.hanzi} pinyin={studio.item.pinyin} /></div>
    <div className="cs-target-details"><h2>{studio.meaning}</h2><span className="cs-tone"><b>{tone.contour}</b>{tone.label} · {studio.item.movie.tone}</span></div>
  </div>
}

function PropClues({ studio }: { studio: Studio }) {
  return <div className={`cs-prop-clues ${studio.layout === 'vertical' ? 'cs-parts-vertical' : ''}`} aria-label="Character components">{studio.cues.filter((cue) => cue.kind === 'prop').map((cue) => <CueButton key={cue.id} cue={cue} studio={studio} />)}</div>
}

export function CharacterCanvasVariant(studio: Studio) {
  const [actor, set, room] = studio.cues
  return <div className="cs-canvas">
    <div className="cs-sound-pair"><CueButton cue={actor} studio={studio} /><CueButton cue={set} studio={studio} /></div>
    <CharacterTarget studio={studio} />
    <PropClues studio={studio} />
    <div className="cs-location"><CueButton cue={room} studio={studio} /><span>{studio.item.movie.isPrimitive ? 'One reusable prop' : 'One scene in this room'}</span></div>
  </div>
}

export function SceneSentenceVariant(studio: Studio) {
  const [actor, set, room, ...props] = studio.cues
  return <div className="cs-sentence">
    <CharacterTarget studio={studio} />
    <div className="cs-scene-sentence"><div className="cs-sentence-who"><small>Who</small><CueButton cue={actor} studio={studio} picture /></div><div><small>Where</small><CueButton cue={set} studio={studio} /><span className="cs-inline-join">in the</span><CueButton cue={room} studio={studio} /></div><div><small>With</small><div className={`cs-sentence-props ${studio.layout === 'vertical' ? 'cs-parts-vertical' : ''}`}>{props.map((cue) => <CueButton key={cue.id} cue={cue} studio={studio} />)}</div></div></div>
  </div>
}

export function ShapeSoundVariant(studio: Studio) {
  return <div className="cs-split">
    <CharacterTarget studio={studio} />
    <div className="cs-split-columns"><section className="cs-shape-half"><span className="cs-eyebrow">Shape</span><PropClues studio={studio} /></section><section className="cs-sound-half"><span className="cs-eyebrow">Sound</span>{studio.cues.filter((cue) => cue.kind !== 'prop').map((cue) => <CueButton key={cue.id} cue={cue} studio={studio} />)}</section></div>
  </div>
}
