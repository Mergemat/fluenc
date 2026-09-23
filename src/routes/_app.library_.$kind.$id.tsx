import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { LibraryDetailPage } from '../components/LibraryDetailPage'
import { Button } from '../components/ui/Button'
import { Page, Status } from '../components/ui/Layout'
import type { LibraryEntry } from '../lib/library-search'
import { libraryQueryOptions } from '../offline/queries'

export const Route = createFileRoute('/_app/library_/$kind/$id')({
  validateSearch: z.object({ from: z.enum(['palace']).optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    if (params.kind !== 'characters' && params.kind !== 'words') throw notFound()
    const library = await context.queryClient.ensureQueryData(libraryQueryOptions)
    const item = library[params.kind].find(item => item.id === params.id)
    if (!item) throw notFound()
    return { ...item, kind: params.kind } satisfies LibraryEntry
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.hanzi} · ${loaderData.pinyin} | Fluenc` : 'Fluenc' }] }),
  pendingComponent: () => <Page><Status title="Loading details…" /></Page>,
  errorComponent: DetailError,
  notFoundComponent: () => <Page><Status title="This entry is not in the library" action={<Link className="ui-button ui-secondary" to="/library">Back to library</Link>} /></Page>,
  component: Detail,
})

function Detail() {
  const item = Route.useLoaderData()
  const { from } = Route.useSearch()
  return <LibraryDetailPage item={item} from={from} />
}

function DetailError() {
  const router = useRouter()
  return <Page><Status title="Could not load these details" action={<Button type="button" onClick={() => void router.invalidate()}>Retry</Button>} /></Page>
}
