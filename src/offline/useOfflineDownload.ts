import { useEffect, useState } from 'react'

import { getCachedDashboard } from './progress'

export type DownloadProgress = { completed: number; total: number }
type DownloadStatus = 'checking' | 'idle' | 'downloading' | 'ready' | 'error' | 'unsupported' | 'development'

export function useOfflineDownload() {
  const [status, setStatus] = useState<DownloadStatus>('checking')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!import.meta.env.PROD) {
      setStatus('development')
      return
    }
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      setStatus('unsupported')
      return
    }

    let active = true
    let poll: number | undefined
    let timeout: number | undefined
    let cleanup = () => {}
    let completed = -1
    const stopTimers = () => {
      window.clearInterval(poll)
      window.clearTimeout(timeout)
    }
    const fail = () => {
      stopTimers()
      if (active) setStatus('error')
    }
    const watchProgress = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(fail, 30_000)
    }

    const prepare = async () => {
      const existing = await navigator.serviceWorker.getRegistration('/')
      if (!active) return
      if (!existing && attempt === 0) {
        setStatus('idle')
        return
      }
      setStatus('downloading')
      watchProgress()
      const { Workbox, messageSW } = await import('workbox-window')
      if (!active) return
      const workbox = new Workbox('/sw.js')
      const registration = await workbox.register({ immediate: true })
      if (!active || !registration) return

      const check = async () => {
        const worker = registration.installing ?? registration.waiting ?? registration.active
        if (!worker) return
        const download: DownloadProgress = await messageSW(worker, { type: 'DOWNLOAD_PROGRESS' })
        if (!active) return
        setProgress(download)
        if (download.completed > completed) {
          completed = download.completed
          watchProgress()
        }
        if (download.completed === download.total && worker.state === 'activated' && navigator.serviceWorker.controller && await getCachedDashboard()) {
          stopTimers()
          if (active) setStatus('ready')
          void navigator.storage?.persist?.().catch(() => undefined)
        }
      }
      const checkProgress = () => void check().catch(fail)
      workbox.addEventListener('activated', checkProgress)
      workbox.addEventListener('controlling', checkProgress)
      workbox.addEventListener('redundant', fail)
      cleanup = () => {
        workbox.removeEventListener('activated', checkProgress)
        workbox.removeEventListener('controlling', checkProgress)
        workbox.removeEventListener('redundant', fail)
      }
      poll = window.setInterval(checkProgress, 1000)
      checkProgress()
    }

    void prepare().catch(fail)
    return () => {
      active = false
      stopTimers()
      cleanup()
    }
  }, [attempt])

  return { status, progress, download: () => setAttempt(value => value + 1) }
}

export type OfflineDownload = ReturnType<typeof useOfflineDownload>
