import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge has to know the theme's own names (src/styles.css): otherwise `text-title` reads
// as a colour and would drop `text-foreground` beside it.
const twMerge = extendTailwindMerge<"type-role">({
  // Size tokens set no line height here, so a size never replaces a `leading-*` beside it.
  override: { conflictingClassGroups: { "font-size": [] } },
  extend: {
    theme: {
      text: [
        "2xs",
        "title",
        "15",
        "18",
        "19",
        "24",
        "28",
        "32",
        "34",
        "38",
        "40",
        "46",
        "56",
        "60",
        "80",
        "96",
        "gloss",
        "gloss-entry",
        "gloss-card",
        "sentence",
        "score",
        "timer",
        "verdict",
        "verdict-long",
        "glyph-ghost",
      ],
      spacing: [
        "pair",
        "tight",
        "item",
        "group",
        "section",
        "page",
        "gutter",
        "page-top",
        "glyph",
        "glyph-box",
        "tone",
        "tone-h",
        "safe-top",
        "safe-header",
        "safe-tabbar",
        "safe-toast",
      ],
      radius: ["hairline", "chip", "nav", "card"],
      leading: ["score", "glyph", "display", "heading", "wrap", "body"],
    },
    classGroups: {
      "type-role": [
        {
          type: [
            "title",
            "display",
            "heading",
            "body",
            "action",
            "control",
            "label",
            "micro",
            "pinyin",
            "code",
          ],
        },
      ],
    },
  },
});

/** Joins class names; a later utility replaces an earlier one for the same property. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
