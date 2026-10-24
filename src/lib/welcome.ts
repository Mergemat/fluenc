// The welcome reel plays once, for someone who hasn't introduced anything yet. Whether it has
// been seen is kept on the device: a learner with synced progress never needs it anyway.
import type { LearnerState } from "./learner-state";

const SEEN_KEY = "fluenc-welcome-seen";

/** Show the reel to a learner with nothing introduced who hasn't watched or skipped it. */
export function needsWelcome(
  state: Pick<LearnerState, "cards">,
  seen: boolean
) {
  return !seen && Object.keys(state.cards).length === 0;
}

export function welcomeSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage blocked: never trap the learner in the reel.
    return true;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the reel may show again, which is harmless.
  }
}
