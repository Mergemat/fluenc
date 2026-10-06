import { useEffect, useState } from 'react'

import { OFFLINE_CACHES, OFFLINE_FILES_URL, type OfflineFile, type OfflineFiles } from './files'
import { getCachedLearner } from './progress'

export type DownloadProgress = { completed: number; total: number }
type DownloadStatus = 'checking' | 'idle' | 'downloading' | 'ready' | 'error' | 'unsupported' | 'development'

// Each cache keeps the list it was last filled from, so a changed file is fetched again.
const REVISIONS_KEY = '/__revisions'
const PARALLEL = 6
const STEP_TIMEOUT = 30_000

const withTimeout = <T,>(promise: Promise<T>, ms = STEP_TIMEOUT) => new Promise<T>((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error('Timed out')), ms)
  promise.then(value => { window.clearTimeout(timer); resolve(value) }, error => { window.clearTimeout(timer); reject(error) })
})

async function staleFiles(cache: Cache, files: OfflineFile[]) {
  const stored = await cache.match(REVISIONS_KEY)
  const revisions: Record<string, string> = stored ? await stored.json() : {}
  const cached = new Set((await cache.keys()).map(request => request.url))
  return files.filter(file => revisions[file.url] !== file.revision || !cached.has(new URL(file.url, location.origin).href))
}

/**
 * Downloads pinyin audio and stroke data straight into the caches the service worker serves
 * them from. Runs in the page, so progress is exact and doesn't wait on the worker's install.
 */
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
    const download = async () => {
      // Offline practice downloads by itself; without a connection it waits for one.
      if (!navigator.onLine) {
        setStatus('idle')
        return
      }
      setStatus('downloading')
      const response = await withTimeout(fetch(OFFLINE_FILES_URL, { cache: 'no-cache' }))
      if (!response.ok) throw new Error('Offline file list unavailable')
      const lists = await response.json() as OfflineFiles

      const groups = await Promise.all((Object.keys(OFFLINE_CACHES) as (keyof OfflineFiles)[]).map(async key => {
        const cache = await caches.open(OFFLINE_CACHES[key])
        return { cache, files: lists[key], stale: await staleFiles(cache, lists[key]) }
      }))
      const total = groups.reduce((sum, group) => sum + group.files.length, 0)
      let completed = total - groups.reduce((sum, group) => sum + group.stale.length, 0)
      if (!active) return
      setProgress({ completed, total })

      for (const group of groups) {
        const queue = [...group.stale]
        const worker = async () => {
          for (let file = queue.shift(); file && active; file = queue.shift()) {
            // The worker answers cache-first, so drop an outdated copy before fetching it again.
            await group.cache.delete(file.url)
            const fetched = await withTimeout(fetch(file.url, { cache: 'no-cache' }))
            if (!fetched.ok) throw new Error(`Could not download ${file.url}`)
            await group.cache.put(file.url, fetched)
            completed += 1
            if (active) setProgress({ completed, total })
          }
        }
        await Promise.all(Array.from({ length: PARALLEL }, worker))
        if (!active) return
        const revisions = Object.fromEntries(group.files.map(file => [file.url, file.revision]))
        await group.cache.put(REVISIONS_KEY, new Response(JSON.stringify(revisions), { headers: { 'content-type': 'application/json' } }))
      }

      // The app shell and course install in the service worker; progress comes from the saved learner state.
      await withTimeout(navigator.serviceWorker.ready)
      if (!await getCachedLearner()) throw new Error('Lessons are not saved yet')
      if (!active) return
      setStatus('ready')
      void navigator.storage?.persist?.().catch(() => undefined)
    }

    void download().catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [attempt])

  // Retry an interrupted or deferred download as soon as the device is back online.
  useEffect(() => {
    if (status !== 'error' && status !== 'idle') return
    const retry = () => setAttempt(value => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [status])

  return { status, progress }
}

export type OfflineDownload = ReturnType<typeof useOfflineDownload>
