import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSync } = await import("../server/sync.handlers.server");
        return handleSync(request);
      },
    },
  },
});
