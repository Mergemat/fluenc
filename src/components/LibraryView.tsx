import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getLibrary, type LibraryData } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { Button } from './ui/Button'
import { CollectionFrame, CollectionHeader, ViewStatus } from './ui/CollectionFrame'

type LibraryKind = 'characters' | 'words'
type LibraryItem = LibraryData[LibraryKind][number]

const statusLabels = {
  new: 'Не начато',
  learning: 'В работе',
  review: 'Изучено',
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
    <CollectionFrame>
      <CollectionHeader eyebrow="Маршрут 1K" title="Библиотека" description="Иероглифы и частотные слова в порядке изучения." action={(
        <label className="flex w-[min(360px,100%)] items-center gap-[9px] rounded-xl border border-line bg-white px-[13px] text-muted focus-within:border-fluenc-blue focus-within:shadow-[0_0_0_3px_rgba(49,93,130,.1)] max-[720px]:w-full">
          <Search size={17} />
          <input
            className="min-h-11 w-full border-0 bg-transparent text-sm text-ink outline-0"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Искать знак, pinyin или значение"
          />
        </label>
      )} />

      <div className="mb-4 flex gap-5 border-b border-line" aria-label="Раздел библиотеки">
        <button className={`inline-flex items-center gap-2 border-0 border-b-2 bg-transparent px-0 py-2.5 text-xs font-semibold [&_span]:text-[10px] [&_span]:tabular-nums ${kind === 'characters' ? 'border-ink text-ink' : 'border-transparent text-muted'}`} type="button" onClick={() => setKind('characters')}>
          Иероглифы <span>{libraryQuery.data?.characters.length ?? '…'}</span>
        </button>
        <button className={`inline-flex items-center gap-2 border-0 border-b-2 bg-transparent px-0 py-2.5 text-xs font-semibold [&_span]:text-[10px] [&_span]:tabular-nums ${kind === 'words' ? 'border-ink text-ink' : 'border-transparent text-muted'}`} type="button" onClick={() => setKind('words')}>
          Слова <span>{libraryQuery.data?.words.length ?? '…'}</span>
        </button>
      </div>

      {libraryQuery.isPending ? (
        <LibraryStatus title="Загружаю библиотеку…" />
      ) : libraryQuery.isError ? (
        <LibraryStatus title="Не удалось загрузить библиотеку" action={() => libraryQuery.refetch()} />
      ) : visibleItems.length ? (
        <>
          <div className="border-t border-line">
            {visibleItems.map((item) => <LibraryCard key={item.id} item={item} />)}
          </div>
          {items.length > visibleItems.length ? (
            <p className="mt-[18px] mb-0 text-center text-xs text-muted">Показаны первые {visibleItems.length} из {items.length}. Уточните поиск.</p>
          ) : null}
        </>
      ) : <LibraryStatus title="Ничего не найдено" />}
    </CollectionFrame>
  )
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const meaning = splitMeaning(item.meaning)
  return (
    <article className="grid min-h-[76px] grid-cols-[64px_minmax(0,1fr)_100px_42px] items-center gap-3 border-b border-line py-2 max-[620px]:grid-cols-[54px_minmax(0,1fr)_38px]">
      <span className="font-hanzi text-[34px] font-semibold leading-none text-ink" lang="zh-CN">{item.hanzi}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <strong className="text-sm text-jade">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{meaning.primary}</span>
      </div>
      <span className={`text-[9px] font-bold max-[620px]:hidden ${item.status === 'review' ? 'text-jade' : item.status === 'learning' ? 'text-fluenc-blue' : 'text-[#87918d]'}`}>{statusLabels[item.status]}</span>
      <MandarinAudioButton className="self-center" text={item.hanzi} pinyin={item.pinyin} />
    </article>
  )
}

function LibraryStatus({ title, action }: { title: string; action?: () => void }) {
  return (
    <ViewStatus>
      <p>{title}</p>
      {action ? <Button variant="secondary" type="button" onClick={action}>Повторить</Button> : null}
    </ViewStatus>
  )
}
