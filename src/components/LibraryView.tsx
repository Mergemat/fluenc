import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { createLibrarySearch, type LibraryEntry, type LibraryKind } from '../lib/library-search'
import { dashboardQueryOptions, libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import { LibraryDetails } from './LibraryDetails'
import { MandarinAudioButton } from './MandarinAudioButton'
import { DictionaryMeanings } from './DictionaryMeanings'
import { NeutralToneBadge } from './NeutralToneHint'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

const statusLabels = { new: 'New', learning: 'Learning', review: 'Learned' }
const emptyLibrary = { characters: [], words: [] }

export function LibraryView() {
  const [kind, setKind] = useState<LibraryKind | 'all'>('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(60)
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
        onChange={event => { setSearch(event.target.value); setLimit(60) }}
        placeholder="Hanzi, pinyin, meaning, or your notes" />
      {(dashboard.isError || palace.isError) && search ? <p className="text-xs text-muted">Your notes could not be loaded. Dictionary search is still available. <button type="button" className="underline" onClick={() => { void dashboard.refetch(); void palace.refetch() }}>Retry notes</button></p> : null}
      <div className="library-filters">
        <div className="library-tabs" aria-label="Library section">
          {(['all', 'characters', 'words'] as const).map(section => <button key={section} className="library-tab" aria-pressed={kind === section} type="button" onClick={() => { setKind(section); setLimit(60) }}>
            {section === 'all' ? 'All' : section === 'characters' ? 'Characters' : 'Words'} <span>{section === 'all' ? results.length : results.filter(item => item.kind === section).length}</span>
          </button>)}
        </div>
        <select aria-label="Learning status" value={status} onChange={event => { setStatus(event.target.value); setLimit(60) }}>
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
          {items.length > limit ? <Button type="button" variant="secondary" onClick={() => setLimit(value => value + 60)}>Show more</Button> : null}
        </> : <Status title="No matches with these filters" action={<Button type="button" variant="secondary" onClick={() => { setKind('all'); setStatus('all'); setSearch(''); setLimit(60) }}>Clear search & filters</Button>} />}
      <p className="mt-6 text-center text-xs text-faint">Definitions adapted from <a className="underline" href="https://www.mdbg.net/chinese/dictionary?page=cedict">CC-CEDICT</a>{' · '}<a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>
    </Page>
  )
}

function LibraryCard({ item }: { item: LibraryEntry }) {
  const [open, setOpen] = useState(false)
  const meaning = getItemMeaning(item)
  const detailsId = `library-${item.kind}-${item.id}`
  return <article className={`library-entry library-${item.kind}`}>
    <div className="library-row">
      <button className="library-open" type="button" aria-expanded={open} aria-controls={detailsId} aria-label={`View ${item.hanzi}: ${meaning.primary}`} onClick={() => setOpen(value => !value)}>
        <span className="library-glyph font-hanzi" lang="zh-CN">{item.hanzi}</span>
        <span className="library-definition"><strong className="text-sm font-medium">{item.pinyin}</strong><span className="library-meaning">{meaning.primary}</span><span className="text-xs text-faint">{item.kind === 'characters' ? 'Character' : 'Word'}{item.approximate ? ' · Similar match' : ''}</span></span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <div className="library-status"><span className={`status-tag status-${item.status}`}>{statusLabels[item.status]}</span><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
    </div>
    {open ? <div id={detailsId}><NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} /><DictionaryMeanings meanings={meaning.alternatives} /><LibraryDetails id={item.id} hanzi={item.hanzi} kind={item.kind} /></div> : null}
  </article>
}
