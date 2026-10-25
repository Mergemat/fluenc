# 003 — Let the review "done" slot arrive instead of blinking on

- **Status**: DONE
- **Commit**: cb31f35
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 3 files, ~15 lines

## Problem

When the last review card is thrown, `ReviewDeck` swaps its deck for the `done` screen: a dashed
empty slot reading "done · next · tomorrow", or a face-down slot with a timer if learning cards are
coming back. The swap is instant, so the day's one moment of finishing just blinks on.

```tsx
// src/components/review-card.tsx:539-545 — current
export function ReviewDeck({
  queue: due,
  done,
}: {
  queue: ReviewItem[];
  done: ReactNode;
}) {
```

```tsx
// src/components/review-card.tsx:625-628 — current
  const saving = queue.length < due.length;
  if (!(active || saving || leaving.length)) {
    return done;
  }
```

```tsx
// src/components/review-view.tsx:45-58 — current
    <section className={deckPage}>
      <ReviewDeck
        done={
          <ReviewDone
            coming={learning.length}
            data={data}
            nextLearningAt={nextLearningAt}
            state={state}
          />
        }
        queue={data.reviewQueue}
      />
    </section>
```

```tsx
// src/components/ui/deck.tsx:263-285 — current
/** A card lying on the table without a flip: face down with a timer, or the empty place. */
export function DeckSlot({
  state,
  children,
}: {
  state: "down" | "empty";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        face,
        "gap-2",
        state === "down"
          ? "bg-card before:pointer-events-none before:absolute before:inset-3 before:rounded-xl before:border before:border-foreground/8"
          : "border-border-strong border-dashed bg-transparent shadow-none"
      )}
    >
```

## Target

- After a deck has been worked through **in this visit**, the slot settles in with the existing
  `animate-enter` (`enter 160ms var(--ease-out)`: from `opacity: 0; scale: 0.97`). The "done" word
  also rises with the existing `animate-rise` (`rise 300ms var(--ease-out) both`: from
  `opacity: 0; transform: translateY(8px)`).
- Opening the review tab when nothing is due shows the slot **still**, with no animation. Tab
  switches stay instant.
- Both tokens already exist in `src/styles.css:290` and `:304`. Don't add new ones. (These values
  differ slightly from the audit mockup on purpose, so they reuse existing tokens.)

```tsx
// src/components/review-card.tsx — target signature and return
export function ReviewDeck({
  queue: due,
  done,
}: {
  queue: ReviewItem[];
  /** Told whether this visit worked a deck to its end, so only that arrives with motion. */
  done: (arrived: boolean) => ReactNode;
}) {
  // …existing code down to and including the `active` lookup and its setSelected block…

  // Opening review with nothing due shows its end still; finishing a deck here lets it arrive.
  const [worked, setWorked] = useState(() => due.length > 0);
  if (active && !worked) {
    setWorked(true);
  }

  // …existing code…
  if (!(active || saving || leaving.length)) {
    return done(worked);
  }
```

```tsx
// src/components/review-view.tsx — target call
      <ReviewDeck
        done={(arrived) => (
          <ReviewDone
            arrived={arrived}
            coming={learning.length}
            data={data}
            nextLearningAt={nextLearningAt}
            state={state}
          />
        )}
        queue={data.reviewQueue}
      />
```

```tsx
// src/components/ui/deck.tsx — target DeckSlot
/** A card lying on the table without a flip: face down with a timer, or the empty place. */
export function DeckSlot({
  state,
  arrive = false,
  children,
}: {
  state: "down" | "empty";
  /** Settles onto the table, as the last card of a deck leaves. */
  arrive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        face,
        "gap-2",
        state === "down"
          ? "bg-card before:pointer-events-none before:absolute before:inset-3 before:rounded-xl before:border before:border-foreground/8"
          : "border-border-strong border-dashed bg-transparent shadow-none",
        arrive && "animate-enter"
      )}
    >
```

In `ReviewDone` (`src/components/review-view.tsx:67-193`):
- Add `arrived: boolean` to its props (destructure it and add it to the props type).
- Pass `arrive={arrived}` to both `<DeckSlot state="down">` (line 117) and
  `<DeckSlot state="empty">` (line 154).
- Change the verdict at line 157 from `<b className={verdict}>done</b>` to
  `<b className={cn(verdict, arrived && "animate-rise")}>done</b>`. `cn` is already imported
  there.

## Repo conventions to follow

- Render-phase state sync (`if (x !== y) setY(x)`) is already the pattern in `ReviewDeck`, e.g.
  `setSelected(active)` at `src/components/review-card.tsx:560-566` and `setShown` just below it.
  Use the same shape for `worked`.
- Optional boolean props default in the destructure, like `wide = false` on `DeckPile`
  (`src/components/ui/deck.tsx:153`) and `ghost = false` on `DeckCard`.
- Comments say why, in plain sentences.

## Steps

1. `src/components/ui/deck.tsx`: add the `arrive` prop to `DeckSlot` exactly as in the target.
2. `src/components/review-card.tsx`: change `done`'s type to `(arrived: boolean) => ReactNode` with
   the JSDoc line shown. Add the `worked` state and its sync right after the existing
   `if (active?.type !== selected?.type || …) { setSelected(active); }` block. Change
   `return done;` to `return done(worked);`.
3. `src/components/review-view.tsx`: pass `done` as the arrow function shown. Add `arrived` to
   `ReviewDone`'s props, pass `arrive={arrived}` to both `DeckSlot`s, and add `animate-rise` to the
   "done" verdict as described.
4. Run `bun run fix`.

## Boundaries

- Do NOT add keyframes, tokens or animation delays.
- Do NOT animate the "start with a lesson" text, the footer button, or the page header.
- Do NOT change when `done` is shown (the `active || saving || leaving.length` condition).
- Do NOT touch the throw, deal or flip.
- This is a visual change: no unit test. Capture before/after instead (see below).
- If the quoted code doesn't match (drift since cb31f35), STOP and report.

## Verification

- **Mechanical**: `bun run check && bun run typecheck && bun test && bun run build` pass.
  `bun run doctor` reports nothing new. If it flags the inline `done` arrow, wrap it in
  `useCallback` in `ReviewView` with deps `[learning.length, data, nextLearningAt, state]` and
  call the hook before the `return`.
- **Feel check**: `bun run dev` with a few cards due.
  - Grade the last card. As it flies off, the dashed slot settles in from 97% and "done" rises
    about 8px. Nothing jumps or flashes at full opacity first.
  - Switch to another tab and back to review. The done slot is there **without** animating.
  - Reload `/review` with nothing due. The slot appears still.
  - If learning cards are coming back, finishing shows the face-down timer slot settling in the
    same way.
  - In DevTools Animations at 10%, the slot's `enter` and the verdict's `rise` start together
    once the thrown card's animation ends.
  - With `prefers-reduced-motion: reduce` emulated (and plan 001 applied), both are plain fades.
- **Before/after capture**: record the last-card throw on a phone viewport (390×844) before and
  after the change, and attach both to the PR.
- **Done when**: finishing a deck shows the slot arriving, and opening review when already done
  shows it still.
