import { createFileRoute } from '@tanstack/react-router'

import { LibraryView } from '../components/LibraryView'

export const Route = createFileRoute('/_app/library')({ component: LibraryView })
