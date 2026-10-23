import type { ProgressOperation } from "../lib/learner-state";
import { auth } from "./auth.server";
import {
  deviceOperation,
  type SyncResponse,
  syncRequest,
} from "./sync.contract";
import { readPatch, writeOperations } from "./sync.server";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const operationId = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string"
    ? value.id
    : null;

/**
 * One round trip: store the device's changes, then send what changed on the server since its
 * cursor. Every change sent is acknowledged, applied or not, so one the server rejects is not
 * sent again forever.
 */
export async function handleSync(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Invalid origin" }, 403);
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return json({ error: "Sign in to sync" }, 401);
  }
  const input = syncRequest.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return json({ error: "Invalid sync request" }, 400);
  }
  const { cursor, learner, operations } = input.data;
  const { user } = session;
  // Progress on this device belongs to someone else; the device starts over for this account.
  if (learner && learner !== user.id) {
    return json({ error: "This device holds another account's progress" }, 409);
  }

  const valid: ProgressOperation[] = operations.flatMap((operation) => {
    const parsed = deviceOperation.safeParse(operation);
    return parsed.success ? [parsed.data] : [];
  });
  await writeOperations(user.id, valid);
  const { cursor: next, patch } = await readPatch(user.id, cursor);
  return json({
    learner: { id: user.id, email: user.email },
    acknowledged: operations.flatMap(
      (operation) => operationId(operation) ?? []
    ),
    cursor: next,
    reset: cursor === null,
    patch,
  } satisfies SyncResponse);
}
