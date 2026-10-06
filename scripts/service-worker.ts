/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { OFFLINE_CACHES } from '../src/offline/files'
import { openReview, showPushNotification } from '../src/notifications/worker'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

void self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', event => {
  event.waitUntil(showPushNotification(event.data, self.registration))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(openReview(self.clients, self.location.origin))
})

registerRoute(new NavigationRoute(createHandlerBoundToURL('/offline.html'), {
  allowlist: [
    /^\/(?:review|lessons|reading|library|palace|settings)?\/?(?:\?.*)?$/,
    /^\/library\/(?:characters|words)\/[^/?]+\/?(?:\?.*)?$/,
    /^\/palace\/(?:cast|sets|areas|props)\/[^/?]+\/?(?:\?.*)?$/,
  ],
}))

// The page fills these caches (useOfflineDownload); anything it hasn't reached yet is cached on first use.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/hanzi\/[^/]+\.json$/.test(url.pathname),
  new CacheFirst({ cacheName: OFFLINE_CACHES.strokes }),
)
registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/audio\/pinyin\/[^/]+\.mp3$/.test(url.pathname),
  new CacheFirst({ cacheName: OFFLINE_CACHES.audio, plugins: [new RangeRequestsPlugin()] }),
)
