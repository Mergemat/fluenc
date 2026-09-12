import webpush from 'web-push'

import type { DeviceSubscription } from './push.contract'

export function getVapidDetails() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

export async function sendPush(subscription: DeviceSubscription, test = false) {
  const vapidDetails = getVapidDetails()
  if (!vapidDetails) throw new Error('Web Push is not configured')
  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'Fluenc',
    body: test ? 'Notifications are ready. Tap to open Review in Fluenc.'
      : 'Your Mandarin reviews are ready. Start with recent cards, then catch up at your pace.',
    tag: test ? 'fluenc-test' : 'fluenc-review',
  }), {
    vapidDetails,
    TTL: test ? 300 : 3600,
    timeout: 10_000,
    urgency: 'normal',
    topic: test ? 'fluenc-test' : 'fluenc-review',
  })
}

export function isExpiredSubscription(error: unknown) {
  return error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)
}
