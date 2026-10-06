// A character lesson reads in movie-method order: character → meaning → pinyin → clues
// (saved ones already written in) → imagine the scene → name only what is missing, inline.
// Enter drives the whole lesson; nothing scrolls and nothing shifts while it loads.
import { Info, PenLine, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { directCharacters } from '../lib/character-props'
import { componentMeanings } from '../lib/component-meanings'
import { getItemMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { saveEnrollment, saveMovieOffline } from '../offline/progress'
import { useProgressMutation } from '../offline/useProgressMutation'
import { DitherButton } from './dither-kit/button'
import { DitherGradient } from './dither-kit/gradient'
import { characterCues } from './character-studio/cues'
import type { CharacterItem, Cue } from './character-studio/types'
import { partColor, Rule } from './ui/Dither'
import { AudioButton, HanziGlyph, MoviePinyin, ToneContour, UsageHanzi, useUsage } from './ui/Hanzi'
import { useToast } from './ui/Toast'
import { WriteSheet } from './WriteSheet'

export type Clue = Cue & { status: 'new' | 'known'; meaning: string | null; partIndex: number }

/** What an empty slot asks for, in movie-method terms. */
const prompt = (clue: Clue) => clue.kind === 'actor' ? `pick a ${clue.role.toLowerCase()}`
  : clue.kind === 'set' ? clue.code === 'ø' ? 'your childhood home' : 'a place you know well'
  : clue.kind === 'room' ? 'an area in that place' : 'an object'
const cueKey = (cue: Pick<Cue, 'kind' | 'code'>) => `${cue.kind}:${cue.code}`

/** A clue's code as shown: actor and set codes as text, the tone room as its pitch contour. */
export function clueCode(clue: Pick<Cue, 'kind' | 'code'>) {
  if (clue.kind === 'actor') return clue.code === 'ø' ? 'ø' : `${clue.code}-`
  if (clue.kind === 'set') return clue.code === 'ø' ? '-ø' : `-${clue.code}`
  if (clue.kind === 'room') return <ToneContour tone={Number(clue.code)} />
  return clue.code
}

/** Cues with the learner's draft names, whether each is new to them, and what each prop means. */
export function lessonClues(item: Pick<CharacterItem, 'hanzi' | 'movie'>, drafts: Record<string, string> = {}): Clue[] {
  const direct = directCharacters.has(item.hanzi)
  return characterCues(item).map((cue, index) => {
    const partIndex = cue.kind === 'prop' ? (direct ? 0 : index - 3) : -1
    const component = cue.kind === 'prop' ? item.movie.components[partIndex] : null
    const meaning = cue.kind === 'prop' ? component?.character?.keyword ?? componentMeanings[cue.code] ?? null : null
    return { ...cue, name: drafts[cueKey(cue)] ?? cue.name, status: cue.name.trim() ? 'known' : 'new', meaning, partIndex }
  })
}

export function CharacterLesson({ item }: { item: CharacterItem }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const clues = lessonClues(item, drafts)
  const props = clues.filter(clue => clue.kind === 'prop')
  const missing = clues.filter(clue => !clue.name.trim())
  const direct = directCharacters.has(item.hanzi)
  const meaning = getItemMeaning(item)
  const usage = useUsage(item.hanzi)
  const toast = useToast()
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const [active, setActive] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [xray, setXray] = useState(false)
  const [writing, setWriting] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const activeClue = clues.find(clue => clue.id === active)
  const highlighted = hover ?? (activeClue?.kind === 'prop' ? activeClue.code : null) ?? pinned

  const finish = useProgressMutation(async () => {
    const name = (kind: Cue['kind']) => clues.find(clue => clue.kind === kind)?.name.trim() ?? ''
    await saveMovieOffline({
      characterId: item.id, actorKey: item.movie.actorKey, actorName: name('actor'),
      finalKey: item.movie.finalKey, setName: name('set'), tone: item.movie.tone, roomName: name('room'),
      props: props.map(prop => ({ component: prop.code, propName: prop.name.trim() })),
    })
    return saveEnrollment({ itemType: 'character', itemId: item.id })
  })

  const focusClue = (clue?: Clue) => { if (clue) inputs.current.get(clue.id)?.focus() }
  const primary = () => {
    if (missing.length) { focusClue(missing[0]); return }
    if (finish.isPending) return
    finish.mutate(undefined, {
      onSuccess: () => toast(<><b className="font-hanzi">{item.hanzi}</b><span>added to reviews</span></>),
    })
  }
  const primaryRef = useRef(primary)
  primaryRef.current = primary

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a, [role=dialog]')) return
      if (event.key === 'Enter') { event.preventDefault(); primaryRef.current() }
      else if (event.key === 'x') setXray(value => !value)
      else if (event.key === 'w') setWriting(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const row = (clue: Clue) => {
    const empty = !clue.name.trim()
    return <label key={clue.id} className="dx-row" data-kind={clue.kind} data-empty={empty} data-new={clue.status === 'new'}
      data-lit={clue.kind === 'prop' && highlighted === clue.code}
      style={clue.kind === 'prop' ? { '--part': partColor(clue.partIndex) } as CSSProperties : undefined}
      onPointerEnter={clue.kind === 'prop' ? event => { if (event.pointerType !== 'touch') setHover(clue.code) } : undefined}
      onPointerLeave={clue.kind === 'prop' ? () => setHover(null) : undefined}>
      <span className={`dx-code ${clue.kind === 'prop' ? 'font-hanzi-props' : ''}`} lang={clue.kind === 'prop' ? 'zh-CN' : undefined}>
        {clueCode(clue)}{clue.count && clue.count > 1 ? <sup>×{clue.count}</sup> : null}
      </span>
      <span className="dx-role">{clue.kind === 'prop' ? (clue.meaning ?? 'prop') : clue.kind === 'room' ? `${getToneDetail(Number(clue.code))?.label.toLowerCase()} tone` : clue.role.toLowerCase()}</span>
      <input ref={element => { if (element) inputs.current.set(clue.id, element); else inputs.current.delete(clue.id) }}
        className="dx-input" value={clue.name} placeholder={empty ? prompt(clue) : undefined}
        aria-label={`${clue.role} ${clue.code}${clue.meaning ? `, ${clue.meaning}` : ''}`} aria-invalid={finish.isError && empty}
        autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={finish.isPending}
        enterKeyHint={missing.some(entry => entry.id !== clue.id) ? 'next' : 'done'}
        onFocus={() => setActive(clue.id)} onBlur={() => setActive(previous => previous === clue.id ? null : previous)}
        onChange={event => { const value = event.target.value; setDrafts(previous => ({ ...previous, [cueKey(clue)]: value })) }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.currentTarget.blur(); return }
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          const next = [...clues.slice(clues.indexOf(clue) + 1), ...clues].find(entry => entry.id !== clue.id && !entry.name.trim())
          if (next) focusClue(next)
          else { event.currentTarget.blur(); primary() }
        }} />
    </label>
  }

  return <article className="dx-studio" data-leaving={finish.isPending} data-dense={props.length > 3}>

    <section className="dx-read dx-read-character" aria-label="Character"><div className="dx-read-layout">
        <div className="dx-glyph-box">
          <HanziGlyph hanzi={item.hanzi} parts={props.map(prop => prop.code)} highlighted={highlighted} xray={xray}
            onHover={setHover} onSelect={code => { setPinned(previous => previous === code ? null : code); focusClue(props.find(prop => prop.code === code && !prop.name.trim())) }} />
        </div>
        <div className="dx-ident">
          <h1 className="dx-meaning">{meaning.primary}</h1>
          <p className="dx-alt">{meaning.also ? `also ${meaning.also}` : ' '}</p>
          <div className="dx-sound"><MoviePinyin pinyin={item.pinyin} tone={item.movie.tone} actorKey={item.movie.actorKey} finalKey={item.movie.finalKey} /><AudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
        </div>
    </div></section>

    {/* Words that use the character, collapsed to one line: read them before the scene. */}
    <section className="dx-usage" aria-label="In words" aria-busy={usage.pending}>
      {usage.pending ? <span className="dx-usage-skeleton"><DitherGradient from="grey" direction="right" cell={2} opacity={.6} /></span>
        : usage.error ? <p className="dx-usage-empty">words unavailable offline · <button type="button" onClick={usage.retry}>retry</button></p>
        : usage.data?.words.length ? <p className="dx-usage-line">{usage.data.words.map(word => <span key={word.id} className="dx-usage-item"
            title={`${word.pinyin}${word.unknown ? ` · ${word.unknown} new character${word.unknown > 1 ? 's' : ''}` : ''}`}>
            <UsageHanzi chars={word.chars} /><span>{word.meaning}</span>
          </span>)}</p>
        : <p className="dx-usage-empty">used on its own — no course words yet</p>}
    </section>

    <section className="dx-clues" aria-label="Clues">
      <div className="dx-label"><span>{direct ? 'prop' : 'clues'}</span><Rule />
        {item.movie.componentNote ? <button type="button" className="dx-note-toggle" aria-expanded={noteOpen} onClick={() => setNoteOpen(!noteOpen)}><Info size={12} /> note</button> : null}
        <span data-tone={missing.length ? 'todo' : 'done'}>{missing.length ? `${missing.length} to name` : 'ready'}</span></div>
      <div className="dx-rows">
        {direct ? null : <div className="dx-rows-sound">{clues.filter(clue => clue.kind !== 'prop').map(row)}</div>}
        <div className="dx-rows-props">{props.map(row)}</div>
      </div>
      {noteOpen && item.movie.componentNote ? <div className="dx-popover" role="note"><p>{item.movie.componentNote}</p><button type="button" aria-label="Close note" onClick={() => setNoteOpen(false)}><X size={14} /></button></div> : null}
    </section>


    <footer className="dx-actions">
      {/* Grey dotted until every clue is named, then the blue gradient with bloom. */}
      <DitherButton className="dx-action" color={missing.length ? 'grey' : 'blue'} variant={missing.length ? 'dotted' : 'gradient'}
        disabled={finish.isPending} onClick={primary}>
        <span role={finish.isError ? 'alert' : undefined}>{finish.isPending ? 'saving' : missing.length ? `name ${missing.length} clue${missing.length > 1 ? 's' : ''}` : finish.isError ? 'could not save — try again' : 'add to reviews'}</span>
        <kbd>↵</kbd>
      </DitherButton>
      <DitherButton className="dx-action-side" color="grey" variant="dotted" aria-label={`Write ${item.hanzi}`} title="write (w)" onClick={() => setWriting(true)}>
        <PenLine size={17} />
      </DitherButton>
    </footer>

    {writing ? <WriteSheet hanzi={item.hanzi} onClose={() => setWriting(false)} /> : null}
  </article>
}
