// Sends queued progress and brings back what changed on the server, in one request. Runs in the
// background; the learner only hears about it when something needs them.
import { useSyncExternalStore } from "react";

import type { Learner, SyncResponse } from "../server/sync.contract";
import { MAX_SYNC_OPERATIONS } from "../server/sync.limits";
import { announce, publish } from "./collections";
import { whenSaved } from "./saves";
import {
  acceptSync,
  clearProgress,
  countPending,
  readLearnerAccount,
  readOutgoing,
  type Saved,
} from "./store";

export type SyncPhase = "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  /** The account this device's progress belongs to. */
  learner: Learner | null;
  pending: number;
  phase: SyncPhase;
  /** Whether the server knows who this is: null until it has been asked. */
  signedIn: boolean | null;
  syncedAt: number | null;
}

let status: SyncStatus = {
  learner: null,
  pending: 0,
  phase: "idle",
  signedIn: null,
  syncedAt: null,
};
const statusListeners = new Set<() => void>();

const sameLearner = (left: Learner | null, right: Learner | null) =>
  left === right || (left?.id === right?.id && left?.email === right?.email);

/** Change the status, telling readers only when something they show changed. */
function setStatus(next: Partial<SyncStatus>) {
  const changed = (Object.keys(next) as (keyof SyncStatus)[]).some((field) =>
    field === "learner"
      ? !sameLearner(status.learner, next.learner ?? null)
      : status[field] !== next[field]
  );
  if (!changed) {
    return;
  }
  status = { ...status, ...next };
  for (const listener of statusListeners) {
    listener();
  }
}

const subscribe = (listener: () => void) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};
const serverStatus = () => status;

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, serverStatus, serverStatus);
}

export const getSyncStatus = () => status;

/** Show what sync wrote, here and in other tabs. Nothing after the write may fail the sync. */
function show(saved: Saved) {
  try {
    publish(saved);
    announce(saved);
  } catch (error) {
    console.error(error);
  }
}

/** Forget this device's progress once the saves under way are written, so none lands after. */
async function clearDevice() {
  await whenSaved();
  show(await clearProgress());
}

/** Bring the status up to date with what is stored, without asking the server. */
export async function refreshSyncStatus() {
  const [pending, learner] = await Promise.all([
    countPending(),
    readLearnerAccount(),
  ]);
  setStatus({ pending, learner });
}

class SyncError extends Error {
  readonly status: number;
  constructor(statusCode: number) {
    super(`Sync failed with status ${statusCode}`);
    this.status = statusCode;
  }
}

async function exchange() {
  const outgoing = await readOutgoing(MAX_SYNC_OPERATIONS);
  const response = await fetch("/api/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cursor: outgoing.cursor,
      learner: outgoing.learner?.id ?? null,
      operations: outgoing.operations,
    }),
  });
  if (!response.ok) {
    throw new SyncError(response.status);
  }
  show(await acceptSync((await response.json()) as SyncResponse));
  // A full batch may have left more behind.
  return outgoing.operations.length === MAX_SYNC_OPERATIONS;
}

async function run(): Promise<boolean> {
  if (!navigator.onLine) {
    await refreshSyncStatus();
    setStatus({ phase: "offline" });
    return false;
  }
  setStatus({ phase: "syncing" });
  try {
    // biome-ignore lint/performance/noAwaitInLoops: each batch goes out after the last is stored.
    while (await exchange()) {
      // Keep sending until the queue fits in one request.
    }
    await refreshSyncStatus();
    setStatus({ phase: "idle", signedIn: true, syncedAt: Date.now() });
    return true;
  } catch (error) {
    await refreshSyncStatus();
    if (error instanceof SyncError && error.status === 401) {
      // Progress stays here; it is sent once the learner signs in.
      setStatus({ phase: "idle", signedIn: false });
      return false;
    }
    if (error instanceof SyncError && error.status === 409) {
      // The device holds another account's progress; this account starts from its own.
      await clearDevice();
      return run();
    }
    setStatus({ phase: navigator.onLine ? "error" : "offline" });
    return false;
  }
}

let active: Promise<boolean> | null = null;
let again = false;

/**
 * Sync now, or straight after the sync already running, so a save made during one is not left
 * waiting. Resolves true when everything was sent and the device is up to date.
 */
export function syncNow(): Promise<boolean> {
  if (active) {
    again = true;
    return active;
  }
  active = run().finally(() => {
    active = null;
    if (again) {
      again = false;
      syncNow().catch(() => undefined);
    }
  });
  return active;
}

/** Forget the device's progress, such as on sign-out. */
export async function forgetDevice() {
  await clearDevice();
  setStatus({
    learner: null,
    pending: 0,
    signedIn: false,
    syncedAt: null,
    phase: "idle",
  });
}

export type SyncAttention = "signed-out" | "error" | "waiting";

/** What the learner should know about sync, if anything. Progress only on this device needs nothing. */
export function syncAttention(current: SyncStatus): SyncAttention | null {
  if (!current.learner) {
    return null;
  }
  if (current.signedIn === false) {
    return "signed-out";
  }
  if (current.phase === "error") {
    return "error";
  }
  return current.phase === "offline" && current.pending ? "waiting" : null;
}
