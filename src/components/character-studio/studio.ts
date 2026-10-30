// The lesson frame character and word lessons share: header, the thing to learn, its clues and
// the action row. Phones stack them; from `studio` up the prompt sits beside the clues.
import { cn } from "../../lib/utils";
import { action } from "../ui/buttons";
import { altText, meaningText } from "../ui/hanzi";

/**
 * The lesson grid. `glyph` sizes the prompt's row to the character on phones; leaving fades
 * everything but the actions while the lesson saves.
 */
export function studio(glyph: boolean) {
  return cn(
    "glyph-max-glyph relative mx-auto box-border grid size-full max-w-frame grid-cols-1 gap-2 px-gutter pt-page-top pb-6",
    glyph ? "grid-rows-studio-glyph" : "grid-rows-studio",
    "studio:grid-cols-studio studio:grid-rows-studio-wide studio:gap-x-12 studio:gap-y-4 studio:*:first:col-span-2",
    "*:transition-opacity *:duration-160 data-leaving:*:not-data-actions:opacity-35"
  );
}

/** Where the prompt sits: beside the clues on wide screens, all their height. */
export const studioRead =
  "min-h-0 studio:col-start-1 studio:row-start-2 studio:row-end-5";
// On phones the frame's gap is tight, so the clues' head takes more above it than below.
export const studioClues =
  "relative grid min-w-0 gap-2 max-studio:mt-4 studio:col-start-2 studio:row-start-3";

/** Learn, review and read end in the same action row: as wide as review's column, centred. */
export const studioActions =
  "flex w-full gap-2 self-end justify-self-center studio:col-span-2 studio:row-start-5 studio:max-w-deck";
export const studioAction = cn(action, "min-w-0 flex-1");

/** The meaning, other meanings and pinyin, sized for the lesson; a short phone drops the others. */
export const studioMeaning = cn(meaningText, "studio:text-3xl text-3xl");
export const studioAlt = cn(
  altText,
  "max-studio:short:hidden max-studio:h-auto max-studio:max-h-8 max-studio:whitespace-normal"
);
export const studioPinyin = "text-2xl studio:text-3xl";
