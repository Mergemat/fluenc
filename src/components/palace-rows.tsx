import type { ReactNode } from "react";

import {
  actorCategories,
  type ClueKind,
  type PalaceBoard,
} from "../lib/palace-board";
import { ToneContour } from "./ui/hanzi";
import { partColor } from "./ui/part-colors";

export interface ClueRow {
  characters: number;
  code: ReactNode;
  color?: string;
  group?: string;
  hint: string | null;
  ids: string[];
  key: string;
  kind: ClueKind;
  name: string;
  started: number;
  text: string;
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
          code: actor.key === "ø" ? "ø" : `${actor.key}-`,
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
      code: set.key === "ø" ? "-ø" : `-${set.key}`,
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
      code: <ToneContour tone={room.tone} />,
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
      code: prop.key,
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
