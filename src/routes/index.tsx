import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { AppHeader, AppTabBar, type AppView } from '../components/AppNav'
import { AppScroll } from '../components/AppScroll'
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
  validateSearch: z.object({
    view: z.enum(['review', 'lessons', 'reading', 'library', 'palace', 'settings']).optional().catch(undefined),
  }),
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
  const [initialView] = useState<AppView>(() => data.reviewQueue.length ? 'review' : 'lessons')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const view = search.view ?? initialView
  const setView = (view: AppView) => { void navigate({ search: { view }, replace: true }) }

  useEffect(() => {
    if (!search.view) void navigate({ search: { view: initialView }, replace: true, resetScroll: false })
  }, [initialView, navigate, search.view])

  return (
    <div className="app-viewport">
      <AppScroll view={view}>
        <div className="app-layout">
          <AppHeader data={data} view={view} onViewChange={setView} />
          <div className="min-w-0">
            {view === 'review' ? <ReviewView data={data} />
              : view === 'lessons' ? <LessonsView data={data} />
                : view === 'reading' ? <ReadingView data={data} />
                  : view === 'library' ? <LibraryView />
                    : view === 'palace' ? <PalaceView /> : <SettingsView offline={offline} />}
          </div>
        </div>
      </AppScroll>
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
