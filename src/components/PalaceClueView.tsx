// One palace clue and every character it appears in, as library tiles in course order.
import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'

import { buildPalaceBoard, type ClueKind } from '../lib/palace-board'
import { getToneDetail } from '../lib/tones'
import { libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import { Tile } from './LibraryView'
import { clueRows } from './PalaceView'
import { Rule } from './ui/Dither'
import { Page, Status } from './ui/Layout'

const kindLabel: Record<ClueKind, string> = { cast: 'actor', sets: 'set', areas: 'tone area', props: 'prop' }

export function PalaceClueView({ kind, clueKey }: { kind: ClueKind; clueKey: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const library = useQuery(libraryQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const row = useMemo(() => library.data && palace.data
    ? clueRows(buildPalaceBoard(library.data, palace.data)).find(entry => entry.kind === kind && entry.key === clueKey)
    : undefined, [library.data, palace.data, kind, clueKey])
  const characters = useMemo(() => {
    const byId = new Map(library.data?.characters.map(character => [character.id, character]))
    return (row?.ids ?? []).flatMap(id => byId.get(id) ?? [])
  }, [library.data, row])

  if (!library.data || !palace.data) return <Page><Status title={library.isError || palace.isError ? 'Your palace is not available offline yet' : 'Loading…'} /></Page>
  if (!row) return <Page><Status title="This clue is not in your palace" action={<Link className="dx-chip" to="/palace">back to palace</Link>} /></Page>

  const kindText = row.group ? row.group.replace(/s$/, '').replace('gods & world leader', 'god or world leader')
    : kind === 'areas' ? `tone area · ${getToneDetail(Number(row.key))?.label.toLowerCase()} tone`
    : kind === 'props' && row.hint ? `prop · ${row.hint}` : row.hint ? `${kindLabel[kind]} · ${row.hint}` : kindLabel[kind]

  return <Page>
    <nav className="dx-crumbs" aria-label="Breadcrumb">
      {canGoBack ? <button type="button" onClick={() => router.history.back()}><ArrowLeft size={14} />palace</button>
        : <Link to="/palace" search={{ tab: kind }}><ArrowLeft size={14} />palace</Link>}
    </nav>
    <header className="dx-clue-hero" data-kind={kind} style={row.color ? { '--part': row.color } as CSSProperties : undefined}>
      <span className={`dx-clue-code ${kind === 'props' ? 'font-hanzi-props' : ''}`} lang={kind === 'props' ? 'zh-CN' : undefined}>{row.code}</span>
      <div>
        <p className="dx-clue-kind">{kindText}</p>
        <h1 data-open={!row.name}>{row.name || 'not named yet'}</h1>
        <p className="dx-clue-stats">{row.characters} characters · {row.started} started</p>
      </div>
    </header>
    {row.name ? null : <p className="dx-entry-empty">it gets its name in the lesson of its first character</p>}
    <section className="dx-entry-section" aria-label="Characters">
      <div className="dx-label"><span>in characters</span><Rule /><span>{characters.length}</span></div>
      <div className="dx-wall">{characters.map(character => <Tile key={character.id} item={{ ...character, kind: 'characters' }} />)}</div>
    </section>
  </Page>
}
