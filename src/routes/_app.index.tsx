import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { dashboardQueryOptions } from '../offline/queries'

export const Route = createFileRoute('/_app/')({ component: Home })

function Home() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  return <Navigate to={data.reviewQueue.length ? '/review' : '/lessons'} replace />
}
