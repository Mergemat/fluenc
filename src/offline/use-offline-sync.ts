import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  flushProgress,
  getCachedLearner,
  hasPendingProgress,
  persistLearner,
} from "./progress";
import { learnerQueryOptions } from "./queries";

export function useOfflineSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const restoreLocal = !navigator.onLine || (await hasPendingProgress());
      if (restoreLocal) {
        const cached = await getCachedLearner();
        if (active && cached) {
          queryClient.setQueryData(learnerQueryOptions.queryKey, cached);
        }
      } else {
        // State rendered on the server is not on this device yet.
        const learner = queryClient.getQueryData(learnerQueryOptions.queryKey);
        if (learner) {
          await persistLearner(learner);
        }
      }
    };
    initialize().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const synced = await flushProgress();
      if (!(active && synced) || (await hasPendingProgress())) {
        return;
      }
      await queryClient.invalidateQueries(learnerQueryOptions);
    };
    const runSync = () => {
      sync().catch(() => undefined);
    };
    // Sync shortly after the last of several rapid saves, and retry on a timer regardless of
    // whether a save's button has finished.
    let timer = window.setTimeout(runSync, 400);
    const scheduleSync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(runSync, 400);
    };
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        scheduleSync();
      }
    });
    const retry = window.setInterval(runSync, 30_000);
    window.addEventListener("online", runSync);
    return () => {
      active = false;
      unsubscribe();
      window.clearTimeout(timer);
      window.clearInterval(retry);
      window.removeEventListener("online", runSync);
    };
  }, [queryClient]);
}
