import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'

import { getItemMeaning } from '../lib/meaning'
import { getOfflineLibrary } from '../offline/progress'
import type { LibraryData } from '../server/curriculum'
import { getHanziCompositions, type HanziCompositions } from '../server/hanzi'
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
  const libraryQuery = useQuery({ queryKey: ['library'], queryFn: () => getOfflineLibrary() })

  const items = (libraryQuery.data?.[kind] ?? []).filter((item) => {
    if (!deferredSearch) return true
    const meaning = getItemMeaning(item)
    return `${item.hanzi} ${item.pinyin} ${meaning.primary} ${meaning.alternatives.join(' ')}`.toLocaleLowerCase().includes(deferredSearch)
  })
  const visibleItems = items.slice(0, 120)
  const compositionCharacters = kind === 'characters'
    ? visibleItems.map((item) => item.hanzi)
    : []
  const compositionsQuery = useQuery({
    queryKey: ['hanzi-compositions', compositionCharacters.join('')],
    queryFn: () => getHanziCompositions({ data: { characters: compositionCharacters } }),
    enabled: compositionCharacters.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })

  return (
    <Page>
      <PageHeader title="Library" meta="In learning order" />

      <input
        className="mb-6 h-12 w-full rounded-xl border border-line bg-paper px-4 text-[15px] placeholder:text-faint focus:border-ink"
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
          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            <div className="hidden grid-cols-[76px_120px_minmax(0,1fr)_110px_48px] border-b border-line bg-canvas/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-faint md:grid">
              <span>Hanzi</span><span>Pinyin</span><span>Meaning and parts</span><span>Status</span><span />
            </div>
            {visibleItems.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                composition={kind === 'characters' ? compositionsQuery.data?.[item.hanzi] : undefined}
              />
            ))}
          </div>
          {items.length > visibleItems.length ? (
            <p className="mt-4 mb-0 text-center text-xs text-muted">First {visibleItems.length} of {items.length}. Refine your search.</p>
          ) : null}
        </>
      ) : <Status title="Nothing found" />}
      <p className="mt-6 text-center text-xs text-faint">
        Definitions adapted from <a className="underline" href="https://www.mdbg.net/chinese/dictionary?page=cedict">CC-CEDICT</a>
        {" · "}<a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
      </p>
    </Page>
  )
}

function TabButton({ active, count, label, onClick }: { active: boolean; count?: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 border-b-2 px-1 py-2 text-sm font-bold transition ${active ? 'border-glaze text-ink' : 'border-transparent text-faint'}`}
      type="button"
      onClick={onClick}
    >
      {label} <span className="text-xs tabular-nums">{count ?? '…'}</span>
    </button>
  )
}

function LibraryCard({ composition, item }: {
  composition?: HanziCompositions[string] | null
  item: LibraryItem
}) {
  const meaning = getItemMeaning(item)
  return (
    <article className="grid min-h-[70px] grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 md:grid-cols-[76px_120px_minmax(0,1fr)_110px_48px] md:gap-0 md:py-3">
      <span className="font-hanzi text-3xl leading-none font-semibold text-glaze" lang="zh-CN">{item.hanzi}</span>
      <div className="flex min-w-0 flex-col gap-0.5 md:contents">
        <div className="flex items-center gap-1.5">
          <strong className="text-sm font-medium">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted md:pr-4">
          <span className="overflow-hidden text-ellipsis">{meaning.primary}</span>
          {composition?.components.length ? (
            <>
              <span className="text-faint">·</span>
              <span className="font-hanzi text-glaze" lang="zh-CN">
                {composition.components.join(' + ')}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 md:contents">
        <span className={`text-[10px] uppercase tracking-wide ${item.status === 'review' ? 'text-ink' : item.status === 'learning' ? 'text-muted' : 'text-faint'}`}>
          {statusLabels[item.status]}
        </span>
        <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
      </div>
    </article>
  )
}
