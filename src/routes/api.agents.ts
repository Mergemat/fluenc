import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { handleAgents } = await import("../server/agents.handlers.server");
  return handleAgents(request);
};

export const Route = createFileRoute("/api/agents")({
  server: { handlers: { GET: handle, POST: handle } },
});
