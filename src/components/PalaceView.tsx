// The memory palace as a lookup: search your cast, sets, tone areas and props by code, name or
// meaning, then open a clue to see every character it appears in. Rows stay compact because
// the props list grows to hundreds over the course. Derived from the cached library and palace.
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronRight, Search, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'

import { actorCategories, buildPalaceBoard, type ClueKind, type PalaceBoard } from '../lib/palace-board'
import { libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import { DitherGradient } from './dither-kit/gradient'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { partColor } from './ui/Dither'
import { ToneContour } from './ui/Hanzi'
import { Page, PageHeader } from './ui/Layout'

const route = getRouteApi('/_app/palace')
const tabs: { id: ClueKind; label: string }[] = [{ id: 'cast', label: 'cast' }, { id: 'sets', label: 'sets' }, { id: 'areas', label: 'tone areas' }, { id: 'props', label: 'props' }]

export type ClueRow = { kind: ClueKind; key: string; code: ReactNode; text: string; name: string; hint: string | null; group?: string; characters: number; started: number; ids: string[]; color?: string }

/** Every clue on the board as a flat row, in the order each tab lists them. */
export function clueRows(board: PalaceBoard): ClueRow[] {
  return [
    ...actorCategories.flatMap(category => board.actors.filter(actor => actor.category === category.id).map(actor => ({
      kind: 'cast' as const, key: actor.key, code: actor.key === 'ø' ? 'ø' : `${actor.key}-`, text: actor.key, name: actor.name, hint: null, group: category.label, characters: actor.characters, started: actor.started, ids: actor.ids,
    }))),
    ...board.sets.map(set => ({ kind: 'sets' as const, key: set.key, code: set.key === 'ø' ? '-ø' : `-${set.key}`, text: set.key, name: set.name, hint: set.key === 'ø' ? 'childhood home' : null, characters: set.characters, started: set.started, ids: set.ids })),
    ...board.rooms.map(room => ({ kind: 'areas' as const, key: String(room.tone), code: <ToneContour tone={room.tone} />, text: '', name: room.name, hint: null, characters: room.characters, started: room.started, ids: room.ids })),
    ...board.props.map((prop, index) => ({ kind: 'props' as const, key: prop.key, code: prop.key, text: prop.key, name: prop.name, hint: prop.meaning, characters: prop.characters, started: prop.started, ids: prop.ids, color: partColor(index) })),
  ]
}

export function PalaceView() {
  const { tab = 'cast', q = '', show = 'all' } = route.useSearch()
  const navigate = route.useNavigate()
  const update = (next: { tab?: ClueKind; q?: string; show?: 'all' | 'named' | 'open' }) => void navigate({ search: previous => ({ ...previous, ...next }), replace: true, resetScroll: false })
  const library = useQuery(libraryQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const input = useRef<HTMLInputElement>(null)
  const query = useDeferredValue(q.trim().toLowerCase())
  const rows = useMemo(() => library.data && palace.data ? clueRows(buildPalaceBoard(library.data, palace.data)) : [], [library.data, palace.data])
  const matching = rows.filter(row => !query || [row.text, row.name, row.hint ?? ''].some(value => value.toLowerCase().includes(query)))
  const inTab = matching.filter(row => row.kind === tab)
  const shown = inTab.filter(row => show === 'all' || (show === 'named' ? row.name : !row.name))
  const named = rows.filter(row => row.name).length

  return <Page>
    <PageHeader title="Palace" meta={rows.length ? `${named}/${rows.length} named` : undefined} />
    <div className="dx-lib-controls">
      <label className="dx-search">
        <Search size={16} aria-hidden="true" />
        <input ref={input} type="search" value={q} onChange={event => update({ q: event.target.value })}
          placeholder="code, your name, or meaning" aria-label="Search your palace" autoComplete="off" spellCheck={false} />
        {q ? <button type="button" aria-label="Clear search" onClick={() => { update({ q: '' }); input.current?.focus() }}><X size={15} /></button> : null}
      </label>
      <div className="dx-lib-filters">
        <div role="tablist" aria-label="Palace sections">{tabs.map(entry => <Chip key={entry.id} role="tab" aria-selected={tab === entry.id} pressed={tab === entry.id} onClick={() => update({ tab: entry.id })}>
          {entry.label}<small>{matching.filter(row => row.kind === entry.id).length}</small>
        </Chip>)}</div>
        <div role="group" aria-label="Named">{(['named', 'open'] as const).map(entry => <Chip key={entry} pressed={show === entry} onClick={() => update({ show: show === entry ? 'all' : entry })}>
          {entry}<small>{inTab.filter(row => entry === 'named' ? row.name : !row.name).length}</small>
        </Chip>)}</div>
      </div>
    </div>

    {library.data && palace.data ? shown.length
      ? <div className="dx-pal-list">{shown.map((row, index) => <div key={`${row.kind}:${row.key}`} className="dx-pal-group">
        {row.group && row.group !== shown[index - 1]?.group ? <h3>{row.group}</h3> : null}
        <ClueLink row={row} />
      </div>)}</div>
      : <div className="dx-lib-empty"><p>nothing matches{q ? ` “${q}”` : ''}</p><Button type="button" variant="secondary" onClick={() => update({ q: '', show: 'all' })}>clear</Button></div>
    : library.isError || palace.isError
      ? <div className="dx-lib-empty"><p>your palace is not available offline yet</p><Button type="button" variant="secondary" onClick={() => { void library.refetch(); void palace.refetch() }}>retry</Button></div>
      : <div className="dx-pal-list" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <span key={index} className="dx-pal-row dx-pal-skeleton"><DitherGradient from="grey" direction="right" cell={2} opacity={.4} /></span>)}</div>}
  </Page>
}

function ClueLink({ row }: { row: ClueRow }) {
  return <Link className="dx-pal-row" data-kind={row.kind} data-open={!row.name} to="/palace/$kind/$key" params={{ kind: row.kind, key: row.key }}
    style={row.color ? { '--part': row.color } as CSSProperties : undefined}>
    <span className={`dx-pal-code ${row.kind === 'props' ? 'font-hanzi-props' : ''}`} lang={row.kind === 'props' ? 'zh-CN' : undefined}>{row.code}</span>
    <span className="dx-pal-text"><span className="dx-pal-name">{row.name || 'open'}</span>{row.hint ? <span className="dx-pal-use">{row.hint}</span> : null}</span>
    <span className="dx-pal-count">{row.characters}<small>{row.started ? ` · ${row.started} started` : ''}</small></span>
    <ChevronRight size={15} aria-hidden="true" />
    {row.started ? <span className="dx-pal-bar" style={{ width: `${row.started / row.characters * 100}%` }}><DitherGradient from="green" direction="left" cell={2} /></span> : null}
  </Link>
}
