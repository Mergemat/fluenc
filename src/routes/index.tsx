import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppSidebar, type AppView } from '../components/AppSidebar'
import { LibraryView } from '../components/LibraryView'
import { PalaceView } from '../components/PalaceView'
import { ProfileDialog } from '../components/ProfileDialog'
import { SessionFlow } from '../components/SessionFlow'
import { getDashboard } from '../server/curriculum'

const dashboardQueryOptions = queryOptions({
  queryKey: ['dashboard'],
  queryFn: () => getDashboard(),
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
  const [view, setView] = useState<AppView>('session')
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="grid min-h-screen grid-cols-[210px_minmax(0,1fr)] max-[860px]:block">
      <AppSidebar
        data={data}
        view={view}
        onOpenSettings={() => setProfileOpen(true)}
        onViewChange={setView}
      />
      <section className="min-w-0">
        {view === 'session' ? <SessionFlow data={data} /> : view === 'library' ? <LibraryView /> : <PalaceView />}
      </section>
      {profileOpen ? <ProfileDialog learner={data.learner} onClose={() => setProfileOpen(false)} /> : null}
    </div>
  )
}
