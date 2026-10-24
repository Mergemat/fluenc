import type { CSSProperties } from "react";

import {
  actorCategories,
  type ClueKind,
  type PalaceBoard,
} from "../lib/palace-board";
import type { Cue } from "./character-studio/types";
import { partColor } from "./ui/part-colors";

export interface ClueRow {
  characters: number;
  color?: string;
  /** The clue's code, shown with `ClueCode`. */
  cue: Pick<Cue, "kind" | "code">;
  group?: string;
  hint: string | null;
  ids: string[];
  key: string;
  kind: ClueKind;
  name: string;
  started: number;
  text: string;
}

const kindColors: Record<ClueKind, string> = {
  cast: "var(--color-blue)",
  sets: "var(--color-purple)",
  areas: "var(--color-green)",
  props: "var(--color-faint-foreground)",
};

/** Sets `--k` (the `kind` colour) to the clue's colour: its kind's, or a prop's own. */
export function kindStyle(row: Pick<ClueRow, "kind" | "color">) {
  return { "--k": row.color ?? kindColors[row.kind] } as CSSProperties;
}

/** Every clue on the board as a flat row, in the order each tab lists them. */
export function clueRows(board: PalaceBoard): ClueRow[] {
  return [
    ...actorCategories.flatMap((category) =>
      board.actors
        .filter((actor) => actor.category === category.id)
        .map((actor) => ({
          kind: "cast" as const,
          key: actor.key,
          cue: { kind: "actor" as const, code: actor.key },
          text: actor.key,
          name: actor.name,
          hint: null,
          group: category.label,
          characters: actor.characters,
          started: actor.started,
          ids: actor.ids,
        }))
    ),
    ...board.sets.map((set) => ({
      kind: "sets" as const,
      key: set.key,
      cue: { kind: "set" as const, code: set.key },
      text: set.key,
      name: set.name,
      hint: set.key === "ø" ? "childhood home" : null,
      characters: set.characters,
      started: set.started,
      ids: set.ids,
    })),
    ...board.rooms.map((room) => ({
      kind: "areas" as const,
      key: String(room.tone),
      cue: { kind: "room" as const, code: String(room.tone) },
      text: "",
      name: room.name,
      hint: null,
      characters: room.characters,
      started: room.started,
      ids: room.ids,
    })),
    ...board.props.map((prop, index) => ({
      kind: "props" as const,
      key: prop.key,
      cue: { kind: "prop" as const, code: prop.key },
      text: prop.key,
      name: prop.name,
      hint: prop.meaning,
      characters: prop.characters,
      started: prop.started,
      ids: prop.ids,
      color: partColor(index),
    })),
  ];
}
