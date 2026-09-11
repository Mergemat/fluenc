// Round 2: five clue groupings under the selected Notebook character layout.
import { getToneDetail } from '../../lib/tones'
import { MandarinAudioButton } from '../MandarinAudioButton'
import type { CharacterItem, Cue } from './data'

export type Studio = {
  item: CharacterItem
  meaning: string
  cues: Cue[]
  layout?: 'horizontal' | 'vertical'
}

export function CharacterTarget({ studio }: { studio: Studio }) {
  const tone = getToneDetail(studio.item.movie.tone)
  return <div className="cs-character-target">
    <span className="cs-target-hanzi font-hanzi" lang="zh-CN">{studio.item.hanzi}</span>
    <div className="cs-target-pinyin"><strong>{studio.item.pinyin}</strong><MandarinAudioButton text={studio.item.hanzi} pinyin={studio.item.pinyin} /></div>
    <div className="cs-target-details"><h2>{studio.meaning}</h2><span className="cs-tone"><b>{tone.contour}</b>{tone.label} · {studio.item.movie.tone}</span></div>
  </div>
}

function Clue({ cue }: { cue: Cue }) {
  const tone = cue.kind === 'room' ? getToneDetail(Number(cue.code)) : null
  return <div className={`cs-clue cs-clue-${cue.kind}`}>
    <small>{cue.position || cue.role}</small>
    <b className={cue.kind === 'prop' ? 'font-hanzi' : ''} lang={cue.kind === 'prop' ? 'zh-CN' : undefined}>{tone ? tone.contour : cue.code}{cue.count && cue.count > 1 ? <sup className="cs-prop-count">×{cue.count}</sup> : null}</b>
    <strong className={cue.name.trim() ? '' : 'cs-missing'}>{cue.name || (cue.kind === 'prop' ? 'Choose prop' : `Choose your ${cue.kind}`)}</strong>
  </div>
}

function Components({ studio }: { studio: Studio }) {
  return <div className={`cs-components ${studio.layout === 'vertical' ? 'cs-vertical' : ''}`} aria-label="Character components" title={studio.item.movie.componentNote ?? undefined}>{studio.cues.filter(cue => cue.kind === 'prop').map(cue => <Clue key={cue.id} cue={cue} />)}</div>
}

export function DirectCharacter(studio: Studio) {
  return <div className="cs-direct-character">
    <CharacterTarget studio={studio} />
    <div className="cs-direct-prop"><Clue cue={studio.cues[0]} /><p>Learn this simple character directly. Choose an object to represent it when it appears inside other characters.</p></div>
  </div>
}

export function PropShelf(studio: Studio) {
  return <div className="cs-notebook cs-prop-shelf">
    <CharacterTarget studio={studio} />
    <div className="cs-shelf-group">
      <section className="cs-note cs-shelf-parts"><small>Props</small><Components studio={studio} /></section>
      <div className="cs-shelf-sound">{studio.cues.slice(0, 3).map(cue => <section key={cue.id} className={`cs-note cs-note-${cue.kind}`}><Clue cue={cue} /></section>)}</div>
    </div>
  </div>
}

export function Notebook(studio: Studio) {
  return <div className="cs-notebook">
    <CharacterTarget studio={studio} />
    <div className="cs-note-grid"><section className="cs-note cs-note-parts"><small>Made from</small><Components studio={studio} /></section>{studio.cues.slice(0, 3).map(cue => <section key={cue.id} className={`cs-note cs-note-${cue.kind}`}><Clue cue={cue} /></section>)}</div>
  </div>
}

export function SoundAndShape(studio: Studio) {
  return <div className="cs-notebook cs-sound-shape">
    <CharacterTarget studio={studio} />
    <div className="cs-two-groups">
      <section className="cs-note cs-shape-group"><small>Shape · Props</small><Components studio={studio} /></section>
      <section className="cs-note cs-note-set cs-sound-group"><small>Sound</small>{studio.cues.slice(0, 3).map(cue => <Clue key={cue.id} cue={cue} />)}</section>
    </div>
  </div>
}

export function SceneCast(studio: Studio) {
  const [actor, set, room] = studio.cues
  return <div className="cs-notebook cs-scene-cast">
    <CharacterTarget studio={studio} />
    <div className="cs-cast-group">
      <section className="cs-note cs-note-actor"><Clue cue={actor} /></section>
      <section className="cs-note cs-note-set cs-location-note"><Clue cue={set} /><div className="cs-room-within"><Clue cue={room} /></div></section>
      <section className="cs-note cs-cast-parts"><small>With these props</small><Components studio={studio} /></section>
    </div>
  </div>
}

export function ClueStrip(studio: Studio) {
  return <div className="cs-notebook cs-clue-strip">
    <CharacterTarget studio={studio} />
    <div className="cs-strip-group">
      <section className="cs-note cs-strip-parts"><small>Props</small><Components studio={studio} /></section>
      {studio.cues.slice(0, 3).map(cue => <section key={cue.id} className={`cs-note cs-note-${cue.kind}`}><Clue cue={cue} /></section>)}
    </div>
  </div>
}
