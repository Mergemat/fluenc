# 004 — Merge `--ease-card` into `--ease-out`

- **Status**: DONE
- **Commit**: cb31f35
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, ~8 lines

## Problem

Two easing tokens are practically the same curve under different names:

```css
/* src/styles.css:278 — current */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
/* src/styles.css:281-282 — current */
  /* No overshoot: a flip that swings past its face and back warps the character in perspective. */
  --ease-card: cubic-bezier(0.22, 1, 0.36, 1);
```

Neither curve overshoots: every y control point is ≤ 1. The difference is invisible at 180-280ms.
`--ease-card` is used in only two places:

```css
/* src/styles.css:297 — current */
  --animate-deal: deal 180ms var(--ease-card) backwards;
```

```css
/* src/styles.css:701-708 — current */
/* A deck card: the flip turns `transform`; rising off the pile moves `translate` and `rotate`,
   faster. */
@utility transition-card {
  transition:
    transform 280ms var(--ease-card),
    translate 180ms var(--ease-card),
    rotate 180ms var(--ease-card);
}
```

No TSX file uses the `ease-card` utility class. Confirm with
`grep -rn "ease-card" src` before editing: the only hits should be `src/styles.css`.

## Target

One curve, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. Its "no overshoot" reason moves next to
the flip it protects.

```css
/* src/styles.css — target, the two --ease-card lines (281-282) deleted */
  --animate-deal: deal 180ms var(--ease-out) backwards;
```

```css
/* src/styles.css — target */
/* A deck card: the flip turns `transform`; rising off the pile moves `translate` and `rotate`,
   faster. No overshoot: a flip that swings past its face and back warps the character in
   perspective. */
@utility transition-card {
  transition:
    transform 280ms var(--ease-out),
    translate 180ms var(--ease-out),
    rotate 180ms var(--ease-out);
}
```

## Repo conventions to follow

- Easing tokens live in the motion section of the `@theme` block, `src/styles.css:274-304`.
- `--ease-out` is already the default UI curve, e.g. `--animate-enter: enter 160ms var(--ease-out);`
  (`src/styles.css:290`).

## Steps

1. Run `grep -rn "ease-card" src`. If anything outside `src/styles.css` matches, STOP and report.
2. In `src/styles.css`, delete line 281 (the "No overshoot" comment) and line 282
   (`--ease-card: …`).
3. In `--animate-deal`, replace `var(--ease-card)` with `var(--ease-out)`.
4. In `@utility transition-card`, replace all three `var(--ease-card)` with `var(--ease-out)`, and
   extend its comment with the "No overshoot…" sentence, as in the target.
5. Run `grep -rn "ease-card" src`. Expect no matches.
6. Run `bun run fix`.

## Boundaries

- Do NOT touch `--ease-throw`, `--ease-settle`, `--ease-in`, `--ease-in-out` or any duration.
  `--ease-throw`'s comment ("Softer than the card's own ease out") still reads correctly, so leave
  it alone.
- Do NOT edit anything under `plans/` or `docs/`.
- If a quoted line doesn't match (drift since cb31f35), STOP and report.

## Verification

- **Mechanical**: `bun run check && bun run typecheck && bun test && bun run build` pass, and
  `grep -rn "ease-card" src` prints nothing.
- **Feel check**: `bun run dev`. In review, flip a card and grade it. The flip, the next card
  rising and the hover lift look the same as before. At 10% in DevTools Animations, the flip
  never swings past flat.
- **Done when**: `--ease-card` no longer exists, and the deck moves exactly as before.
