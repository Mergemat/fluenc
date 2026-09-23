import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { LibraryView } from '../components/LibraryView'

export const Route = createFileRoute('/_app/library')({
  validateSearch: z.object({
    kind: z.enum(['all', 'characters', 'words']).optional().catch(undefined),
    status: z.enum(['all', 'new', 'learning', 'review']).optional().catch(undefined),
    q: z.string().optional().catch(undefined),
    limit: z.number().int().min(60).optional().catch(undefined),
  }),
  component: LibraryView,
})
