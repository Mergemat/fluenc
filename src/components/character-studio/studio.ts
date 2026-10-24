// The lesson frame character and word lessons share: header, the thing to learn, its clues and
// the action row. Phones stack them; from `studio` up the prompt sits beside the clues.
import { cn } from "../../lib/utils";
import { action, actionSide } from "../ui/buttons";
import { altText, meaningText } from "../ui/hanzi";

/**
 * The lesson grid. `glyph` sizes the prompt's row to the character on phones; leaving fades
 * everything but the actions while the lesson saves.
 */
export function studio(glyph: boolean) {
  return cn(
    "glyph-max-glyph relative mx-auto box-border grid size-full max-w-frame grid-cols-1 gap-tight px-gutter pt-page-top pb-group",
    glyph ? "grid-rows-studio-glyph" : "grid-rows-studio",
    "studio:grid-cols-studio studio:grid-rows-studio-wide studio:gap-x-section studio:gap-y-item studio:*:first:col-span-2",
    "*:transition-opacity *:duration-160 data-leaving:*:not-data-actions:opacity-35"
  );
}

/** Where the prompt sits: beside the clues on wide screens, all their height. */
export const studioRead =
  "min-h-0 studio:col-start-1 studio:row-start-2 studio:row-end-5";
export const studioClues =
  "relative grid min-w-0 gap-tight studio:col-start-2 studio:row-start-3";

/** Learn, review and read end in the same action row: as wide as review's column, centred. */
export const studioActions =
  "flex w-full max-w-actions gap-tight self-end justify-self-center studio:col-span-2 studio:row-start-5";
export const studioAction = cn(action, "min-w-0 flex-1 max-studio:short:h-11");
export const studioActionSide = cn(actionSide, "max-studio:short:size-11");

/** The meaning, other meanings and pinyin, sized for the lesson; a short phone drops the others. */
export const studioMeaning = cn(meaningText, "studio:text-32 text-28");
export const studioAlt = cn(
  altText,
  "max-studio:short:hidden max-studio:h-auto max-studio:max-h-7.5 max-studio:whitespace-normal"
);
export const studioPinyin = "text-24 studio:text-3xl";
