import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ReadingView } from '../components/ReadingView'
import { dashboardQueryOptions } from '../offline/queries'

export const Route = createFileRoute('/_app/reading')({ component: Page })

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  return <ReadingView data={data} />
}
