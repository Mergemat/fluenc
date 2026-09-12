import { z } from 'zod'

// Only browser push providers may receive server requests from saved subscriptions.
const endpoint = z.url().max(2048).refine(value => {
  const url = URL.parse(value)
  return !!url && url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
    && (url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com')
      || url.hostname === 'fcm.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com')
}, 'Unsupported push provider')

export const pushSubscriptionInput = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,1}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
})

export const pushActionInput = z.object({
  action: z.enum(['subscribe', 'unsubscribe', 'test']),
  subscription: pushSubscriptionInput,
})

export type DeviceSubscription = z.infer<typeof pushSubscriptionInput>
