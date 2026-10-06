import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router'

import { AppShell } from '../components/AppShell'
import { Status } from '../components/ui/Layout'
import { Button } from '../components/ui/Button'
import { OfflineDownloadProvider } from '../offline/OfflineDownloadProvider'
import { dashboardQueryOptions, loadLearner } from '../offline/queries'
import { useOfflineSync } from '../offline/useOfflineSync'
import { AppUpdateProvider } from '../updates/AppUpdateProvider'

export const Route = createFileRoute('/_app')({
  loader: async ({ context }) => { await loadLearner(context.queryClient) },
  pendingComponent: () => <Status title="Opening Fluenc…" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: AppLayout,
})

function AppLayout() {
  const { data } = useSuspenseQuery(dashboardQueryOptions)
  const pathname = useLocation({ select: location => location.pathname })
  useOfflineSync(data)

  return <AppUpdateProvider><OfflineDownloadProvider>
    <AppShell data={data} pathname={pathname}><Outlet /></AppShell>
  </OfflineDownloadProvider></AppUpdateProvider>
}

function StartupError() {
  const router = useRouter()
  return <Status
    title="Could not open your lessons. Connect to the internet to prepare Fluenc for offline use."
    action={<Button type="button" onClick={() => void router.invalidate()}>Try again</Button>}
  />
}
