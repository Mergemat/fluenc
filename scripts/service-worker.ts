/// <reference lib="webworker" />

import { cacheNames, clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { addPlugins, cleanupOutdatedCaches, createHandlerBoundToURL, getCacheKeyForURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import type { DownloadProgress } from '../src/offline/useOfflineDownload'
import { openReview, showPushNotification } from '../src/notifications/worker'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

void self.skipWaiting()
clientsClaim()
addPlugins([new RangeRequestsPlugin()])
const entries = self.__WB_MANIFEST
precacheAndRoute(entries)
cleanupOutdatedCaches()

self.addEventListener('push', event => {
  event.waitUntil(showPushNotification(event.data, self.registration))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(openReview(self.clients, self.location.origin))
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'DOWNLOAD_PROGRESS') return
  event.waitUntil((async () => {
    const cache = await caches.open(cacheNames.precache)
    const cached = new Set((await cache.keys()).map(request => request.url))
    const progress: DownloadProgress = {
      completed: entries.filter(entry => cached.has(getCacheKeyForURL(typeof entry === 'string' ? entry : entry.url) ?? '')).length,
      total: entries.length,
    }
    event.ports[0]?.postMessage(progress)
  })())
})

registerRoute(new NavigationRoute(createHandlerBoundToURL('/offline.html'), {
  allowlist: [
    /^\/(?:review|lessons|reading|library|palace|settings)?\/?(?:\?.*)?$/,
    /^\/library\/(?:characters|words)\/[^/?]+\/?(?:\?.*)?$/,
  ],
}))

registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/hanzi\/[^/]+\.json$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'fluenc-strokes',
    plugins: [new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
)
