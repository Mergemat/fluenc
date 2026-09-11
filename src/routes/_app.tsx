import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router'

import { AppHeader, AppTabBar } from '../components/AppNav'
import { AppScroll } from '../components/AppScroll'
import { Status } from '../components/ui/Layout'
import { Button } from '../components/ui/Button'
import { OfflineDownloadProvider } from '../offline/OfflineDownloadProvider'
import { dashboardQueryOptions, loadDashboard } from '../offline/queries'
import { useOfflineSync } from '../offline/useOfflineSync'

export const Route = createFileRoute('/_app')({
  loader: ({ context }) => loadDashboard(context.queryClient),
  pendingComponent: () => <Status title="Opening Fluenc…" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: AppLayout,
})

function AppLayout() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  const pathname = useLocation({ select: location => location.pathname })
  useOfflineSync(data)

  return <OfflineDownloadProvider>
    <div className="app-viewport">
      <AppScroll pathname={pathname}>
        <div className="app-layout">
          <AppHeader data={data} />
          <div className="min-w-0"><Outlet /></div>
        </div>
      </AppScroll>
      <AppTabBar data={data} />
    </div>
  </OfflineDownloadProvider>
}

function StartupError() {
  const router = useRouter()
  return <Status
    title="Could not open your lessons. Connect to the internet to prepare Fluenc for offline use."
    action={<Button type="button" onClick={() => void router.invalidate()}>Try again</Button>}
  />
}
