// Round 1: five different compositions, all using text and CSS only.
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
    <b className={cue.kind === 'prop' ? 'font-hanzi' : ''} lang={cue.kind === 'prop' ? 'zh-CN' : undefined}>{tone ? tone.contour : cue.code}</b>
    <strong className={cue.name.trim() ? '' : 'cs-missing'}>{cue.name || `Choose your ${cue.kind}`}</strong>
  </div>
}

function Components({ studio }: { studio: Studio }) {
  return <div className={`cs-components ${studio.layout === 'vertical' ? 'cs-vertical' : ''}`} aria-label="Character components">{studio.cues.filter(cue => cue.kind === 'prop').map(cue => <Clue key={cue.id} cue={cue} />)}</div>
}

export function DirectCharacter(studio: Studio) {
  return <div className="cs-direct-character">
    <CharacterTarget studio={studio} />
    <div className="cs-direct-prop"><Clue cue={studio.cues[0]} /><p>Learn this simple character directly. Choose an object to represent it when it appears inside other characters.</p></div>
  </div>
}

export function OpenCanvas(studio: Studio) {
  const [actor, set, room] = studio.cues
  return <div className="cs-open-canvas">
    <div className="cs-open-sound"><Clue cue={actor} /><Clue cue={set} /></div>
    <CharacterTarget studio={studio} />
    <Components studio={studio} />
    <div className="cs-open-room"><Clue cue={room} /></div>
  </div>
}

export function Notebook(studio: Studio) {
  return <div className="cs-notebook">
    <CharacterTarget studio={studio} />
    <div className="cs-note-grid"><section className="cs-note cs-note-parts"><small>Made from</small><Components studio={studio} /></section>{studio.cues.slice(0, 3).map(cue => <section key={cue.id} className={`cs-note cs-note-${cue.kind}`}><Clue cue={cue} /></section>)}</div>
  </div>
}

export function Cinema(studio: Studio) {
  return <div className="cs-cinema">
    <div className="cs-cinema-stage"><Components studio={studio} /><CharacterTarget studio={studio} /></div>
    <div className="cs-cinema-cast">{studio.cues.slice(0, 3).map(cue => <Clue key={cue.id} cue={cue} />)}</div>
  </div>
}

export function SideNotes(studio: Studio) {
  return <div className="cs-side-notes">
    <aside className="cs-shape-notes"><Components studio={studio} /></aside>
    <CharacterTarget studio={studio} />
    <aside className="cs-sound-notes">{studio.cues.slice(0, 3).map(cue => <Clue key={cue.id} cue={cue} />)}</aside>
  </div>
}

function Annotation({ cue }: { cue: Cue }) {
  return <span className={`cs-annotation cs-annotation-${cue.kind}`}><small>{cue.kind === 'room' ? `Tone ${cue.code}` : `${cue.role} · ${cue.code}`}</small><strong className={cue.name ? '' : 'cs-missing'}>{cue.name || `your ${cue.kind}`}</strong></span>
}

export function SceneScript(studio: Studio) {
  const [actor, set, room] = studio.cues
  return <div className="cs-script">
    <Components studio={studio} />
    <CharacterTarget studio={studio} />
    <p className="cs-script-line"><Annotation cue={actor} /> at <Annotation cue={set} />, in <Annotation cue={room} />.</p>
  </div>
}
