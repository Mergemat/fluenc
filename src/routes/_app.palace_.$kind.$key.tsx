import { createFileRoute, notFound } from '@tanstack/react-router'

import { PalaceClueView } from '../components/PalaceClueView'
import type { ClueKind } from '../lib/palace-board'

const kinds = new Set<ClueKind>(['cast', 'sets', 'areas', 'props'])

export const Route = createFileRoute('/_app/palace_/$kind/$key')({
  beforeLoad: ({ params }) => { if (!kinds.has(params.kind as ClueKind)) throw notFound() },
  component: Clue,
})

function Clue() {
  const { kind, key } = Route.useParams()
  return <PalaceClueView kind={kind as ClueKind} clueKey={key} />
}
