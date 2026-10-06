import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PalaceView } from '../components/PalaceView'

export const Route = createFileRoute('/_app/palace')({
  validateSearch: z.object({
    tab: z.enum(['cast', 'sets', 'areas', 'props']).optional().catch(undefined),
    q: z.string().optional().catch(undefined),
    show: z.enum(['all', 'named', 'open']).optional().catch(undefined),
  }),
  component: PalaceView,
})
