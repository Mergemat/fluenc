import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import type { DashboardData } from '../server/curriculum'
import {
  flushProgress,
  getCachedDashboard,
  getOfflineLibrary,
  getOfflinePalace,
  hasPendingProgress,
  persistDashboard,
} from './progress'

export function useOfflineSync(data: DashboardData) {
  const queryClient = useQueryClient()
  const warmedOfflineViews = useRef(false)

  useEffect(() => {
    let active = true

    const sync = async () => {
      const hadPendingProgress = await hasPendingProgress()
      if (hadPendingProgress) {
        const cached = await getCachedDashboard()
        if (active && cached) queryClient.setQueryData(['dashboard'], cached)
      } else {
        await persistDashboard(data)
        if (navigator.onLine && !warmedOfflineViews.current) {
          const results = await Promise.allSettled([getOfflineLibrary(), getOfflinePalace()])
          warmedOfflineViews.current = results.every((result) => result.status === 'fulfilled')
        }
      }

      const synced = await flushProgress()
      if (active && synced) await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }

    const runSync = () => void sync().catch(() => undefined)
    window.addEventListener('online', runSync)
    runSync()
    return () => {
      active = false
      window.removeEventListener('online', runSync)
    }
  }, [data, queryClient])
}
