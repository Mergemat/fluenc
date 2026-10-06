import {
  type UseQueryResult,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useHydrated } from "../hooks/use-hydrated";

export type NotificationStatus =
  | "checking"
  | "install"
  | "unsupported"
  | "development"
  | "unconfigured"
  | "blocked"
  | "off"
  | "on"
  | "error";
export type NotificationAction = "subscribe" | "unsubscribe" | "test";
type Status = NotificationStatus;
type Action = NotificationAction;

async function updateSubscription(
  action: Action,
  subscription: PushSubscription
) {
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, subscription: subscription.toJSON() }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "couldn’t update notifications");
  }
}

async function activeRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  if (registration.active) {
    return registration;
  }
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "activated") {
    return navigator.serviceWorker.ready;
  }
  // The shared worker also prepares offline files; a stalled install must stay retryable.
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      if (error) {
        reject(error);
      } else {
        resolve(registration);
      }
    };
    const check = () => {
      if (worker.state === "activated") {
        finish();
      } else if (worker.state === "redundant") {
        finish(
          new Error(
            "preparing the app failed. check your connection and try again"
          )
        );
      }
    };
    const timer = window.setTimeout(
      () =>
        finish(
          new Error(
            "preparing the app timed out. check your connection and try again"
          )
        ),
      120_000
    );
    worker.addEventListener("statechange", check);
    check();
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Why this device cannot use reminders at all, or null when it can. */
function unavailableStatus(): Status | null {
  if (!import.meta.env.PROD) {
    return "development";
  }
  if (!isStandalone()) {
    return "install";
  }
  if (
    !(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    )
  ) {
    return "unsupported";
  }
  return null;
}

async function readPushSetup() {
  const response = await fetch("/api/push", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      "couldn’t check notifications. connect to the internet and retry"
    );
  }
  const config = (await response.json()) as { publicKey: string | null };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription =
    (await registration?.pushManager.getSubscription()) ?? null;
  return { publicKey: config.publicKey, subscription };
}

/** This device's push subscription, asking for permission first. Null when it is not granted. */
async function subscribeDevice(publicKey: string | null) {
  // Request permission directly from the tap, before fetching or registering a worker.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { permission, subscription: null };
  }
  if (!publicKey) {
    throw new Error("notifications aren’t set up yet");
  }
  const registration = await activeRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    }));
  return { permission, subscription };
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface PushState {
  /** Why the last check failed while still knowing the subscription, if it did. */
  message?: string;
  publicKey: string | null;
  status: Extract<Status, "unconfigured" | "blocked" | "on" | "off" | "error">;
  subscription: PushSubscription | null;
}

/** The server's push setup and this device's subscription, re-registered with the server. */
async function readPushState(): Promise<PushState> {
  const { publicKey, subscription } = await readPushSetup();
  if (!publicKey) {
    return { publicKey, subscription, status: "unconfigured" };
  }
  if (Notification.permission === "denied") {
    return { publicKey, subscription, status: "blocked" };
  }
  if (!subscription) {
    return { publicKey, subscription, status: "off" };
  }
  try {
    await updateSubscription("subscribe", subscription);
  } catch (error) {
    // Keep the subscription so it can still be turned off.
    return {
      publicKey,
      subscription,
      status: "error",
      message: errorMessage(error, "couldn’t check notifications"),
    };
  }
  return { publicKey, subscription, status: "on" };
}

/** Where this device stands, and why when a check failed. */
function notificationState(
  unavailable: Status | null,
  hydrated: boolean,
  push: Pick<
    UseQueryResult<PushState>,
    "data" | "error" | "isError" | "isFetching"
  >
): { status: Status; message: string } {
  if (unavailable) {
    return { status: unavailable, message: "" };
  }
  if (push.isFetching || !hydrated) {
    return { status: "checking", message: "" };
  }
  if (push.isError) {
    return {
      status: "error",
      message: errorMessage(push.error, "couldn’t check notifications"),
    };
  }
  if (push.data) {
    return { status: push.data.status, message: push.data.message ?? "" };
  }
  return { status: "checking", message: "" };
}

const pushStateKey = ["push-state"] as const;

export function useNotifications() {
  const hydrated = useHydrated();
  const unavailable = hydrated ? unavailableStatus() : null;
  const queryClient = useQueryClient();
  const push = useQuery({
    queryKey: pushStateKey,
    queryFn: readPushState,
    enabled: hydrated && !unavailable,
    networkMode: "always",
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const publicKey = push.data?.publicKey ?? null;
  const subscription = push.data?.subscription ?? null;

  const { status, message: checkMessage } = notificationState(
    unavailable,
    hydrated,
    push
  );
  const message = actionMessage || checkMessage;

  const update = useCallback(
    (patch: Partial<PushState>) =>
      queryClient.setQueryData<PushState>(pushStateKey, (previous) =>
        previous ? { ...previous, ...patch, message: undefined } : previous
      ),
    [queryClient]
  );

  const run = useCallback(
    async (action: Action) => {
      setBusy(action);
      setActionMessage("");
      try {
        if (action === "subscribe") {
          const result = await subscribeDevice(publicKey);
          if (result.subscription) {
            update({ subscription: result.subscription });
            await updateSubscription("subscribe", result.subscription);
            update({ status: "on" });
          } else {
            update({
              status: result.permission === "denied" ? "blocked" : "off",
            });
          }
        } else if (subscription) {
          await updateSubscription(action, subscription);
          if (action === "unsubscribe") {
            await subscription.unsubscribe();
            update({
              subscription: null,
              status: publicKey ? "off" : "unconfigured",
            });
          } else {
            setActionMessage("test sent. tap the notification to open review");
          }
        }
      } catch (error) {
        setActionMessage(
          errorMessage(error, "couldn’t update notifications. try again")
        );
      } finally {
        setBusy(null);
      }
    },
    [publicKey, subscription, update]
  );
  const enable = useCallback(() => {
    run("subscribe");
  }, [run]);
  const disable = useCallback(() => {
    run("unsubscribe");
  }, [run]);
  const { refetch } = push;
  const retry = useCallback(() => {
    setActionMessage("");
    refetch();
  }, [refetch]);

  return {
    status,
    busy,
    message,
    hasSubscription: !!subscription,
    run,
    enable,
    disable,
    retry,
  };
}
