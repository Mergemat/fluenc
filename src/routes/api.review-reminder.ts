import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/review-reminder')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleReviewReminder } = await import('../server/review-reminder.server')
        return handleReviewReminder(request, {
          cronSecret: process.env.CRON_SECRET,
          webhookUrl: process.env.HARK_WEBHOOK_URL,
          hasDueReviews: async () => {
            const { getDashboardHandler } = await import('../server/curriculum.handlers.server')
            return (await getDashboardHandler()).reviewQueue.length > 0
          },
        })
      },
    },
  },
})
