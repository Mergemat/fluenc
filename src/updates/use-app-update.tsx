import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Workbox } from "workbox-window";

const UPDATE_TOAST = "app-update";

/** Reload, switching to a waiting version first so the reload brings it in. */
export async function reloadApp() {
  const waiting = (await navigator.serviceWorker?.getRegistration())?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => window.location.reload(),
    { once: true }
  );
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * New versions install in the background and wait; a toast offers to switch, so a reload only
 * ever happens when the learner asks for it.
 */
export function useAppUpdate() {
  const [waiting, setWaiting] = useState(false);
  const queryClient = useQueryClient();
  // A lesson can hold a half-written Hanzi Movie; it is not saved until the lesson is done.
  const drafting = useLocation({
    select: (location) => location.pathname.startsWith("/lessons"),
  });

  useEffect(() => {
    if (!(import.meta.env.PROD && "serviceWorker" in navigator)) {
      return;
    }
    let active = true;
    let worker: Workbox | null = null;
    const onWaiting = () => {
      if (active) {
        setWaiting(true);
      }
    };
    // The browser only checks on navigation, which an open app rarely does.
    const check = () => {
      if (document.visibilityState === "visible") {
        worker?.update().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 60 * 60 * 1000);

    import("workbox-window")
      .then(({ Workbox: WorkboxClient }) => {
        if (!active) {
          return;
        }
        worker = new WorkboxClient("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        worker.addEventListener("waiting", onWaiting);
        return worker.register({ immediate: true });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
      worker?.removeEventListener("waiting", onWaiting);
    };
  }, []);

  useEffect(() => {
    if (!waiting || drafting) {
      return;
    }
    toast("new version ready", {
      id: UPDATE_TOAST,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "update",
        onClick: (event) => {
          // Progress is on the device, so a reload loses nothing once saves have finished.
          if (queryClient.isMutating()) {
            event.preventDefault();
            return;
          }
          reloadApp().catch(() => undefined);
        },
      },
    });
    return () => {
      toast.dismiss(UPDATE_TOAST);
    };
  }, [waiting, drafting, queryClient]);
}
