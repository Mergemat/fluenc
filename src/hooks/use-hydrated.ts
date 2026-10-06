import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** False on the server and while hydrating; true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
