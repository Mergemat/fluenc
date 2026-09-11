import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { AppHeader, AppTabBar, type AppView } from '../components/AppNav'
import { LessonsView } from '../components/LessonsView'
import { LibraryView } from '../components/LibraryView'
import { PalaceView } from '../components/PalaceView'
import { ReadingView } from '../components/ReadingView'
import { ReviewView } from '../components/ReviewView'
import { SettingsView } from '../components/SettingsView'
import { Status } from '../components/ui/Layout'
import { Button } from '../components/ui/Button'
import { dashboardQueryOptions, loadDashboard } from '../offline/queries'
import { useOfflineSync } from '../offline/useOfflineSync'
import { useOfflineDownload } from '../offline/useOfflineDownload'

export const Route = createFileRoute('/')({
  loader: ({ context }) => loadDashboard(context.queryClient),
  pendingComponent: () => <Status title="Opening Fluenc…" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: Home,
})

function Home() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  useOfflineSync(data)
  const offline = useOfflineDownload()
  const [view, setView] = useState<AppView>(() => data.reviewQueue.length ? 'review' : 'lessons')

  return (
    <div className="app-layout">
      <AppHeader data={data} view={view} onViewChange={setView} />
      <main className="min-w-0">
        {view === 'review' ? <ReviewView data={data} />
          : view === 'lessons' ? <LessonsView data={data} />
            : view === 'reading' ? <ReadingView data={data} />
              : view === 'library' ? <LibraryView />
                : view === 'palace' ? <PalaceView /> : <SettingsView offline={offline} />}
      </main>
      <AppTabBar data={data} view={view} onViewChange={setView} />
    </div>
  )
}

function StartupError() {
  const router = useRouter()
  return <Status
    title="Could not open your lessons. Connect to the internet to prepare Fluenc for offline use."
    action={<Button type="button" onClick={() => void router.invalidate()}>Try again</Button>}
  />
}
