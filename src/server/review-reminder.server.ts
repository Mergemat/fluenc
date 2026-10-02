import { reviewDay } from '../lib/review-schedule'
import type { DeviceSubscription } from './push.contract'
import { isExpiredSubscription } from './push-delivery.server'
import type { PushStore } from './push-store.server'

type ReminderOptions = {
  cronSecret: string | undefined
  configured: boolean
  store: PushStore
  send: (subscription: DeviceSubscription) => Promise<void>
  now?: Date
}

export async function handleReviewReminder(request: Request, options: ReminderOptions) {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!options.cronSecret || request.headers.get('authorization') !== `Bearer ${options.cronSecret}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!options.configured) return json({ error: 'Web Push is not configured' }, 503)

  try {
    const day = reviewDay(options.now ?? new Date())
    const subscriptions = await options.store.claim(day)
    const results = await Promise.allSettled(subscriptions.map(async subscription => {
      try {
        await options.send(subscription)
        return 'accepted'
      } catch (error) {
        if (isExpiredSubscription(error)) {
          await options.store.remove(subscription)
          return 'expired'
        }
        await options.store.release(subscription, day)
        throw new Error('Push delivery failed')
      }
    }))
    const accepted = results.filter(result => result.status === 'fulfilled' && result.value === 'accepted').length
    const failed = results.filter(result => result.status === 'rejected').length
    return json({ status: failed ? 'partial' : accepted ? 'accepted' : 'skipped', devices: accepted, failed }, failed ? 502 : 200)
  } catch {
    return json({ error: 'Could not send the review reminder' }, 502)
  }
}
