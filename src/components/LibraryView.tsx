import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getLibrary, type LibraryData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

type LibraryKind = 'characters' | 'words'
type LibraryItem = LibraryData[LibraryKind][number]

const statusLabels = {
  new: 'New',
  learning: 'Learning',
  review: 'Learned',
}

export function LibraryView() {
  const [kind, setKind] = useState<LibraryKind>('characters')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase())
  const libraryQuery = useQuery({ queryKey: ['library'], queryFn: () => getLibrary() })

  const items = (libraryQuery.data?.[kind] ?? []).filter((item) =>
    !deferredSearch || `${item.hanzi} ${item.pinyin} ${item.meaning}`.toLocaleLowerCase().includes(deferredSearch),
  )
  const visibleItems = items.slice(0, 120)

  return (
    <Page width="wide">
      <PageHeader title="Library" meta="Characters and words in learning order" />

      <label className="mb-4 flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3.5 text-muted focus-within:border-ink">
        <Search size={16} />
        <input
          className="h-11 w-full border-0 bg-transparent text-sm text-ink"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a character, pinyin, or meaning"
        />
      </label>

      <div className="mb-4 flex gap-5 border-b border-line" aria-label="Library section">
        <TabButton active={kind === 'characters'} count={libraryQuery.data?.characters.length} label="Characters" onClick={() => setKind('characters')} />
        <TabButton active={kind === 'words'} count={libraryQuery.data?.words.length} label="Words" onClick={() => setKind('words')} />
      </div>

      {libraryQuery.isPending ? (
        <Status title="Loading the library…" />
      ) : libraryQuery.isError ? (
        <Status title="Could not load the library" action={<Button variant="secondary" type="button" onClick={() => libraryQuery.refetch()}>Retry</Button>} />
      ) : visibleItems.length ? (
        <>
          <div className="border-t border-line">
            {visibleItems.map((item) => <LibraryCard key={item.id} item={item} />)}
          </div>
          {items.length > visibleItems.length ? (
            <p className="mt-4 mb-0 text-center text-xs text-muted">Showing the first {visibleItems.length} of {items.length}. Refine your search.</p>
          ) : null}
        </>
      ) : <Status title="Nothing found" />}
    </Page>
  )
}

function TabButton({ active, count, label, onClick }: { active: boolean; count?: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex items-center gap-2 border-0 border-b-2 bg-transparent px-0 py-2.5 text-xs font-semibold ${active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
      type="button"
      onClick={onClick}
    >
      {label} <span className="text-[10px] tabular-nums">{count ?? '…'}</span>
    </button>
  )
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const meaning = splitMeaning(item.meaning)
  return (
    <article className="grid min-h-[68px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2">
      <span className="font-hanzi text-3xl leading-none font-semibold" lang="zh-CN">{item.hanzi}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <strong className="text-sm text-accent">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{meaning.primary}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`hidden text-[10px] font-bold sm:block ${item.status === 'review' ? 'text-accent' : item.status === 'learning' ? 'text-ink' : 'text-faint'}`}>
          {statusLabels[item.status]}
        </span>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
      </div>
    </article>
  )
}
