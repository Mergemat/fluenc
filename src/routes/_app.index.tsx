import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { isLearning } from '../lib/review-schedule'
import { dashboardQueryOptions } from '../offline/queries'

export const Route = createFileRoute('/_app/')({ component: Home })

function Home() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  const unfinished = data.reviewQueue.length > 0 || data.scheduledQueue.some(item => isLearning(item.card.state))
  return <Navigate to={unfinished ? '/review' : '/lessons'} replace />
}
