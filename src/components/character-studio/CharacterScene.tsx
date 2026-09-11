import { useQuery } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'

import { getToneDetail } from '../../lib/tones'
import { MandarinAudioButton } from '../MandarinAudioButton'
import type { CharacterItem, Cue } from './types'

export type Studio = { item: Pick<CharacterItem, 'hanzi' | 'pinyin' | 'movie'>; meaning: string; cues: Cue[] }

export function CharacterTarget({ studio, children }: { studio: Studio; children?: ReactNode }) {
  const tone = getToneDetail(studio.item.movie.tone)
  return <div className="cs-character-target">
    {children ?? <span className="cs-target-hanzi font-hanzi" lang="zh-CN">{studio.item.hanzi}</span>}
    <div className="cs-target-pinyin"><strong>{studio.item.pinyin}</strong><MandarinAudioButton text={studio.item.hanzi} pinyin={studio.item.pinyin} /></div>
    <div className="cs-target-details"><h2>{studio.meaning}</h2><span className="cs-tone"><b>{tone.contour}</b>{tone.label} · {studio.item.movie.tone}</span></div>
  </div>
}

function SoundClue({ cue }: { cue: Cue }) {
  const tone = cue.kind === 'room' ? getToneDetail(Number(cue.code)) : null
  return <section className={`cs-note cs-note-${cue.kind}`}><div className={`cs-clue cs-clue-${cue.kind}`}>
    <small>{cue.role}</small><b>{tone ? tone.contour : cue.code}</b>
    <strong className={cue.name.trim() ? '' : 'cs-missing'}>{cue.name.trim() || `Choose your ${cue.kind}`}</strong>
  </div></section>
}

export function CharacterScene({ studio, direct, reviewing = false }: { studio: Studio; direct: boolean; reviewing?: boolean }) {
  const { item, cues } = studio
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const highlighted = hovered ?? selected
  const propButtons = useRef<Record<string, HTMLButtonElement | null>>({})
  const props = cues.filter(cue => cue.kind === 'prop')
  const shape = useQuery({
    queryKey: ['character-strokes', item.hanzi],
    queryFn: async () => {
      const { default: HanziWriter } = await import('hanzi-writer')
      const response = await fetch(`/hanzi/${item.hanzi}.json`)
      if (!response.ok) throw new Error('Character strokes unavailable')
      const data = await response.json() as { strokes: string[]; owners: string[] }
      return { ...data, transform: HanziWriter.getScalingTransform(1024, 1024, 55).transform }
    },
    staleTime: Infinity,
  })
  const owners = shape.data?.owners
  const mapped = shape.data && owners?.length === shape.data.strokes.length && owners.every(code => props.some(prop => prop.code === code)) && props.every(prop => owners.includes(prop.code))
  const select = (code: string) => {
    setSelected(previous => previous === code ? null : code)
    propButtons.current[code]?.scrollIntoView({ block: 'nearest' })
  }
  const highlightedName = props.find(prop => prop.code === highlighted)?.name.trim()

  return <div className="cs-prop-scene">
    <div className="cs-character-and-props">
      <CharacterTarget studio={studio}>
        <div className="cs-character-drawing">
          {mapped && shape.data ? <svg className="cs-interactive-hanzi" viewBox="0 0 1024 1024" aria-label={`${item.hanzi} character parts`}>
            <g transform={shape.data.transform}>{props.map(prop => <path
              key={prop.code}
              d={shape.data!.strokes.filter((_, index) => owners![index] === prop.code).join(' ')}
              className={`cs-character-part ${highlighted === prop.code ? 'cs-part-highlighted' : ''}`}
              role="button" tabIndex={0} aria-pressed={selected === prop.code}
              aria-label={`Select ${prop.code} inside ${item.hanzi}${prop.name.trim() ? `: ${prop.name.trim()}` : ''}`}
              onClick={() => select(prop.code)}
              onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(prop.code) }}
              onPointerLeave={() => setHovered(null)}
              onPointerCancel={() => setHovered(null)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(prop.code) }
              }}
            />)}</g>
          </svg> : <span className="cs-target-hanzi font-hanzi" lang="zh-CN">{item.hanzi}</span>}
          <span className="cs-selected-prop-label" aria-live="polite">{highlightedName || ''}</span>
        </div>
      </CharacterTarget>
      <aside className="cs-prop-column" aria-label="Props">
        {props.map(prop => <button key={prop.id} type="button" className="cs-prop-choice" ref={element => { propButtons.current[prop.code] = element }}
          aria-label={`Select ${prop.code} prop${prop.name.trim() ? `: ${prop.name.trim()}` : ''}`}
          aria-pressed={selected === prop.code} data-highlighted={highlighted === prop.code} disabled={!mapped}
          onClick={() => select(prop.code)}
          onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(prop.code) }}
          onPointerLeave={() => setHovered(null)}
          onPointerCancel={() => setHovered(null)}>
          <span className="cs-prop-glyph font-hanzi-modern" lang="zh-CN">{prop.code}{prop.count && prop.count > 1 ? <sup className="cs-prop-count">×{prop.count}</sup> : null}</span>
          <span className={`cs-prop-name ${prop.name.trim() ? '' : 'cs-missing'}`}>{prop.name.trim() || 'Your prop'}</span>
        </button>)}
      </aside>
    </div>
    {shape.isError ? <p className="cs-shape-status" role="status">Could not load strokes. <button type="button" onClick={() => void shape.refetch()}>Retry</button></p> : shape.data && !mapped ? <p className="cs-shape-status" role="status">Character parts could not be loaded.</p> : null}
    {direct && reviewing ? null : direct ? <p className="cs-direct-caption">Learn this simple character directly. Choose an object to represent it inside other characters.</p> : <div className="cs-shelf-sound">{cues.filter(cue => cue.kind !== 'prop').map(cue => <SoundClue key={cue.id} cue={cue} />)}</div>}
  </div>
}
