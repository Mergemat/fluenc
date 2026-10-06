// One library entry, built only from the cached library and palace (works offline).
// Characters show their glyph, scene and the words that use them; words show their gloss.
import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState, type CSSProperties } from 'react'

import { defaultToneRooms } from '../lib/pinyin'
import type { LibraryCharacter, LibraryEntry, LibraryWord } from '../lib/library-search'
import { getItemMeaning } from '../lib/meaning'
import { libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import type { LibraryData, PalaceData } from '../lib/learner-views'
import { clueCode, lessonClues, type Clue } from './CharacterLesson'
import type { CharacterItem } from './character-studio/types'
import { DitherButton } from './dither-kit/button'
import { Tile } from './LibraryView'
import { WordGloss } from './ReviewCard'
import { partColor, Rule } from './ui/Dither'
import { AudioButton, HanziGlyph, MoviePinyin } from './ui/Hanzi'
import { Page } from './ui/Layout'

const statusLabel = { review: 'learned', learning: 'learning', new: 'new' } as const

export function LibraryEntryPage({ item, from }: { item: LibraryEntry; from?: 'palace' }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const library = useQuery(libraryQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const back = from === 'palace' ? 'palace' : 'library'

  return <Page>
    <nav className="dx-crumbs" aria-label="Breadcrumb">
      {canGoBack ? <button type="button" onClick={() => router.history.back()}><ArrowLeft size={14} />{back}</button>
        : <Link to={from === 'palace' ? '/palace' : '/library'}><ArrowLeft size={14} />{back}</Link>}
      <span aria-hidden="true">/</span><span className="font-hanzi" lang="zh-CN">{item.hanzi}</span>
      <span className="dx-entry-status" data-status={item.status}><i aria-hidden="true" />{statusLabel[item.status]}</span>
    </nav>
    {item.kind === 'characters'
      ? <CharacterEntry item={item} library={library.data} palace={palace.data} />
      : <WordEntry item={item} library={library.data} />}
  </Page>
}

/** Rebuild the lesson's movie for a library character from the learner's saved palace names. */
function characterMovie(item: LibraryCharacter, library?: LibraryData, palace?: PalaceData): Pick<CharacterItem, 'hanzi' | 'movie'> {
  const characters = new Map(library?.characters.map(entry => [entry.hanzi, entry]))
  return {
    hanzi: item.hanzi,
    movie: {
      ...item.movie,
      actorName: palace?.actors.find(actor => actor.key === item.movie.actorKey)?.name ?? '',
      setName: palace?.sets.find(set => set.key === item.movie.finalKey)?.name ?? '',
      roomName: palace?.rooms.find(room => room.tone === item.movie.tone)?.name ?? defaultToneRooms[item.movie.tone] ?? '',
      isPrimitive: item.structure === 'atomic',
      componentNote: item.componentNote,
      configured: false,
      components: item.components.map(part => {
        const character = characters.get(part.hanzi)
        return { ...part, propName: palace?.props.find(prop => prop.key === part.hanzi)?.name ?? '', character: character ? { pinyin: character.pinyin, keyword: character.keyword } : null }
      }),
    },
  }
}

function CharacterEntry({ item, library, palace }: { item: LibraryCharacter; library?: LibraryData; palace?: PalaceData }) {
  const meaning = getItemMeaning(item)
  const movie = characterMovie(item, library, palace)
  const clues = lessonClues(movie)
  const props = clues.filter(clue => clue.kind === 'prop')
  const [xray, setXray] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const words = (library?.words ?? []).filter(word => word.hanzi !== item.hanzi && word.hanzi.includes(item.hanzi)).sort((a, b) => a.rank - b.rank)

  return <>
    <header className="dx-entry-hero">
      <div className="dx-entry-glyph"><div className="dx-glyph-box">
        <HanziGlyph hanzi={item.hanzi} parts={props.map(prop => prop.code)} highlighted={hover} xray={xray} onHover={setHover} onSelect={code => setHover(previous => previous === code ? null : code)} />
      </div></div>
      <div className="dx-entry-def">
        <h1 className="dx-meaning">{meaning.primary}</h1>
        <div className="dx-sound"><MoviePinyin pinyin={item.pinyin} tone={item.movie.tone} actorKey={item.movie.actorKey} finalKey={item.movie.finalKey} /><AudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
        <Senses meanings={meaning.alternatives} />
        <DitherButton className="dx-tool" color={xray ? 'blue' : 'grey'} variant={xray ? 'gradient' : 'dotted'} aria-pressed={xray} onClick={() => setXray(!xray)}><span>parts</span></DitherButton>
      </div>
    </header>

    <section className="dx-entry-section" aria-label="Scene">
      <div className="dx-label"><span>{props.length === clues.length ? 'prop' : 'scene'}</span><Rule /></div>
      <div className="dx-rows dx-rows-static">{clues.map(clue => <ClueRow key={clue.id} clue={clue} lit={hover === clue.code} onHover={setHover} />)}</div>
      {item.componentNote ? <p className="dx-entry-note">{item.componentNote}</p> : null}
    </section>

    <section className="dx-entry-section" aria-label="Words">
      <div className="dx-label"><span>in words</span><Rule /><span>{words.length}</span></div>
      {words.length ? <div className="dx-wall dx-wall-tight">{words.map(word => <Tile key={word.id} item={{ ...word, kind: 'words' }} />)}</div>
        : <p className="dx-entry-empty">used on its own in this course</p>}
    </section>
  </>
}

function ClueRow({ clue, lit, onHover }: { clue: Clue; lit: boolean; onHover: (code: string | null) => void }) {
  const empty = !clue.name.trim()
  return <div className="dx-row" data-kind={clue.kind} data-lit={lit}
    style={clue.kind === 'prop' ? { '--part': partColor(clue.partIndex) } as CSSProperties : undefined}
    onPointerEnter={clue.kind === 'prop' ? () => onHover(clue.code) : undefined} onPointerLeave={clue.kind === 'prop' ? () => onHover(null) : undefined}>
    <span className={`dx-code ${clue.kind === 'prop' ? 'font-hanzi-props' : ''}`} lang={clue.kind === 'prop' ? 'zh-CN' : undefined}>
      {clueCode(clue)}{clue.count && clue.count > 1 ? <sup>×{clue.count}</sup> : null}
    </span>
    <span className="dx-role">{clue.kind === 'prop' ? (clue.meaning ?? 'prop') : clue.role.toLowerCase()}</span>
    <span className="dx-input dx-static" data-empty={empty}>{empty ? 'not named yet' : clue.name}</span>
  </div>
}

function WordEntry({ item, library }: { item: LibraryWord; library?: LibraryData }) {
  const meaning = getItemMeaning(item)
  const syllables = item.syllables ?? null
  const characters = item.characterParts.map(part => library?.characters.find(entry => entry.id === part.id))

  return <>
    <header className="dx-entry-hero dx-entry-word">
      <WordGloss hanzi={item.hanzi} syllables={syllables} glosses={item.characterParts.map(part => part.meaning)} revealed />
      <div className="dx-entry-def">
        <h1 className="dx-meaning">{meaning.primary}</h1>
        <div className="dx-sound">{syllables ? null : <span className="dx-py dx-py-plain">{item.pinyin}</span>}<AudioButton text={item.hanzi} pinyin={item.pinyin} label="listen" /></div>
        <Senses meanings={meaning.alternatives} />
      </div>
    </header>

    <section className="dx-entry-section" aria-label="Characters">
      <div className="dx-label"><span>characters</span><Rule /></div>
      <div className="dx-wall dx-wall-tight">{characters.map((character, index) => character
        ? <Tile key={character.id} item={{ ...character, kind: 'characters' }} />
        : <span key={index} className="dx-tile" data-status="new"><span className="dx-tile-hanzi font-hanzi">{item.characterParts[index].hanzi}</span></span>)}</div>
    </section>

    <section className="dx-entry-section" aria-label="Memory link">
      <div className="dx-label"><span>memory link</span><Rule /></div>
      {item.livingLink ? <p className="dx-entry-link">{item.livingLink}</p> : <p className="dx-entry-empty">no memory link yet — add one in its build lesson</p>}
    </section>
  </>
}

/** Dictionary senses: the first three, the rest one tap away. */
function Senses({ meanings }: { meanings: string[] }) {
  const [open, setOpen] = useState(false)
  if (!meanings.length) return null
  const hidden = meanings.length - 3
  return <ol className="dx-senses">
    {(open ? meanings : meanings.slice(0, 3)).map(meaning => <li key={meaning}>{meaning}</li>)}
    {hidden > 0 ? <li className="dx-senses-more"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'fewer' : `+${hidden} more`}</button></li> : null}
  </ol>
}
