// Clue rows, as a lesson and a library entry list them: the code large in its kind's colour, what
// it stands for, and the learner's name for it. Rows sit on the page, split by their own hairlines;
// on phones each is one line. A row's colour is `--k`, which its code, marker and highlight take.
import type { CSSProperties } from "react";

import { cn } from "../../lib/utils";
import { partColor } from "../ui/part-colors";
import type { CueKind } from "./types";

type RowKind = CueKind | "link";

const kindColors: Record<Exclude<RowKind, "prop">, string> = {
  actor: "var(--color-blue)",
  set: "var(--color-purple)",
  room: "var(--color-green)",
  link: "var(--color-blue)",
};

/** A row's `--k`: its kind's colour, or a prop's part colour. */
export function kindStyle(kind: RowKind, partIndex = -1): CSSProperties {
  return {
    "--k": kind === "prop" ? partColor(partIndex) : kindColors[kind],
  } as CSSProperties;
}

interface RowState {
  /** Many props: two to a line, the name under what it stands for. */
  dense?: boolean;
  /** A name typed in place, rather than shown. */
  editable?: boolean;
  /** A hairline under it: not the last row, and neither it nor the next one is highlighted. */
  lined?: boolean;
  /** Lit from outside: the part hovered or picked on the glyph. */
  lit?: boolean;
  /** Still to name (a glowing marker) or newly named (a quiet one). */
  marker?: "empty" | "new" | null;
}

/** A highlighted row is rounded like every other surface, and the lines touching it give way. */
const highlight = "rounded-lg bg-kind/9";

export function clueRow({ lit, lined, dense, editable, marker }: RowState) {
  return cn(
    "group/row relative grid h-14 content-center gap-x-1 pr-3.5 transition-colors",
    "max-studio:items-center max-studio:gap-x-2",
    dense
      ? "inset-shadow-rule-side grid-cols-clue-dense max-studio:h-14 max-studio:grid-cols-clue-dense-phone"
      : "grid-cols-clue max-studio:h-12 max-studio:short:h-11 max-studio:grid-cols-clue-line",
    lined && !dense && "inset-shadow-rule",
    editable && "cursor-text focus-within:rounded-lg focus-within:bg-kind/9",
    lit && highlight,
    marker &&
      "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-xs before:bg-kind",
    // The glow takes the marker's colour: `--k`, set as its text colour.
    marker === "empty" && "before:text-kind before:shadow-glow",
    marker === "new" && "before:opacity-35"
  );
}

/** The code is the clue: large, plain, in its colour; a prop is its component, set in hanzi. */
export function clueCode({
  kind,
  lit,
  dense,
  editable,
}: { kind: RowKind } & Pick<RowState, "lit" | "dense" | "editable">) {
  return cn(
    "type-code col-start-1 row-span-2 self-center justify-self-center whitespace-nowrap text-kind transition-glow duration-160",
    !dense && "max-studio:row-span-1",
    kind === "prop" &&
      cn(
        "font-hanzi-props font-normal",
        dense ? "text-2xl" : "text-3xl max-studio:short:text-2xl"
      ),
    kind === "link" && "grid place-items-center",
    editable && "group-focus-within/row:text-shadow-glow",
    lit && "text-shadow-glow"
  );
}

/** A tone room's contour, at the code's size. */
export const clueTone = "h-5 w-7";

/** A repeated component's count beside its code. */
export const clueCount = "ml-px align-super type-label font-semibold";

/** What the clue stands for; on phones at the line's end. */
export function clueRole(dense?: boolean) {
  return cn(
    "type-label col-start-2 min-w-0 truncate text-muted-foreground leading-3.5",
    dense
      ? "max-studio:row-start-1"
      : "max-studio:col-start-3 max-studio:row-start-1 max-studio:max-w-24 max-studio:text-right"
  );
}

/** The learner's name: an input in a lesson, text on an entry. */
export function clueName({
  empty,
  dense,
  editable,
}: { empty: boolean } & Pick<RowState, "dense" | "editable">) {
  return cn(
    "type-heading col-start-2 h-7 w-full min-w-0 text-foreground",
    dense ? "max-studio:row-start-2 max-studio:h-6" : "max-studio:row-start-1",
    editable
      ? cn(
          "text-ellipsis rounded-none border-transparent border-b bg-transparent p-0 outline-none transition-colors focus-visible:outline-none",
          "placeholder:type-control placeholder:text-kind placeholder:opacity-75",
          empty ? "border-kind/55 border-dashed" : "focus:border-kind"
        )
      : cn(
          "flex items-center truncate",
          empty && "type-control text-faint-foreground"
        )
  );
}
