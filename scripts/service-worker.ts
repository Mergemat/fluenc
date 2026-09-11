/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { addPlugins, cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

void self.skipWaiting()
clientsClaim()
addPlugins([new RangeRequestsPlugin()])
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(new NavigationRoute(createHandlerBoundToURL('/offline.html'), {
  allowlist: [/^\/(?:\?.*)?$/],
}))

registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/hanzi\/[^/]+\.json$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'fluenc-strokes',
    plugins: [new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
)
