# Animation plans

From the motion audit at `cb31f35`. The visual walkthrough is `animation-audit.html`.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Keep fades under Reduce Motion, drop only movement](001-reduced-motion-keeps-fades.md) | MEDIUM | DONE |
| 002 | [Give dithered buttons a physical press](002-button-press-scale.md) | LOW | DONE |
| 003 | [Let the review "done" slot arrive](003-review-done-arrives.md) | LOW | DONE |
| 004 | [Merge `--ease-card` into `--ease-out`](004-merge-ease-card-into-ease-out.md) | LOW | DONE |

## Order

1. **004**: two minutes, and it touches the same motion section of `src/styles.css` as 001, so
   doing it first avoids a conflict.
2. **001**: the only accessibility fix.
3. **002**: one line.
4. **003**: its reduced-motion feel check assumes 001 is in.

None of them block each other functionally; they can also run in parallel in separate worktrees,
with 001 and 004 merged one after the other.
