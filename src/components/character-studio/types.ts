import type { BuildItem } from "../../lib/learner-views";

export type CharacterItem = Extract<BuildItem, { type: "character" }>;
export type CueKind = "actor" | "set" | "room" | "prop";
export interface Cue {
  code: string;
  count?: number;
  id: string;
  kind: CueKind;
  name: string;
  role: string;
}
