import { z } from "zod";

import { disconnectAgent, listAgents } from "./agents.server";
import { auth, mcpResource } from "./auth.server";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const disconnect = z.object({ disconnect: z.string().min(1) });

/** The learner's connected agents, and the address agents connect to. */
export async function handleAgents(request: Request) {
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(request.url).origin
  ) {
    return json({ error: "Invalid origin" }, 403);
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return json({ mcpUrl: mcpResource, agents: null });
  }
  if (request.method === "POST") {
    const input = disconnect.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return json({ error: "Invalid request" }, 400);
    }
    await disconnectAgent(session.user.id, input.data.disconnect);
  }
  const agents = await listAgents(session.user.id);
  return json({
    mcpUrl: mcpResource,
    agents: agents.map((agent) => ({
      clientId: agent.clientId,
      name: agent.name ?? "coding agent",
      connectedAt: agent.connectedAt.toISOString(),
    })),
  });
}
