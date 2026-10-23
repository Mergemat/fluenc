import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { onProgressChange, readLearner } from "./progress";
import { learnerQueryOptions } from "./queries";
import {
  getSyncStatus,
  onSyncedSnapshot,
  refreshSyncStatus,
  syncNow,
} from "./sync";

// Changes from other devices arrive this often while fluenc is open.
const PULL_INTERVAL = 60_000;
const RETRY_DELAYS = [5000, 15_000, 60_000];

export function useOfflineSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const show = (snapshot: Awaited<ReturnType<typeof readLearner>>) =>
      queryClient.setQueryData(learnerQueryOptions.queryKey, snapshot);
    const stopSynced = onSyncedSnapshot(show);
    // Another tab saved or synced.
    const stopTabs = onProgressChange(() => {
      readLearner().then(show, () => undefined);
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
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        refreshSyncStatus().catch(() => undefined);
        window.clearTimeout(pending);
        if (signedIn()) {
          pending = window.setTimeout(sync, 400);
        }
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
      stopSynced();
      stopTabs();
      unsubscribe();
      window.clearTimeout(retry);
      window.clearTimeout(pending);
      window.clearInterval(pull);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", sync);
    };
  }, [queryClient]);
}
