// Saves still being written on this device. A reload waits for them, and each finished save tells
// sync there is something to send.
const running = new Set<Promise<unknown>>();
const savedListeners = new Set<() => void>();

/** Follow a save until it is written or has failed. */
export function trackSave<T>(save: Promise<T>): Promise<T> {
  running.add(save);
  save.then(
    () => {
      for (const listener of savedListeners) {
        listener();
      }
    },
    () => undefined
  );
  save
    .finally(() => {
      running.delete(save);
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
