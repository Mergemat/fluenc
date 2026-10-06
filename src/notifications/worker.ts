/// <reference lib="webworker" />

export function showPushNotification(
  data: PushMessageData | null,
  registration: ServiceWorkerRegistration
) {
  let payload: { title?: string; body?: string; tag?: string } = {};
  try {
    payload = data?.json() ?? {};
  } catch {
    /* Even an empty push must display a notification. */
  }
  return registration.showNotification(
    typeof payload?.title === "string" ? payload.title : "Fluenc",
    {
      body:
        typeof payload?.body === "string"
          ? payload.body
          : "Time for your daily Mandarin review.",
      tag: typeof payload?.tag === "string" ? payload.tag : "fluenc-review",
      icon: "/brand/icon-192.png",
    }
  );
}

/** Show the destination in the first app window that can, one window at a time. */
async function openInWindow(
  windows: readonly WindowClient[],
  destination: string
): Promise<boolean> {
  const [client, ...rest] = windows;
  if (!client) {
    return false;
  }
  try {
    // Focus before navigation: iOS may still be resuming the installed app.
    await client.focus();
    if (client.url === destination || (await client.navigate(destination))) {
      return true;
    }
  } catch {
    /* A window can close while the notification is being opened. */
  }
  return openInWindow(rest, destination);
}

export async function openReview(clients: Clients, origin: string) {
  const destination = new URL("/review", origin).href;
  const windows = await clients.matchAll({ type: "window" });
  const opened = await openInWindow(
    windows.filter((client) => new URL(client.url).origin === origin),
    destination
  );
  if (!opened) {
    await clients.openWindow(destination);
  }
}
