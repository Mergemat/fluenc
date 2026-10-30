import { useEffect, useEffectEvent } from "react";

/** Where a key belongs to what has focus rather than to the page: typing, controls, dialogs. */
export const FOCUSED_KEYS = "input, textarea, button, a, [role=dialog]";

/** A key press meant for the page: no modifier held, and not pressed inside `owners`. */
export function isShortcut(event: KeyboardEvent, owners = FOCUSED_KEYS) {
  return !(
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    (event.target instanceof Element && event.target.closest(owners))
  );
}

/** Hear key presses anywhere on the page while `enabled`, with the latest `onKey`. */
export function useWindowKeys(
  onKey: (event: KeyboardEvent) => void,
  enabled = true
) {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enabled]);
}
