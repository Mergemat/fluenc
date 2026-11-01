import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { handleMcp } = await import("../server/mcp.server");
  return handleMcp(request);
};

export const Route = createFileRoute("/mcp")({
  server: { handlers: { GET: handle, POST: handle, DELETE: handle } },
});
