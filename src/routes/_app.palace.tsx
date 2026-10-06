import { createFileRoute } from '@tanstack/react-router'

import { PalaceView } from '../components/PalaceView'
import { oneOf, optionalString } from '../lib/search-params'

type PalaceSearch = {
  tab?: 'cast' | 'sets' | 'areas' | 'props'
  q?: string
  show?: 'all' | 'named' | 'open'
}

export const Route = createFileRoute('/_app/palace')({
  validateSearch: (search: Record<string, unknown>): PalaceSearch => ({
    tab: oneOf(search.tab, ['cast', 'sets', 'areas', 'props']),
    q: optionalString(search.q),
    show: oneOf(search.show, ['all', 'named', 'open']),
  }),
  component: PalaceView,
})
