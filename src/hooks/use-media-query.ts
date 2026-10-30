import { useCallback, useSyncExternalStore } from "react";

const notOnServer = () => false;

/** Whether a media query matches, kept up to date; false on the server and while hydrating. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  const matches = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, matches, notOnServer);
}
