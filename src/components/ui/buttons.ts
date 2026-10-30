// Classes for dither-kit's DitherButton (src/components/dither-kit/button.tsx). The kit's own
// defaults come first in its `cn`, so each recipe names whatever it replaces: size, padding, type,
// colour, and the focus ring, which the kit turns off and the app keeps.

/** The one big action on a study screen or a card: label left, key hint right. */
export const action =
  "flex h-12 w-full items-center rounded-lg short:max-studio:h-11 px-5 py-0 type-action text-md text-primary-foreground text-shadow-action focus-visible:outline-solid disabled:cursor-progress disabled:opacity-100 *:first:opacity-70 *:last:flex *:last:w-full *:last:items-center *:last:justify-between *:last:gap-3";

/** A small labelled tool: settings rows, forms, toggles beside content. */
export const tool =
  "h-7 rounded-md px-2.5 py-0 type-control text-sm focus-visible:outline-solid *:last:inline-flex *:last:items-center *:last:gap-2";

/** A key hint inside an action. */
export const actionKey = "rounded-sm border border-current/35 px-1.5 py-px";
