// How a lesson ends, the same for a character and a word: one button that names what is still
// missing, then a toast once the item has joined reviews.
import { toast } from "sonner";

/** The finish button's words: saving, what still has to be done, or adding to reviews. */
export function finishLabel(
  saving: boolean,
  failed: boolean,
  missing: string | null
) {
  if (saving) {
    return "saving";
  }
  if (missing) {
    return missing;
  }
  return failed ? "could not save — try again" : "add to reviews";
}

/** Tell the learner the lesson's item is now in reviews. */
export function toastAdded(hanzi: string) {
  toast(
    <>
      <b className="font-hanzi">{hanzi}</b>
      <span>added to reviews</span>
    </>
  );
}
