import { directCharacters } from "../../lib/character-props";
import { propMeaning } from "../../lib/props";
import { getToneDetail } from "../../lib/tones";
import { characterCues } from "./cues";
import type { CharacterItem, Cue } from "./types";

export type Clue = Cue & {
  status: "new" | "known";
  meaning: string | null;
  partIndex: number;
};

export const cueKey = (cue: Pick<Cue, "kind" | "code">) =>
  `${cue.kind}:${cue.code}`;

/** What an empty slot asks for, in movie-method terms. */
export function cluePrompt(clue: Clue) {
  if (clue.kind === "actor") {
    return `pick a ${clue.role.toLowerCase()}`;
  }
  if (clue.kind === "set") {
    return clue.code === "ø" ? "your childhood home" : "a place you know well";
  }
  return clue.kind === "room" ? "an area in that place" : "an object";
}

/** The clue's role as shown beside its code: a prop's meaning, a room's tone, or the role. */
export function clueRole(clue: Clue) {
  if (clue.kind === "prop") {
    return clue.meaning ?? "prop";
  }
  if (clue.kind === "room") {
    return `${getToneDetail(Number(clue.code))?.label.toLowerCase()} tone`;
  }
  return clue.role.toLowerCase();
}

/** Which of the character's parts a prop cue is: its position after the actor, set and room. */
function propIndex(cueIndex: number, direct: boolean) {
  return direct ? 0 : cueIndex - 3;
}

/** Cues with the learner's draft names, whether each is new to them, and what each prop means. */
export function lessonClues(
  item: Pick<CharacterItem, "hanzi" | "movie">,
  drafts: Record<string, string> = {}
): Clue[] {
  const direct = directCharacters.has(item.hanzi);
  return characterCues(item).map((cue, index) => {
    const partIndex = cue.kind === "prop" ? propIndex(index, direct) : -1;
    const component =
      cue.kind === "prop" ? item.movie.components[partIndex] : null;
    const meaning =
      cue.kind === "prop"
        ? (propMeaning(cue.code) ?? component?.character?.keyword ?? null)
        : null;
    return {
      ...cue,
      name: drafts[cueKey(cue)] ?? cue.name,
      status: cue.name.trim() ? "known" : "new",
      meaning,
      partIndex,
    };
  });
}
