## What and why

<!-- One or two sentences. Link the issue: Closes #123 -->

## Verification gates

All must pass locally before review (see `CONTRIBUTING.md`):

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:e2e` — only if UI changed

If any is not yet configured for the area you touched, say so here rather than ticking it.

## Invariants touched

Tick anything this PR could affect, and say how you verified it still holds:

- [ ] Every level authors ≥2 misconceptions
- [ ] Every chapter boss runs on a different asset than its chapter's levels
- [ ] No Ch 1–9 level references `public/data/oos/`
- [ ] Graders stay pure and deterministic
- [ ] Backtester reads no bar index > current, and never fills inside a market-closed gap
- [ ] Every level's own `target` scores 3 stars through its own grader
- [ ] The y-axis mode toggle does not change grading
- [ ] `base-rates.json` patterns have ≥3 assets and a reported `n`
- [ ] None of the above

## Accessibility

Only if this PR touches UI:

- [ ] Keyboard operable
- [ ] Direction not conveyed by colour alone
- [ ] `prefers-reduced-motion` honored

## Notes for the reviewer

<!-- Anything you're unsure about, or deliberately left out of scope -->
