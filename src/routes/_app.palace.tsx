import { createFileRoute } from '@tanstack/react-router'

import { PalaceView } from '../components/PalaceView'

export const Route = createFileRoute('/_app/palace')({ component: PalaceView })
