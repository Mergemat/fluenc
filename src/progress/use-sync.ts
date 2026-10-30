import { useEffect } from "react";

import { onOtherTab } from "./collections";
import { onSaved } from "./saves";
import { getSyncStatus, refreshSyncStatus, syncNow } from "./sync";

// Changes from other devices arrive this often while fluenc is open. Each pull is a server call;
// coming back to fluenc and every save sync straight away, so this only covers a screen left open.
const PULL_INTERVAL = 5 * 60_000;
const RETRY_DELAYS = [5000, 15_000, 60_000];

export function useSync() {
  useEffect(() => {
    // Another tab saved or synced.
    const stopTabs = onOtherTab(() => {
      refreshSyncStatus().catch(() => undefined);
    });

    let failures = 0;
    let retry: number | undefined;
    const sync = () => {
      window.clearTimeout(retry);
      syncNow()
        .then(() => {
          const { phase } = getSyncStatus();
          failures = phase === "error" ? failures + 1 : 0;
          if (failures) {
            retry = window.setTimeout(
              sync,
              RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length) - 1]
            );
          }
        })
        .catch(() => undefined);
    };
    // Only an account has somewhere to send progress.
    const signedIn = () => getSyncStatus().signedIn !== false;

    // Several saves in a row go out together, shortly after the last.
    let pending: number | undefined;
    const stopSaved = onSaved(() => {
      refreshSyncStatus().catch(() => undefined);
      window.clearTimeout(pending);
      if (signedIn()) {
        pending = window.setTimeout(sync, 400);
      }
    });
    const pull = window.setInterval(() => {
      if (document.visibilityState === "visible" && signedIn()) {
        sync();
      }
    }, PULL_INTERVAL);
    // Coming back to fluenc also finds a sign-in made in another tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", sync);
    refreshSyncStatus().then(sync, sync);

    return () => {
      stopTabs();
      stopSaved();
      window.clearTimeout(retry);
      window.clearTimeout(pending);
      window.clearInterval(pull);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", sync);
    };
  }, []);
}
