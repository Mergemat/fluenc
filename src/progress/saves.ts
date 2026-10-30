// Saves still being written on this device. A reload waits for them, and each finished save tells
// sync there is something to send.
import { useSyncExternalStore } from "react";

const running = new Set<Promise<unknown>>();
const changeListeners = new Set<() => void>();
const savedListeners = new Set<() => void>();

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) {
    listener();
  }
}

/** Follow a save until it is written or has failed. */
export function trackSave<T>(save: Promise<T>): Promise<T> {
  running.add(save);
  notify(changeListeners);
  save.then(
    () => notify(savedListeners),
    () => undefined
  );
  save
    .finally(() => {
      running.delete(save);
      notify(changeListeners);
    })
    .catch(() => undefined);
  return save;
}

/** Resolves once every save started so far, and any started meanwhile, has settled. */
export async function whenSaved() {
  while (running.size) {
    // biome-ignore lint/performance/noAwaitInLoops: saves started while waiting are waited for too.
    await Promise.allSettled([...running]);
  }
}

/** Hear about each save that was written. */
export function onSaved(listener: () => void) {
  savedListeners.add(listener);
  return () => {
    savedListeners.delete(listener);
  };
}

const subscribe = (listener: () => void) => {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
};
const isSaving = () => running.size > 0;

export function useSaving() {
  return useSyncExternalStore(subscribe, isSaving, () => false);
}
