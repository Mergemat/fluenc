import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppHeader, AppTabBar, type AppView } from '../components/AppNav'
import { LessonsView } from '../components/LessonsView'
import { LibraryView } from '../components/LibraryView'
import { PalaceView } from '../components/PalaceView'
import { ReadingView } from '../components/ReadingView'
import { ReviewView } from '../components/ReviewView'
import { dashboardQueryOptions } from '../offline/queries'
import { useOfflineSync } from '../offline/useOfflineSync'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQueryOptions)
  },
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
