import { useEffect, useState } from 'react'

import { getCachedDashboard } from '../offline/progress'

type OfflineStatus = 'preparing' | 'ready' | 'error' | 'unsupported'

export function OfflineServiceWorker() {
  const [status, setStatus] = useState<OfflineStatus | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      setStatus('unsupported')
      return
    }

    let active = true
    let cleanup = () => {}
    setStatus('preparing')
    const timeout = window.setTimeout(() => {
      window.clearInterval(poll)
      if (active) setStatus('error')
    }, 30_000)

    const checkReady = async () => {
      const [shell, dashboard] = await Promise.all([
        caches.match('/offline.html', { ignoreSearch: true }),
        getCachedDashboard(),
      ])
      const ready = Boolean(navigator.serviceWorker.controller && shell && dashboard)
      if (active && ready) {
        window.clearTimeout(timeout)
        window.clearInterval(poll)
        setStatus('ready')
      }
      return ready
    }
    const failed = async () => {
      if (!await checkReady().catch(() => false) && active) setStatus('error')
    }
    const retry = () => setAttempt(value => value + 1)
    const poll = window.setInterval(() => void checkReady().catch(failed), 1000)

    const prepare = async () => {
      await checkReady()
      const { Workbox } = await import('workbox-window')
      if (!active) return
      const workbox = new Workbox('/sw.js')
      const ready = () => void checkReady().catch(failed)
      const error = () => void failed()
      workbox.addEventListener('activated', ready)
      workbox.addEventListener('controlling', ready)
      workbox.addEventListener('redundant', error)
      cleanup = () => {
        workbox.removeEventListener('activated', ready)
        workbox.removeEventListener('controlling', ready)
        workbox.removeEventListener('redundant', error)
      }
      await workbox.register({ immediate: true })
      await workbox.controlling
      await checkReady()
      void navigator.storage?.persist?.().catch(() => undefined)
    }

    void prepare().catch(failed)
    window.addEventListener('online', retry)
    return () => {
      active = false
      window.clearTimeout(timeout)
      window.clearInterval(poll)
      cleanup()
      window.removeEventListener('online', retry)
    }
  }, [attempt])

  if (!status) return null
  return <div className="offline-status" role="status">
    {status === 'ready' ? 'Available offline'
      : status === 'preparing' ? 'Saving app and audio…'
        : status === 'unsupported' ? 'Offline storage unavailable'
          : <>Offline setup incomplete. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></>}
  </div>
}
