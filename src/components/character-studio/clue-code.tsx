import { ToneContour } from "../ui/hanzi";
import type { Cue } from "./types";

/** A clue's code as shown: actor and set codes as text, the tone room as its pitch contour. */
export function ClueCode({
  clue,
  toneClassName,
}: {
  clue: Pick<Cue, "kind" | "code">;
  /** Sizes the tone contour where the code is set larger or smaller than its text. */
  toneClassName?: string;
}) {
  if (clue.kind === "actor") {
    return clue.code === "ø" ? "ø" : `${clue.code}-`;
  }
  if (clue.kind === "set") {
    return clue.code === "ø" ? "-ø" : `-${clue.code}`;
  }
  if (clue.kind === "room") {
    return <ToneContour className={toneClassName} tone={Number(clue.code)} />;
  }
  return clue.code;
}
