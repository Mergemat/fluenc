import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/review-reminder")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [
          { handleReviewReminder },
          { getVapidDetails, sendPush },
          { createPushStore },
          { db },
        ] = await Promise.all([
          import("../server/review-reminder.server"),
          import("../server/push-delivery.server"),
          import("../server/push-store.server"),
          import("../db"),
        ]);
        return handleReviewReminder(request, {
          cronSecret: process.env.CRON_SECRET,
          configured: !!getVapidDetails(),
          store: createPushStore(db),
          send: sendPush,
        });
      },
    },
  },
});
