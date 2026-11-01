import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleCleanup } = await import("../server/cleanup.server");
        return handleCleanup(request);
      },
    },
  },
});
