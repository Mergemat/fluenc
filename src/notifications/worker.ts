/// <reference lib="webworker" />

export function showPushNotification(data: PushMessageData | null, registration: ServiceWorkerRegistration) {
  let payload: { title?: string; body?: string; tag?: string } = {}
  try { payload = data?.json() ?? {} } catch { /* Even an empty push must display a notification. */ }
  return registration.showNotification(typeof payload?.title === 'string' ? payload.title : 'Fluenc', {
    body: typeof payload?.body === 'string' ? payload.body : 'Your Mandarin reviews are ready.',
    tag: typeof payload?.tag === 'string' ? payload.tag : 'fluenc-review',
    icon: '/brand/icon-192.png',
  })
}

export async function openReview(clients: Clients, origin: string) {
  const destination = new URL('/review', origin).href
  const windows = await clients.matchAll({ type: 'window' })
  for (const client of windows) {
    if (new URL(client.url).origin !== origin) continue
    try {
      // Focus before navigation: iOS may still be resuming the installed app.
      await client.focus()
      if (client.url !== destination && !await client.navigate(destination)) continue
      return
    } catch { /* A window can close while the notification is being opened. */ }
  }
  await clients.openWindow(destination)
}
