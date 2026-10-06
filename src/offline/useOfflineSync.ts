import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { DashboardData } from '../lib/learner-views'
import { flushProgress, getCachedLearner, hasPendingProgress, persistLearner } from './progress'
import { learnerQueryOptions } from './queries'

export function useOfflineSync(data: DashboardData) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const initialize = async () => {
      const restoreLocal = !navigator.onLine || await hasPendingProgress()
      if (restoreLocal) {
        const cached = await getCachedLearner()
        if (active && cached) queryClient.setQueryData(learnerQueryOptions.queryKey, cached)
      } else {
        // State rendered on the server is not on this device yet.
        const learner = queryClient.getQueryData(learnerQueryOptions.queryKey)
        if (learner) await persistLearner(learner)
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
      await queryClient.invalidateQueries(learnerQueryOptions)
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
