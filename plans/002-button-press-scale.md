# 002 — Give dithered buttons a physical press

- **Status**: DONE
- **Commit**: cb31f35
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 1 line

## Problem

`DitherButton` is used for every action in the app: the four grade buttons, "show answer",
lesson actions and settings tools. On press, its canvas glow brightens
(`setTarget(1.5)` on `pointerdown`, `src/components/dither-kit/button.tsx:202`), but the button
itself doesn't move. The grade buttons get tapped hundreds of times a day, and on a phone a
glow-only press feels like tapping glass.

```tsx
// src/components/dither-kit/button.tsx:229-233 — current
<button
  className={cn(
    "relative isolate overflow-hidden rounded-md px-4 py-2 font-mono text-foreground text-xs transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-40",
    className
  )}
```

## Target

Keep the glow. Add a subtle squeeze while the button is held: `scale: 0.97` on `:active`, eased
with `160ms var(--ease-out)` (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, defined at
`src/styles.css:278`). Disabled buttons don't squeeze.

```tsx
// src/components/dither-kit/button.tsx:231 — target class string
"relative isolate overflow-hidden rounded-md px-4 py-2 font-mono text-foreground text-xs transition-[opacity,scale] duration-160 ease-out active:not-disabled:scale-97 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-40"
```

What the new classes do (Tailwind v4):
- `transition-[opacity,scale]` transitions the existing disabled-opacity change plus the
  standalone `scale` property that `scale-97` sets.
- `duration-160` is 160ms, inside the 100-160ms budget for press feedback.
- `ease-out` resolves to `var(--ease-out)`, the repo's strong curve.
- `active:not-disabled:scale-97` sets `scale: 97% 97%` while pressed.

The release uses the same 160ms ease-out, so it springs back quickly. That's fine, because a
grade button goes invisible as soon as the click lands.

## Repo conventions to follow

- `src/components/dither-kit/button.tsx` is already edited locally. Its hash no longer matches
  `dither-kit.json`, and the last commit (cb31f35) changed it. So editing the kit's default class
  string is the established way, and every recipe in `src/components/ui/buttons.ts` inherits it.
- Exemplar of a duration + `ease-out` pair on a transition:
  `src/components/review-card.tsx:763` (`transition duration-200 ease-out`).

## Steps

1. In `src/components/dither-kit/button.tsx:231`, replace `transition-opacity` with
   `transition-[opacity,scale] duration-160 ease-out active:not-disabled:scale-97`. Leave every
   other class exactly as it is.
2. Run `bun run fix`.

## Boundaries

- Do NOT change the canvas glow logic (`glowToward`, `GLOW_MS`, the pointer listeners).
- Do NOT add `scale` classes to the recipes in `src/components/ui/buttons.ts` or to call sites.
- Do NOT use `transform`/`scale-[…]` arbitrary values, and do NOT go below 0.97.
- If a call site's `className` already sets a `transition-*` or `scale-*` class (none did at
  cb31f35), STOP and report: tailwind-merge would drop the kit default there.

## Verification

- **Mechanical**: `bun run check && bun run typecheck && bun test && bun run build` all pass.
- **Feel check**: `bun run dev`.
  - Review: reveal a card, then press and hold "good". The button shrinks slightly as it
    brightens, and the label stays crisp. Release, and it grades as before.
  - "show answer", lesson "save", and Settings "tool" buttons all squeeze the same way.
  - A disabled button (e.g. lesson save while saving) does not squeeze.
  - In DevTools Animations at 10%, the press reaches 0.97 quickly, with no slow start.
  - On a real iPhone (Safari, installed PWA if possible): tap a grade button quickly. The squeeze
    is visible on a normal tap, not only on a long hold. If `:active` doesn't fire on iOS, report
    it rather than adding JS.
- **Done when**: every `DitherButton` squeezes to 0.97 while held, and nothing else about its
  look changed.
