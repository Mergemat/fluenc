import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/review-reminder')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleReviewReminder } = await import('../server/review-reminder.server')
        const { getVapidDetails, sendPush } = await import('../server/push-delivery.server')
        const { createPushStore } = await import('../server/push-store.server')
        const { db } = await import('../db')
        return handleReviewReminder(request, {
          cronSecret: process.env.CRON_SECRET,
          configured: !!getVapidDetails(),
          store: createPushStore(db),
          send: sendPush,
          hasDueReviews: async () => {
            const { getDashboardHandler } = await import('../server/curriculum.handlers.server')
            return (await getDashboardHandler()).reviewQueue.length > 0
          },
        })
      },
    },
  },
})
