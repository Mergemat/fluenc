import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { createLibrarySearch, type LibraryEntry } from '../lib/library-search'
import { dashboardQueryOptions, libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

const statusLabels = { new: 'New', learning: 'Learning', review: 'Learned' }
const emptyLibrary = { characters: [], words: [] }
const libraryRoute = getRouteApi('/_app/library')

export function LibraryView() {
  const filters = libraryRoute.useSearch()
  const { kind = 'all', status = 'all', q: search = '', limit = 60 } = filters
  const navigate = libraryRoute.useNavigate()
  const updateFilters = (next: Partial<typeof filters>) => void navigate({ search: previous => ({ ...previous, ...next }), replace: true, resetScroll: false })
  const deferredSearch = useDeferredValue(search)
  const libraryQuery = useQuery(libraryQueryOptions)
  const dashboard = useQuery(dashboardQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const library = libraryQuery.data ?? emptyLibrary
  const searchLibrary = useMemo(() => createLibrarySearch(library, dashboard.data, palace.data), [library, dashboard.data, palace.data])
  const results = useMemo(() => searchLibrary(deferredSearch).filter(item => status === 'all' || item.status === status), [searchLibrary, deferredSearch, status])
  const items = results.filter(item => kind === 'all' || item.kind === kind)
  const visibleItems = items.slice(0, limit)

  return (
    <Page>
      <PageHeader title="Library" meta="Your characters & words" />
      <input className="library-search" aria-label="Search library" type="search" value={search}
        onChange={event => updateFilters({ q: event.target.value, limit: 60 })}
        placeholder="Hanzi, pinyin, meaning, or your notes" />
      {(dashboard.isError || palace.isError) && search ? <p className="text-xs text-muted">Your notes could not be loaded. Dictionary search is still available. <button type="button" className="underline" onClick={() => { void dashboard.refetch(); void palace.refetch() }}>Retry notes</button></p> : null}
      <div className="library-filters">
        <div className="library-tabs" aria-label="Library section">
          {(['all', 'characters', 'words'] as const).map(section => <button key={section} className="library-tab" aria-pressed={kind === section} type="button" onClick={() => updateFilters({ kind: section, limit: 60 })}>
            {section === 'all' ? 'All' : section === 'characters' ? 'Characters' : 'Words'} <span>{section === 'all' ? results.length : results.filter(item => item.kind === section).length}</span>
          </button>)}
        </div>
        <select aria-label="Learning status" value={status} onChange={event => updateFilters({ status: event.target.value as typeof status, limit: 60 })}>
          <option value="all">Any status</option><option value="review">Learned</option><option value="learning">Learning</option><option value="new">New</option>
        </select>
      </div>
      {libraryQuery.isPending ? <Status title="Loading…" />
        : libraryQuery.isError ? <Status title="Could not load the library" action={<Button variant="secondary" type="button" onClick={() => libraryQuery.refetch()}>Retry</Button>} />
        : visibleItems.length ? <>
          <div className="library-list" aria-busy={search !== deferredSearch}>
            {visibleItems.map(item => <LibraryCard key={`${item.kind}:${item.id}`} item={item} />)}
          </div>
          <p className="mt-4 text-center text-xs text-muted" role="status">{visibleItems.length} of {items.length} results</p>
          {items.length > limit ? <Button type="button" variant="secondary" onClick={() => updateFilters({ limit: limit + 60 })}>Show more</Button> : null}
        </> : <Status title="No matches with these filters" action={<Button type="button" variant="secondary" onClick={() => updateFilters({ kind: 'all', status: 'all', q: '', limit: 60 })}>Clear search & filters</Button>} />}
      <p className="mt-6 text-center text-xs text-faint">Definitions adapted from <a className="underline" href="https://www.mdbg.net/chinese/dictionary?page=cedict">CC-CEDICT</a>{' · '}<a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
    </Page>
  )
}

function LibraryCard({ item }: { item: LibraryEntry }) {
  const meaning = getItemMeaning(item)
  return <article className={`library-entry library-${item.kind}`}>
    <div className="library-row">
      <Link className="library-open" to="/library/$kind/$id" params={{ kind: item.kind, id: item.id }} aria-label={`View ${item.hanzi}: ${meaning.primary}`}>
        <span className="library-glyph font-hanzi" lang="zh-CN">{item.hanzi}</span>
        <span className="library-definition"><strong className="text-sm font-medium">{item.pinyin}</strong><span className="library-meaning">{meaning.primary}</span><span className="text-xs text-faint">{item.kind === 'characters' ? 'Character' : 'Word'}{item.approximate ? ' · Similar match' : ''}</span></span>
        <ChevronRight size={16} />
      </Link>
      <div className="library-status"><span className={`status-tag status-${item.status}`}>{statusLabels[item.status]}</span><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
    </div>
  </article>
}
