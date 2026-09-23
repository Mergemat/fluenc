import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PalaceView } from '../components/PalaceView'

export const Route = createFileRoute('/_app/palace')({
  validateSearch: z.object({
    kind: z.enum(['characters', 'words']).optional().catch(undefined),
    limit: z.number().int().min(48).optional().catch(undefined),
  }),
  component: PalaceView,
})
