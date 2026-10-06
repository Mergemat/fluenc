import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { createLibrarySearch, type LibraryEntry } from '../lib/library-search'
import { getItemMeaning } from '../lib/meaning'
import { libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import { DitherGradient } from './dither-kit/gradient'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { Page, PageHeader } from './ui/Layout'

const route = getRouteApi('/_app/library')
const PAGE = 120
const kinds = [{ id: 'all', label: 'all' }, { id: 'characters', label: 'characters' }, { id: 'words', label: 'words' }] as const
const statuses = [{ id: 'review', label: 'learned' }, { id: 'learning', label: 'learning' }, { id: 'new', label: 'new' }] as const

/** The course as a wall of tiles that light up as you learn them; search covers your own clues. */
export function LibraryView() {
  const { kind = 'all', status = 'all', q = '' } = route.useSearch()
  const navigate = route.useNavigate()
  const update = (next: { kind?: typeof kind; status?: typeof status; q?: string }) =>
    void navigate({ search: previous => ({ ...previous, ...next }), replace: true, resetScroll: false })
  const library = useQuery(libraryQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const query = useDeferredValue(q)
  const search = useMemo(() => library.data ? createLibrarySearch(library.data, palace.data) : null, [library.data, palace.data])
  const matches = useMemo(() => search?.(query) ?? [], [search, query])
  const byKind = matches.filter(item => kind === 'all' || item.kind === kind)
  const items = byKind.filter(item => status === 'all' || item.status === status)
  const [shown, setShown] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setShown(PAGE), [query, kind, status])
  // Results grow as you scroll; there is no "show more" button.
  useEffect(() => {
    const element = sentinel.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setShown(value => value + PAGE) }, { rootMargin: '600px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [items.length > shown])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea')) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const learned = library.data ? library.data.characters.filter(item => item.status === 'review').length + library.data.words.filter(item => item.status === 'review').length : 0
  const total = library.data ? library.data.characters.length + library.data.words.length : 0

  return <Page>
    <PageHeader title="Library" meta={library.data ? `${learned} learned · ${total}` : undefined} />
    <div className="dx-lib-controls">
      <label className="dx-search">
        <Search size={16} aria-hidden="true" />
        <input ref={input} type="search" value={q} onChange={event => update({ q: event.target.value })}
          placeholder="hanzi, pinyin, meaning, or your clues" aria-label="Search the library" autoComplete="off" spellCheck={false} />
        {q ? <button type="button" aria-label="Clear search" onClick={() => { update({ q: '' }); input.current?.focus() }}><X size={15} /></button> : <kbd>/</kbd>}
      </label>
      <div className="dx-lib-filters">
        <div role="group" aria-label="Kind">{kinds.map(entry => <Chip key={entry.id} pressed={kind === entry.id} onClick={() => update({ kind: entry.id })}>
          {entry.label}<small>{entry.id === 'all' ? matches.length : matches.filter(item => item.kind === entry.id).length}</small>
        </Chip>)}</div>
        <div role="group" aria-label="Status">{statuses.map(entry => <Chip key={entry.id} pressed={status === entry.id} data-status={entry.id}
          onClick={() => update({ status: status === entry.id ? 'all' : entry.id })}>
          <i aria-hidden="true" />{entry.label}<small>{byKind.filter(item => item.status === entry.id).length}</small>
        </Chip>)}</div>
      </div>
    </div>

    {library.isPending ? <div className="dx-wall" aria-busy="true">{Array.from({ length: 24 }, (_, index) => <span key={index} className="dx-tile dx-tile-skeleton"><DitherGradient from="grey" direction="up" cell={2} opacity={.5} /></span>)}</div>
      : library.isError ? <div className="dx-lib-empty"><p>the library is not available offline yet</p><Button type="button" variant="secondary" onClick={() => void library.refetch()}>retry</Button></div>
      : items.length ? <>
        <div className="dx-wall" aria-busy={q !== query}>{items.slice(0, shown).map(item => <Tile key={`${item.kind}:${item.id}`} item={item} />)}</div>
        {items.length > shown ? <div ref={sentinel} className="dx-lib-sentinel" /> : null}
      </>
      : <div className="dx-lib-empty"><p>nothing matches{q ? ` “${q}”` : ''}</p>
        <Button type="button" variant="secondary" onClick={() => update({ q: '', kind: 'all', status: 'all' })}>clear search &amp; filters</Button></div>}

    <p className="dx-lib-credit">definitions adapted from <a href="https://www.mdbg.net/chinese/dictionary?page=cedict">CC-CEDICT</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
  </Page>
}

export function Tile({ item }: { item: LibraryEntry }) {
  const meaning = getItemMeaning(item)
  return <Link className="dx-tile" data-kind={item.kind} data-status={item.status} to="/library/$kind/$id" params={{ kind: item.kind, id: item.id }}
    aria-label={`${item.hanzi}, ${item.pinyin}: ${meaning.primary}`}>
    <span className="dx-tile-hanzi font-hanzi" lang="zh-CN">{item.hanzi}</span>
    <span className="dx-tile-py">{item.pinyin}</span>
    <span className="dx-tile-en">{meaning.primary}</span>
    {item.approximate ? <span className="dx-tile-approx" title="Similar match">≈</span> : null}
  </Link>
}
