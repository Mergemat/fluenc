# 001 — Keep fades under Reduce Motion, drop only movement

- **Status**: DONE
- **Commit**: cb31f35
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, ~25 lines

## Problem

With the OS "Reduce Motion" setting on, the app stops every transition and animation, including
ones that only change opacity or colour. The card's answer, the words popover, the write dialog,
the pinyin reveal and the lesson dim all snap in instantly. Reduced motion should mean "nothing
slides, scales or turns". It should not mean "no feedback".

```css
/* src/styles.css:641-658 — current */
@media (prefers-reduced-motion: reduce) {
  /* Blinks, pulses and fills move nothing, and stopped, a loader no longer says it's loading. */
  *:not(
    .animate-pixel,
    .animate-pulse,
    .animate-pulse-fast,
    .animate-reel,
    .animate-writing-hint,
    .animate-writing-start
  ),
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

The card's answer side also opts out by hand, even though `animate-answer` is only a fade
(`fade-in 150ms var(--ease-out) both`, keyframe `from { opacity: 0 }`):

```ts
// src/components/ui/deck.tsx:45-46 — current
export const cardAnswer =
  "absolute inset-0 flex flex-col animate-answer @container-size motion-reduce:animate-none";
```

## Target

Under reduce:
- **Transitions** still run for colour, opacity and shadows. Movement properties
  (`transform`, `translate`, `scale`, `rotate`) are left out of the list, so they jump straight to
  their end value.
- **Animations** that move get opacity-only versions by overriding their theme tokens. Opacity-only
  animations (pulse, pixel, writing hint/start, answer, fade-in/out) run as they are. The reel
  (a clip-path fill) also runs.
- The speaker equaliser (`eq`, a `scaleY` loop) stops.

```css
/* src/styles.css — target, replacing lines 641-658 */
@media (prefers-reduced-motion: reduce) {
  /* Nothing slides, scales or turns: those properties jump to their end. Fades, colour and glow
     still ease, so a change is still seen happening. */
  :root {
    --animate-enter: var(--animate-fade-in);
    --animate-rise: fade-in 300ms var(--ease-out) both;
    --animate-eq: none;
  }
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-property:
      color, background-color, border-color, outline-color, text-decoration-color, fill, stroke,
      opacity, box-shadow, text-shadow !important;
  }
}
```

```ts
// src/components/ui/deck.tsx:45-46 — target
export const cardAnswer =
  "absolute inset-0 flex flex-col animate-answer @container-size";
```

Why this works:
- Tailwind v4 compiles `animate-enter` to `animation: var(--animate-enter)`. The `--animate-*`
  values live in the `@theme` block at `src/styles.css:54`, which Tailwind emits inside
  `@layer theme`. An unlayered `:root` override beats layered rules, so the override wins without
  `!important`.
- The deck card keeps `motion-reduce:animate-none` (`src/components/ui/deck.tsx:219`), so deal and
  throw still don't run. A thrown card now stays in place while its faces fade out over 300ms. The
  result is a crossfade from the old card to the new one. `THROWN_FALLBACK_MS`
  (`src/components/review-card.tsx:393`) still clears the thrown card.

## Repo conventions to follow

- Motion tokens live in the `@theme` block of `src/styles.css`, lines 274-304
  (`--animate-*`, `--ease-*`). Reuse them; don't add new ones.
- Comments say *why*, in plain sentences, as in the existing reduce block's comment. Don't
  narrate the steps.
- Exemplar of a fade-only token: `--animate-fade-in: fade-in 160ms var(--ease-out);`
  (`src/styles.css:291`).

## Steps

1. In `src/styles.css`, replace the whole `@media (prefers-reduced-motion: reduce) { … }` block
   (lines 641-658) with the target block above, verbatim. The `*:not(…)` exemption list goes
   away. Animations are no longer shortened, so pulses, pixels, writing hints and the reel keep
   running without being listed.
2. In `src/components/ui/deck.tsx:46`, delete ` motion-reduce:animate-none` from `cardAnswer`.
   Change nothing else in that string.
3. Run `bun run fix` (Biome via ultracite). Biome may reformat the `transition-property` list,
   which is fine. Read the diff afterwards and make sure no other `@theme` block moved (see the
   note about `--x-*: initial` resets in the first `@theme` block at `src/styles.css:39-52`).

## Boundaries

- Do NOT remove `motion-reduce:animate-none motion-reduce:transition-none` from the deck card
  (`src/components/ui/deck.tsx:219`) or `motion-reduce:transition-none` from
  `src/components/reading-lesson.tsx:192`. They stay as documentation, even though the global
  rule now overrides the transition part.
- Do NOT change `pixelPrefersReducedMotion` or any JS in `src/components/dither-kit/`.
- Do NOT add new keyframes or tokens.
- Do NOT touch the non-reduced (normal) motion values.
- If plan 004 already landed, `src/styles.css` line numbers are 2 lower. Match the quoted code by
  content. If the code itself doesn't match (drift since cb31f35), STOP and report.

## Verification

- **Mechanical**: `bun run check && bun run typecheck && bun test && bun run build` all pass.
- **Feel check**: `bun run dev`. In Chrome DevTools, open Rendering and set "Emulate CSS media
  feature prefers-reduced-motion" to `reduce`. Then:
  - Review: press space. The card doesn't turn; the answer **fades** in, with no snap. Grade it.
    The card doesn't fly away; it fades out over the next card.
  - Lesson: open "words". The popover fades in with no scale. Inspect it: computed
    `animation-name` is `fade-in`.
  - Open the write dialog. It fades with no scale, and the backdrop fades.
  - Word card reveal: pinyin and meaning fade in place, with no 6px slide.
  - The welcome page panel fades without rising. The highlighted sound glows but doesn't lift.
  - The pixel loader still blinks and skeletons still pulse. The speaker bars are still while
    speaking.
  - Switch emulation back to `no-preference`. All motion is exactly as before: popover scales
    from 97%, card flips, throw flies.
- **Done when**: with reduce emulated, no element changes position or size over time, and every
  fade listed above is visible at 10% playback in the DevTools Animations panel.
