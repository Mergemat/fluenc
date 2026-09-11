import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { DashboardData } from '../server/curriculum'
import { flushProgress, getCachedDashboard, hasPendingProgress, persistDashboard } from './progress'
import { dashboardQueryOptions, libraryQueryOptions, palaceQueryOptions } from './queries'

export function useOfflineSync(data: DashboardData) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const initialize = async () => {
      const dashboard = queryClient.getQueryData(dashboardQueryOptions.queryKey)
      if (dashboard) await persistDashboard(dashboard)
      if (await hasPendingProgress()) {
        const cached = await getCachedDashboard()
        if (active && cached) queryClient.setQueryData(dashboardQueryOptions.queryKey, cached)
      }
      if (active) {
        void queryClient.prefetchQuery(libraryQueryOptions)
        void queryClient.prefetchQuery(palaceQueryOptions)
      }
    }
    void initialize().catch(() => undefined)
    return () => { active = false }
  }, [queryClient])

  useEffect(() => {
    let active = true
    const sync = async () => {
      const synced = await flushProgress()
      if (!active || !synced || await hasPendingProgress()) return
      await Promise.all([
        queryClient.invalidateQueries(dashboardQueryOptions),
        queryClient.invalidateQueries(libraryQueryOptions),
        queryClient.invalidateQueries(palaceQueryOptions),
      ])
    }
    const runSync = () => void sync().catch(() => undefined)
    // Batch rapid actions and keep retries independent of button completion.
    const timer = window.setTimeout(runSync, 400)
    const retry = window.setInterval(runSync, 30_000)
    window.addEventListener('online', runSync)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(retry)
      window.removeEventListener('online', runSync)
    }
  }, [data, queryClient])
}
