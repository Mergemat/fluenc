// Palette colours for clue parts, shared by canvas fills and CSS so both agree.
import { rgb } from "../dither-kit/palette";
import { fillOf, type PixelColor } from "../dither-kit/pixel";

/** Prop colours: dither-kit palette names, then hues for the parts beyond them. */
const partPalette: PixelColor[] = ["orange", "pink", "red", 52, 96, 172];

export const partPixelColor = (index: number) =>
  partPalette[index % partPalette.length];
export const partColor = (index: number) => rgb(fillOf(partPixelColor(index)));

/** CSS colour for a dither-kit palette entry, so CSS and canvas fills agree. */
export const ditherColor = (color: PixelColor, alpha = 1) =>
  rgb(fillOf(color), 1, alpha);
