import { createFileRoute } from '@tanstack/react-router'

import { LibraryView } from '../components/LibraryView'
import { oneOf, optionalString } from '../lib/search-params'

type LibrarySearch = {
  kind?: 'all' | 'characters' | 'words'
  status?: 'all' | 'new' | 'learning' | 'review'
  q?: string
}

export const Route = createFileRoute('/_app/library')({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    kind: oneOf(search.kind, ['all', 'characters', 'words']),
    status: oneOf(search.status, ['all', 'new', 'learning', 'review']),
    q: optionalString(search.q),
  }),
  component: LibraryView,
})
