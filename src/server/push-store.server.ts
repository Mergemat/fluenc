import { and, eq, isNull, lt, or } from 'drizzle-orm'

import type { db } from '../db'
import { pushSubscriptions } from '../db/schema'
import type { DeviceSubscription } from './push.contract'

export function createPushStore(database: typeof db) {
  const owned = (subscription: DeviceSubscription) => and(
    eq(pushSubscriptions.endpoint, subscription.endpoint),
    eq(pushSubscriptions.auth, subscription.keys.auth),
    eq(pushSubscriptions.p256dh, subscription.keys.p256dh),
  )

  return {
    async save(subscription: DeviceSubscription) {
      await database.insert(pushSubscriptions).values({ endpoint: subscription.endpoint, ...subscription.keys })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: subscription.keys })
    },
    async has(subscription: DeviceSubscription) {
      return (await database.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).where(owned(subscription))).length > 0
    },
    async remove(subscription: DeviceSubscription) {
      await database.delete(pushSubscriptions).where(owned(subscription))
    },
    async claim(day: number) {
      const rows = await database.update(pushSubscriptions).set({ lastReminderDay: day })
        .where(or(isNull(pushSubscriptions.lastReminderDay), lt(pushSubscriptions.lastReminderDay, day)))
        .returning()
      return rows.map(({ endpoint, p256dh, auth }) => ({ endpoint, keys: { p256dh, auth } }))
    },
    async release(subscription: DeviceSubscription, day: number) {
      await database.update(pushSubscriptions).set({ lastReminderDay: null })
        .where(and(owned(subscription), eq(pushSubscriptions.lastReminderDay, day)))
    },
  }
}

export type PushStore = ReturnType<typeof createPushStore>
