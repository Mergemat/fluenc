import { useIsMutating } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Workbox } from 'workbox-window'

import { AppUpdateToast } from './AppUpdateToast'

type UpdateStatus = 'checking' | 'current' | 'applying' | 'error' | 'unsupported' | 'development'
type AppUpdate = {
  status: UpdateStatus
  available: boolean
  check: () => Promise<void>
  apply: () => void
}

const AppUpdateContext = createContext<AppUpdate | null>(null)

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>('checking')
  const [available, setAvailable] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const workbox = useRef<Workbox | null>(null)
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const saving = useIsMutating() > 0

  useEffect(() => {
    if (!import.meta.env.PROD) {
      setStatus('development')
      return
    }
    if (!('serviceWorker' in navigator)) {
      setStatus('unsupported')
      return
    }

    let active = true
    let cleanup = () => {}
    const prepare = async () => {
      const { Workbox } = await import('workbox-window')
      if (!active) return
      const worker = new Workbox('/sw.js', { scope: '/', updateViaCache: 'none' })
      workbox.current = worker
      const updated = () => {
        if (!active) return
        setAvailable(true)
        setToastOpen(true)
        setStatus('current')
      }
      const activated = (event: { isUpdate?: boolean }) => {
        if (!active) return
        if (event.isUpdate) updated()
        else setStatus('current')
      }
      const failed = () => { if (active) setStatus('error') }
      worker.addEventListener('activated', activated)
      worker.addEventListener('redundant', failed)
      const checkInBackground = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void worker.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', checkInBackground)
      window.addEventListener('online', checkInBackground)
      const interval = window.setInterval(checkInBackground, 60 * 60 * 1000)
      cleanup = () => {
        worker.removeEventListener('activated', activated)
        worker.removeEventListener('redundant', failed)
        document.removeEventListener('visibilitychange', checkInBackground)
        window.removeEventListener('online', checkInBackground)
        window.clearInterval(interval)
      }
      const result = await worker.register({ immediate: true })
      if (!active) return
      if (!result) throw new Error('App registration failed')
      registration.current = result
      if (!result.installing) setStatus('current')
    }
    void prepare().catch(() => { if (active) setStatus('error') })
    return () => {
      active = false
      cleanup()
      workbox.current = null
      registration.current = null
    }
  }, [attempt])

  const check = async () => {
    if (available) {
      setToastOpen(true)
      return
    }
    if (!workbox.current || !registration.current) {
      setStatus('checking')
      setAttempt(value => value + 1)
      return
    }
    setStatus('checking')
    try {
      await workbox.current.update()
      if (!registration.current.installing && !registration.current.waiting) setStatus('current')
    } catch {
      setStatus('error')
    }
  }
  const apply = () => {
    if (saving || !available || status === 'applying') return
    setStatus('applying')
    window.location.reload()
  }

  return <AppUpdateContext.Provider value={{ status, available, check, apply }}>
    {children}
    {toastOpen && available ? <AppUpdateToast updating={status === 'applying'} saving={saving} onRefresh={apply} onDismiss={() => setToastOpen(false)} /> : null}
  </AppUpdateContext.Provider>
}

export function useAppUpdate() {
  const update = useContext(AppUpdateContext)
  if (!update) throw new Error('App updates require the app layout')
  return update
}
