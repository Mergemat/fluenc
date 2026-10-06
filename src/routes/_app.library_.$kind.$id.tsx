import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'

import { LibraryEntryPage } from '../components/LibraryEntryPage'
import { Button } from '../components/ui/Button'
import { Page, Status } from '../components/ui/Layout'
import type { LibraryEntry } from '../lib/library-search'
import { oneOf } from '../lib/search-params'
import { learnerQueryOptions, selectLibrary } from '../offline/queries'

export const Route = createFileRoute('/_app/library_/$kind/$id')({
  validateSearch: (search: Record<string, unknown>): { from?: 'palace' } => ({ from: oneOf(search.from, ['palace']) }),
  loader: async ({ context, params }) => {
    if (params.kind !== 'characters' && params.kind !== 'words') throw notFound()
    const library = selectLibrary(await context.queryClient.ensureQueryData(learnerQueryOptions))
    const entry: LibraryEntry | undefined = params.kind === 'characters'
      ? (({ found }) => found && { ...found, kind: 'characters' as const })({ found: library.characters.find(item => item.id === params.id) })
      : (({ found }) => found && { ...found, kind: 'words' as const })({ found: library.words.find(item => item.id === params.id) })
    if (!entry) throw notFound()
    return entry
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.hanzi} · ${loaderData.pinyin} | Fluenc` : 'Fluenc' }] }),
  pendingComponent: () => <Page><Status title="Loading details…" /></Page>,
  errorComponent: DetailError,
  notFoundComponent: () => <Page><Status title="This entry is not in the library" action={<Link className="dx-chip" to="/library">back to library</Link>} /></Page>,
  component: Detail,
})

function Detail() {
  const item = Route.useLoaderData()
  const { from } = Route.useSearch()
  return <LibraryEntryPage item={item} from={from} />
}

function DetailError() {
  const router = useRouter()
  return <Page><Status title="Could not load these details" action={<Button type="button" onClick={() => void router.invalidate()}>Retry</Button>} /></Page>
}
