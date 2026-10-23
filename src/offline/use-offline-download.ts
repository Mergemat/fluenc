import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useHydrated } from "../hooks/use-hydrated";

import {
  OFFLINE_CACHES,
  OFFLINE_FILES_URL,
  type OfflineFile,
  type OfflineFiles,
} from "./files";

export interface DownloadProgress {
  completed: number;
  total: number;
}
export type DownloadStatus =
  | "checking"
  | "idle"
  | "downloading"
  | "ready"
  | "error"
  | "unsupported"
  | "development";

// Each cache keeps the list it was last filled from, so a changed file is fetched again.
const REVISIONS_KEY = "/__revisions";
const PARALLEL = 6;
const STEP_TIMEOUT = 30_000;

const withTimeout = <T>(promise: Promise<T>, ms = STEP_TIMEOUT) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Timed out")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });

async function staleFiles(cache: Cache, files: OfflineFile[]) {
  const stored = await cache.match(REVISIONS_KEY);
  const revisions: Record<string, string> = stored ? await stored.json() : {};
  const cached = new Set((await cache.keys()).map((request) => request.url));
  return files.filter(
    (file) =>
      revisions[file.url] !== file.revision ||
      !cached.has(new URL(file.url, location.origin).href)
  );
}

interface DownloadCallbacks {
  isActive: () => boolean;
  onProgress: (progress: DownloadProgress) => void;
}

interface CacheGroup {
  cache: Cache;
  files: OfflineFile[];
  stale: OfflineFile[];
}

const saveRevisions = (group: CacheGroup) =>
  group.cache.put(
    REVISIONS_KEY,
    Response.json(
      Object.fromEntries(group.files.map((file) => [file.url, file.revision]))
    )
  );

async function readCacheGroups(lists: OfflineFiles) {
  return await Promise.all(
    (Object.keys(OFFLINE_CACHES) as (keyof OfflineFiles)[]).map(
      async (key): Promise<CacheGroup> => {
        const cache = await caches.open(OFFLINE_CACHES[key]);
        return {
          cache,
          files: lists[key],
          stale: await staleFiles(cache, lists[key]),
        };
      }
    )
  );
}

async function fetchInto(cache: Cache, file: OfflineFile) {
  // The worker answers cache-first, so drop an outdated copy before fetching it again.
  await cache.delete(file.url);
  const fetched = await withTimeout(fetch(file.url, { cache: "no-cache" }));
  if (!fetched.ok) {
    throw new Error(`Could not download ${file.url}`);
  }
  await cache.put(file.url, fetched);
}

/** Fill every stale file, recording each cache's file list once all of its files are in. */
async function fillCaches(groups: CacheGroup[], callbacks: DownloadCallbacks) {
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);
  let completed =
    total - groups.reduce((sum, group) => sum + group.stale.length, 0);
  callbacks.onProgress({ completed, total });

  const remaining = new Map(groups.map((group) => [group, group.stale.length]));
  const queue = groups.flatMap((group) =>
    group.stale.map((file) => ({ group, file }))
  );
  await Promise.all(
    groups.filter((group) => !group.stale.length).map(saveRevisions)
  );
  const worker = async (): Promise<void> => {
    const next = queue.shift();
    if (!(next && callbacks.isActive())) {
      return;
    }
    await fetchInto(next.group.cache, next.file);
    completed += 1;
    if (callbacks.isActive()) {
      callbacks.onProgress({ completed, total });
    }
    const left = (remaining.get(next.group) ?? 1) - 1;
    remaining.set(next.group, left);
    if (left === 0 && callbacks.isActive()) {
      await saveRevisions(next.group);
    }
    return worker();
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

/** Download everything practice needs offline: "ready" once done, "idle" while waiting to be. */
async function downloadOfflineFiles(
  callbacks: DownloadCallbacks
): Promise<"ready" | "idle"> {
  // Offline practice downloads by itself; without a connection it waits for one.
  if (!navigator.onLine) {
    return "idle";
  }
  const response = await withTimeout(
    fetch(OFFLINE_FILES_URL, { cache: "no-cache" })
  );
  if (!response.ok) {
    throw new Error("Offline file list unavailable");
  }
  const groups = await readCacheGroups((await response.json()) as OfflineFiles);
  if (!callbacks.isActive()) {
    return "idle";
  }
  await fillCaches(groups, callbacks);

  // The app shell and course install in the service worker; progress comes from the saved learner state.
  await withTimeout(navigator.serviceWorker.ready);
  navigator.storage?.persist?.().catch(() => undefined);
  return "ready";
}

function unavailableStatus(): DownloadStatus | null {
  if (!import.meta.env.PROD) {
    return "development";
  }
  if (!("serviceWorker" in navigator && "caches" in window)) {
    return "unsupported";
  }
  return null;
}

function downloadStatus(
  unavailable: DownloadStatus | null,
  download: Pick<
    UseQueryResult<"ready" | "idle">,
    "data" | "isError" | "isFetching"
  >
): DownloadStatus {
  if (unavailable) {
    return unavailable;
  }
  if (download.isFetching) {
    return "downloading";
  }
  if (download.data) {
    return download.data;
  }
  return download.isError ? "error" : "checking";
}

/**
 * Downloads pinyin audio and stroke data straight into the caches the service worker serves
 * them from. Runs in the page, so progress is exact and doesn't wait on the worker's install.
 */
export function useOfflineDownload() {
  const hydrated = useHydrated();
  const unavailable = hydrated ? unavailableStatus() : null;
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const download = useQuery({
    queryKey: ["offline-download"],
    queryFn: ({ signal }) =>
      downloadOfflineFiles({
        isActive: () => !signal.aborted,
        onProgress: setProgress,
      }),
    enabled: hydrated && !unavailable,
    networkMode: "always",
    retry: false,
    // A finished download stays done; an unfinished one tries again when the device reconnects.
    staleTime: (query) =>
      query.state.data === "ready" ? Number.POSITIVE_INFINITY : 0,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });
  return { status: downloadStatus(unavailable, download), progress };
}

export type OfflineDownload = ReturnType<typeof useOfflineDownload>;
