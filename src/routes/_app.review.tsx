import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ReviewView } from '../components/ReviewView'
import { dashboardQueryOptions } from '../offline/queries'

export const Route = createFileRoute('/_app/review')({ component: Page })

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  return <ReviewView data={data} />
}
