import { useEffect, useState } from 'react'

type Status = 'checking' | 'install' | 'unsupported' | 'development' | 'unconfigured' | 'blocked' | 'off' | 'on' | 'error'
type Action = 'subscribe' | 'unsubscribe' | 'test'

async function updateSubscription(action: Action, subscription: PushSubscription) {
  const response = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, subscription: subscription.toJSON() }),
    signal: AbortSignal.timeout(15_000),
  })
  const result = await response.json() as { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'Could not update notifications.')
}

async function activeRegistration() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  const worker = registration.installing ?? registration.waiting
  if (!worker || worker.state === 'activated') return navigator.serviceWorker.ready
  // The shared worker also prepares offline files; a stalled install must stay retryable.
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer)
      worker.removeEventListener('statechange', check)
      if (error) reject(error)
      else resolve(registration)
    }
    const check = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'redundant') finish(new Error('App preparation failed. Check your connection and try again.'))
    }
    const timer = window.setTimeout(() => finish(new Error('App preparation timed out. Check your connection and try again.')), 120_000)
    worker.addEventListener('statechange', check)
    check()
  })
}

export function useNotifications() {
  const [status, setStatus] = useState<Status>('checking')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!import.meta.env.PROD) { setStatus('development'); return }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (!standalone) { setStatus('install'); return }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported'); return
    }
    let active = true
    setStatus('checking')
    setMessage('')
    const check = async () => {
      const response = await fetch('/api/push', { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error('Could not check notifications. Connect to the internet and retry.')
      const config = await response.json() as { publicKey: string | null }
      const registration = await navigator.serviceWorker.getRegistration('/')
      const current = await registration?.pushManager.getSubscription() ?? null
      if (!active) return
      setPublicKey(config.publicKey)
      setSubscription(current)
      if (!config.publicKey) { setStatus('unconfigured'); return }
      if (Notification.permission === 'denied') { setStatus('blocked'); return }
      if (current) await updateSubscription('subscribe', current)
      if (active) setStatus(current ? 'on' : 'off')
    }
    void check().catch(error => {
      if (active) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not check notifications.') }
    })
    return () => { active = false }
  }, [attempt])

  const run = async (action: Action) => {
    setBusy(action)
    setMessage('')
    try {
      if (action === 'subscribe') {
        // Request permission directly from the tap, before fetching or registering a worker.
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'blocked' : 'off')
          return
        }
        if (!publicKey) throw new Error('Notifications are not configured yet.')
        const registration = await activeRegistration()
        const current = await registration.pushManager.getSubscription()
          ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })
        setSubscription(current)
        await updateSubscription('subscribe', current)
        setStatus('on')
      } else if (subscription) {
        await updateSubscription(action, subscription)
        if (action === 'unsubscribe') {
          await subscription.unsubscribe()
          setSubscription(null)
          setStatus(publicKey ? 'off' : 'unconfigured')
        } else setMessage('Test sent. Tap the notification to open Review.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update notifications. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return { status, busy, message, hasSubscription: !!subscription, run, retry: () => setAttempt(value => value + 1) }
}
