import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/push')({
  server: {
    handlers: {
      GET: async () => {
        const { getPushConfig } = await import('../server/push.handlers.server')
        return getPushConfig()
      },
      POST: async ({ request }) => {
        const { handlePushAction } = await import('../server/push.handlers.server')
        return handlePushAction(request)
      },
    },
  },
})
