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
  const tag = test ? 'fluenc-test' : 'fluenc-review'
  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'Fluenc',
    body: test ? 'Notifications are ready. Tap to open Review in Fluenc.'
      : 'Time for Mandarin. Finish your reviews, then learn something new and read.',
    tag,
  }), {
    vapidDetails,
    TTL: test ? 300 : 3600,
    timeout: 10_000,
    urgency: 'normal',
    // Apple rejects topics that cannot be decoded as base64url.
    topic: Buffer.from(tag).toString('base64url'),
  })
}

export function isExpiredSubscription(error: unknown) {
  return error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)
}
