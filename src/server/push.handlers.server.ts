import { db } from "../db";
import { pushActionInput } from "./push.contract";
import {
  getVapidDetails,
  isExpiredSubscription,
  sendPush,
} from "./push-delivery.server";
import { createPushStore } from "./push-store.server";

const store = createPushStore(db);
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function getPushConfig() {
  const config = getVapidDetails();
  return json({ publicKey: config?.publicKey ?? null });
}

export async function handlePushAction(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Invalid origin" }, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Expected JSON" }, 415);
  }
  const input = pushActionInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return json({ error: "Invalid push subscription" }, 400);
  }
  const { action, subscription } = input.data;
  try {
    if (action === "unsubscribe") {
      await store.remove(subscription);
    } else {
      if (!getVapidDetails()) {
        return json({ error: "Notifications are not configured yet" }, 503);
      }
      if (action === "subscribe") {
        await store.save(subscription);
      } else {
        if (!(await store.has(subscription))) {
          return json({ error: "Enable notifications first" }, 404);
        }
        await sendPush(subscription, true);
      }
    }
    return json({ ok: true });
  } catch (error) {
    if (isExpiredSubscription(error)) {
      await store.remove(subscription);
      return json(
        {
          error:
            "This subscription expired. Turn notifications off and on again.",
        },
        410
      );
    }
    // Provider errors can contain subscription credentials.
    return json(
      { error: "Could not update or send notifications. Please try again." },
      502
    );
  }
}
