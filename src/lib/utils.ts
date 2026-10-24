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
        "gloss",
        "gloss-entry",
        "word-card",
        "sentence",
        "score",
        "timer",
        "verdict",
        "verdict-long",
        "glyph-ghost",
      ],
      spacing: [
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
      leading: ["wrap", "body"],
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
