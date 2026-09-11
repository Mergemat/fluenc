import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppHeader, AppTabBar, type AppView } from '../components/AppNav'
import { LessonsView } from '../components/LessonsView'
import { LibraryView } from '../components/LibraryView'
import { PalaceView } from '../components/PalaceView'
import { ReadingView } from '../components/ReadingView'
import { ReviewView } from '../components/ReviewView'
import { getOfflineDashboard } from '../offline/progress'
import { useOfflineSync } from '../offline/useOfflineSync'

const dashboardQueryOptions = queryOptions({
  queryKey: ['dashboard'],
  queryFn: () => getOfflineDashboard(),
  refetchInterval: (query) => {
    const nextReviewAt = query.state.data?.nextReviewAt
    if (!nextReviewAt) return false
    return Math.max(1_000, Math.min(Date.parse(nextReviewAt) - Date.now(), 2_147_000_000))
  },
})

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  component: Home,
})

function Home() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  useOfflineSync(data)
  const [view, setView] = useState<AppView>(() => data.reviewQueue.length ? 'review' : 'lessons')

  return (
    <div className="app-layout">
      <AppHeader data={data} view={view} onViewChange={setView} />
      <main className="min-w-0">
        {view === 'review' ? <ReviewView data={data} />
          : view === 'lessons' ? <LessonsView data={data} />
            : view === 'reading' ? <ReadingView data={data} />
              : view === 'library' ? <LibraryView />
                : <PalaceView />}
      </main>
      <AppTabBar data={data} view={view} onViewChange={setView} />
    </div>
  )
}
