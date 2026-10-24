/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  type PrecacheEntry,
  precacheAndRoute,
} from "workbox-precaching";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { openReview, showPushNotification } from "../src/notifications/worker";
import { OFFLINE_CACHES } from "../src/offline/files";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: PrecacheEntry[];
};

const STROKES_PATH = /^\/hanzi\/[^/]+\.json$/;
const AUDIO_PATH = /^\/audio\/pinyin\/[^/]+\.mp3$/;

// A new version waits until the page says it is a good moment (see app-update-provider), so a
// running page never loses the files it was built with. Workers from before that handshake
// would never send the message; replacing one of them takes over at once, as they did.
const HANDSHAKE_CACHE = "fluenc-update-handshake";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .has(HANDSHAKE_CACHE)
      .then((ready) => (ready ? undefined : self.skipWaiting()))
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.open(HANDSHAKE_CACHE));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event.data, self.registration));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openReview(self.clients, self.location.origin));
});

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/offline.html"), {
    allowlist: [
      /^\/(?:review|lessons|reading|listen|library|profile|settings|account|welcome)?\/?(?:\?.*)?$/,
      /^\/library\/(?:characters|words)\/[^/?]+\/?(?:\?.*)?$/,
      /^\/profile\/palace\/?(?:\?.*)?$/,
      // The palace's old address, which redirects to the profile.
      /^\/palace(?:\/[^?]*)?(?:\?.*)?$/,
      /^\/profile\/palace\/(?:cast|sets|areas|props)\/[^/?]+\/?(?:\?.*)?$/,
    ],
  })
);

// The page fills these caches (useOfflineDownload); anything it hasn't reached yet is cached on first use.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && STROKES_PATH.test(url.pathname),
  new CacheFirst({ cacheName: OFFLINE_CACHES.strokes })
);
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && AUDIO_PATH.test(url.pathname),
  new CacheFirst({
    cacheName: OFFLINE_CACHES.audio,
    plugins: [new RangeRequestsPlugin()],
  })
);
