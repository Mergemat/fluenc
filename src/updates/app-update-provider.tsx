import { useIsMutating } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Workbox } from "workbox-window";

import { AppUpdateToast } from "./app-update-toast";

export type UpdateStatus =
  | "checking"
  | "current"
  | "applying"
  | "error"
  | "unsupported"
  | "development";
interface AppUpdate {
  apply: () => void;
  available: boolean;
  check: () => Promise<void>;
  status: UpdateStatus;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

interface WorkerEvents {
  onActivated: (isUpdate: boolean) => void;
  onRedundant: () => void;
}

/** Listen to the app's service worker and check for a new version whenever the app is in use. */
function watchWorker(worker: Workbox, events: WorkerEvents) {
  const activated = (event: { isUpdate?: boolean }) =>
    events.onActivated(Boolean(event.isUpdate));
  worker.addEventListener("activated", activated);
  worker.addEventListener("redundant", events.onRedundant);
  const checkInBackground = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      worker.update().catch(() => undefined);
    }
  };
  document.addEventListener("visibilitychange", checkInBackground);
  window.addEventListener("online", checkInBackground);
  const interval = window.setInterval(checkInBackground, 60 * 60 * 1000);
  return () => {
    worker.removeEventListener("activated", activated);
    worker.removeEventListener("redundant", events.onRedundant);
    document.removeEventListener("visibilitychange", checkInBackground);
    window.removeEventListener("online", checkInBackground);
    window.clearInterval(interval);
  };
}

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [available, setAvailable] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const workbox = useRef<Workbox | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const register = useRef<() => void>(() => undefined);
  const saving = useIsMutating() > 0;

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
    let unwatch: () => void = () => undefined;
    const events: WorkerEvents = {
      onActivated: (isUpdate) => {
        if (!active) {
          return;
        }
        if (isUpdate) {
          setAvailable(true);
          setToastOpen(true);
        }
        setStatus("current");
      },
      onRedundant: () => {
        if (active) {
          setStatus("error");
        }
      },
    };
    const prepare = async () => {
      const { Workbox: WorkboxClient } = await import("workbox-window");
      if (!active) {
        return;
      }
      const worker = new WorkboxClient("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      workbox.current = worker;
      unwatch = watchWorker(worker, events);
      const result = await worker.register({ immediate: true });
      if (!active) {
        return;
      }
      if (!result) {
        throw new Error("App registration failed");
      }
      registration.current = result;
      // Only an install that replaces a running version is an update; the first one is this version.
      if (!(result.installing && navigator.serviceWorker.controller)) {
        setStatus("current");
      }
    };
    register.current = () => {
      unwatch();
      prepare().catch(() => {
        if (active) {
          setStatus("error");
        }
      });
    };
    register.current();
    return () => {
      active = false;
      unwatch();
      workbox.current = null;
      registration.current = null;
    };
  }, []);

  const check = useCallback(async () => {
    if (available) {
      setToastOpen(true);
      return;
    }
    setStatus("checking");
    if (!(workbox.current && registration.current)) {
      register.current();
      return;
    }
    try {
      await workbox.current.update();
      if (!(registration.current.installing || registration.current.waiting)) {
        setStatus("current");
      }
    } catch {
      setStatus("error");
    }
  }, [available]);
  const apply = useCallback(() => {
    if (saving || !available || status === "applying") {
      return;
    }
    setStatus("applying");
    window.location.reload();
  }, [available, saving, status]);
  const dismiss = useCallback(() => setToastOpen(false), []);
  const update = useMemo(
    () => ({ status, available, check, apply }),
    [status, available, check, apply]
  );

  return (
    <AppUpdateContext.Provider value={update}>
      {children}
      {toastOpen && available ? (
        <AppUpdateToast
          onDismiss={dismiss}
          onRefresh={apply}
          saving={saving}
          updating={status === "applying"}
        />
      ) : null}
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
