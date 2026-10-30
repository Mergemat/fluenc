import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useHydrated } from "../hooks/use-hydrated";

import {
  OFFLINE_CACHES,
  OFFLINE_CONTENT_TYPES,
  OFFLINE_FILES_URL,
  type OfflineFile,
  type OfflineFiles,
  type OfflineGroup,
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

// How long a download may go without receiving anything.
const STEP_TIMEOUT = 30_000;
// The longest the download waits for an idle moment, and the wait where browsers can't report one.
const IDLE_TIMEOUT = 5000;
const IDLE_FALLBACK = 2000;

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

/** The listed files not cached yet. */
async function staleFiles(cache: Cache, files: OfflineFile[]) {
  const cached = new Set((await cache.keys()).map((request) => request.url));
  return files.filter(
    (file) => !cached.has(new URL(file.url, location.origin).href)
  );
}

interface DownloadCallbacks {
  isActive: () => boolean;
  onProgress: (progress: DownloadProgress) => void;
}

interface CacheGroup extends OfflineGroup {
  cache: Cache;
  contentType: string;
  stale: OfflineFile[];
}

/** Forget cached files the list no longer has, such as those of a course since changed. */
async function pruneCache(group: CacheGroup) {
  const listed = new Set(
    group.files.map((file) => new URL(file.url, location.origin).href)
  );
  const obsolete = (await group.cache.keys()).filter(
    (request) => !listed.has(request.url)
  );
  await Promise.all(obsolete.map((request) => group.cache.delete(request)));
}

async function readCacheGroups(lists: OfflineFiles) {
  return await Promise.all(
    (Object.keys(OFFLINE_CACHES) as (keyof OfflineFiles)[]).map(
      async (key): Promise<CacheGroup> => {
        const cache = await caches.open(OFFLINE_CACHES[key]);
        return {
          ...lists[key],
          cache,
          contentType: OFFLINE_CONTENT_TYPES[key],
          stale: await staleFiles(cache, lists[key].files),
        };
      }
    )
  );
}

/**
 * Download a group's pack and store each stale file from it as soon as its bytes are in. False if
 * the download was called off.
 */
async function fillFromPack(
  group: CacheGroup,
  isActive: () => boolean,
  onFile: () => void
) {
  const response = await withTimeout(fetch(group.pack));
  if (!(response.ok && response.body)) {
    throw new Error(`Could not download ${group.pack}`);
  }
  const bytes = new Uint8Array(group.size);
  const waiting = group.stale.toSorted((a, b) => a.offset - b.offset);
  const reader = response.body.getReader();
  let received = 0;
  while (isActive()) {
    // biome-ignore lint/performance/noAwaitInLoops: a stream is read one chunk at a time.
    const { done, value } = await withTimeout(reader.read());
    if (done) {
      break;
    }
    bytes.set(value, received);
    received += value.length;
    while (
      isActive() &&
      waiting[0] &&
      waiting[0].offset + waiting[0].length <= received
    ) {
      const file = waiting.shift() as OfflineFile;
      // biome-ignore lint/performance/noAwaitInLoops: one file at a time, so taps get a turn between them.
      await group.cache.put(
        file.url,
        new Response(bytes.slice(file.offset, file.offset + file.length), {
          headers: { "Content-Type": group.contentType },
        })
      );
      onFile();
      // Storing a file takes the main thread a moment; a tap waiting behind hundreds of them would not.
      await yieldToInput();
    }
  }
  if (!isActive()) {
    await reader.cancel();
    return false;
  }
  if (waiting.length) {
    throw new Error(`Could not download ${group.pack}`);
  }
  return true;
}

/** Fill every stale file, then drop what each cache no longer needs once all of its files are in. */
async function fillCaches(groups: CacheGroup[], callbacks: DownloadCallbacks) {
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);
  let completed =
    total - groups.reduce((sum, group) => sum + group.stale.length, 0);
  callbacks.onProgress({ completed, total });
  // Progress shows as a whole percentage, so it is only worth reporting when that changes.
  let shown = Math.floor((completed / total) * 100);
  const onFile = () => {
    completed += 1;
    const percentage = Math.floor((completed / total) * 100);
    if (callbacks.isActive() && percentage !== shown) {
      shown = percentage;
      callbacks.onProgress({ completed, total });
    }
  };
  await Promise.all(
    groups.map(async (group) => {
      if (
        !group.stale.length ||
        (await fillFromPack(group, callbacks.isActive, onFile))
      ) {
        await pruneCache(group);
      }
    })
  );
}

/** Let input that arrived meanwhile be handled first. */
const yieldToInput = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/** Resolves once the page has nothing more pressing to do, such as just after it opens. */
const whenIdle = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT });
    } else {
      setTimeout(resolve, IDLE_FALLBACK);
    }
  });

/** Download everything practice needs offline: "ready" once done, "idle" while waiting to be. */
async function downloadOfflineFiles(
  callbacks: DownloadCallbacks
): Promise<"ready" | "idle"> {
  // Offline practice downloads by itself; without a connection it waits for one.
  if (!navigator.onLine) {
    return "idle";
  }
  // The download is for later; opening the app and the first taps come first.
  await whenIdle();
  if (!callbacks.isActive()) {
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
