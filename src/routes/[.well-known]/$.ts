import { createFileRoute } from "@tanstack/react-router";

// OAuth discovery lives at the site root, outside /api/auth; Better Auth answers it.
const handle = async ({ request }: { request: Request }) => {
  const { auth } = await import("../../server/auth.server");
  return auth.handler(request);
};

export const Route = createFileRoute("/.well-known/$")({
  server: { handlers: { GET: handle } },
});
