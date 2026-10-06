import { ToneContour } from "../ui/hanzi";
import type { Cue } from "./types";

/** A clue's code as shown: actor and set codes as text, the tone room as its pitch contour. */
export function ClueCode({ clue }: { clue: Pick<Cue, "kind" | "code"> }) {
  if (clue.kind === "actor") {
    return clue.code === "ø" ? "ø" : `${clue.code}-`;
  }
  if (clue.kind === "set") {
    return clue.code === "ø" ? "-ø" : `-${clue.code}`;
  }
  if (clue.kind === "room") {
    return <ToneContour tone={Number(clue.code)} />;
  }
  return clue.code;
}
