import { useQuery } from '@tanstack/react-query'
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
    <Page>
      <PageHeader title="Library" meta="In learning order" />

      <input
        className="mb-6 h-12 w-full rounded-full bg-white/70 px-4 text-[15px] shadow-[0_2px_8px_rgb(43_58_66/0.06)] outline-none placeholder:text-faint focus:shadow-[0_0_0_2px_rgb(47_109_158/0.3)]"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
      />

      <div className="mb-4 flex gap-5" aria-label="Library section">
        <TabButton active={kind === 'characters'} count={libraryQuery.data?.characters.length} label="Characters" onClick={() => setKind('characters')} />
        <TabButton active={kind === 'words'} count={libraryQuery.data?.words.length} label="Words" onClick={() => setKind('words')} />
      </div>

      {libraryQuery.isPending ? (
        <Status title="Loading…" />
      ) : libraryQuery.isError ? (
        <Status title="Could not load the library" action={<Button variant="secondary" type="button" onClick={() => libraryQuery.refetch()}>Retry</Button>} />
      ) : visibleItems.length ? (
        <>
          <div className="grid gap-2">
            {visibleItems.map((item) => <LibraryCard key={item.id} item={item} />)}
          </div>
          {items.length > visibleItems.length ? (
            <p className="mt-4 mb-0 text-center text-xs text-muted">First {visibleItems.length} of {items.length}. Refine your search.</p>
          ) : null}
        </>
      ) : <Status title="Nothing found" />}
    </Page>
  )
}

function TabButton({ active, count, label, onClick }: { active: boolean; count?: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-full border-0 px-3.5 py-2 text-sm font-medium transition ${active ? 'bg-paper text-ink shadow-[0_2px_8px_rgb(43_58_66/0.08)]' : 'bg-transparent text-faint'}`}
      type="button"
      onClick={onClick}
    >
      {label} <span className="text-xs tabular-nums">{count ?? '…'}</span>
    </button>
  )
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const meaning = splitMeaning(item.meaning)
  return (
    <article className="grid min-h-[64px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/60 px-3.5 py-2 shadow-[0_1px_4px_rgb(43_58_66/0.05)]">
      <span className="font-hanzi text-3xl leading-none font-semibold text-glaze" lang="zh-CN">{item.hanzi}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <strong className="text-sm font-medium">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{meaning.primary}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] uppercase tracking-wide ${item.status === 'review' ? 'text-ink' : item.status === 'learning' ? 'text-muted' : 'text-faint'}`}>
          {statusLabels[item.status]}
        </span>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
      </div>
    </article>
  )
}
