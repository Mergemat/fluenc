import { useEffect } from 'react'

async function waitForController() {
  if (navigator.serviceWorker.controller) return
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 3_000)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}

export function OfflineServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    const prepareOfflineApp = async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      await waitForController()
      await fetch('/', { cache: 'reload', credentials: 'same-origin' })
      await navigator.storage?.persist?.()
    }

    void prepareOfflineApp().catch(() => undefined)
  }, [])

  return null
}
