import { useIsMutating } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Workbox } from "workbox-window";

import { useToast } from "../components/ui/toast";

export type UpdateStatus =
  | "checking"
  | "current"
  /** A new version is installed and waiting for a good moment. */
  | "ready"
  | "applying"
  | "error"
  | "unsupported"
  | "development";
interface AppUpdate {
  /** Switch to the waiting version now. */
  apply: () => void;
  status: UpdateStatus;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);
// Set just before the reload that applies an update, so the new version can say it arrived.
const UPDATED_KEY = "fluenc-updated";

/**
 * New versions install in the background and wait. One takes over the next time fluenc is out of
 * sight, outside a lesson, so it never reloads under the learner's hands; settings can apply it
 * straight away.
 * Progress is on the device, so a reload loses nothing once saves have finished.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const workbox = useRef<Workbox | null>(null);
  const saving = useIsMutating() > 0;
  // A lesson can hold a half-written Hanzi Movie; it is not saved until the lesson is done.
  const drafting = useLocation({
    select: (location) => location.pathname.startsWith("/lessons"),
  });
  const toast = useToast();

  useEffect(() => {
    if (sessionStorage.getItem(UPDATED_KEY)) {
      sessionStorage.removeItem(UPDATED_KEY);
      toast("fluenc updated");
    }
  }, [toast]);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      setStatus("development");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    let active = true;
    let worker: Workbox | null = null;
    const onWaiting = () => {
      if (active) {
        setStatus("ready");
      }
    };
    // Only a version replacing this one reloads; the first install already runs this code.
    const onControlling = (event: { isUpdate?: boolean }) => {
      if (event.isUpdate) {
        sessionStorage.setItem(UPDATED_KEY, "1");
        window.location.reload();
      }
    };
    const onRedundant = () => {
      if (active) {
        setStatus("error");
      }
    };
    // Check for a new version whenever the app is in use.
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        worker?.update().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    const interval = window.setInterval(check, 60 * 60 * 1000);

    const prepare = async () => {
      const { Workbox: WorkboxClient } = await import("workbox-window");
      if (!active) {
        return;
      }
      worker = new WorkboxClient("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      workbox.current = worker;
      worker.addEventListener("waiting", onWaiting);
      worker.addEventListener("controlling", onControlling);
      worker.addEventListener("redundant", onRedundant);
      const registration = await worker.register({ immediate: true });
      if (!registration) {
        throw new Error("App registration failed");
      }
      if (active && !registration.waiting) {
        setStatus((current) => (current === "checking" ? "current" : current));
      }
    };
    prepare().catch(() => {
      if (active) {
        setStatus("error");
      }
    });
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.clearInterval(interval);
      worker?.removeEventListener("waiting", onWaiting);
      worker?.removeEventListener("controlling", onControlling);
      worker?.removeEventListener("redundant", onRedundant);
      workbox.current = null;
    };
  }, []);

  const apply = useCallback(() => {
    if (saving || status !== "ready" || !workbox.current) {
      return;
    }
    setStatus("applying");
    workbox.current.messageSkipWaiting();
  }, [saving, status]);

  // Leaving fluenc is the moment: the reload happens out of sight.
  const applyWhenHidden = useEffectEvent(() => {
    if (document.visibilityState === "hidden") {
      apply();
    }
  });
  useEffect(() => {
    if (status !== "ready" || saving || drafting) {
      return;
    }
    const onVisibility = () => applyWhenHidden();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [drafting, saving, status]);

  const update = useMemo(() => ({ status, apply }), [status, apply]);
  return (
    <AppUpdateContext.Provider value={update}>
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const update = useContext(AppUpdateContext);
  if (!update) {
    throw new Error("App updates require the app layout");
  }
  return update;
}
