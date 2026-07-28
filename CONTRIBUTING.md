# Contributing

## Working order

Development follows the milestones in order — each one ends at a verification gate. See [milestones](https://github.com/zkwokleung/chart-quest/milestones).

Pick an issue from the current milestone. If the current milestone's gate hasn't passed, don't start the next one; the later phases assume the earlier engines exist and work.

## Branches

```
main                       # always green
feat/<short-slug>          # features
fix/<short-slug>           # bug fixes
chore/<short-slug>         # tooling, deps, config
content/ch<N>-<slug>       # level authoring
```

Never commit directly to `main`. Open a PR, let CI run, then merge.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(level-engine): add mark-bars grader with set-overlap tolerance
fix(chart): keep annotations locked to price on log-scale toggle
test(backtest): assert no look-ahead via series accessor spy
content(ch2): author 2.1 through 2.6
docs(data): document the bar-index immutability rule
chore(deps): add lightweight-charts
```

Scopes match the module layout: `level-engine`, `chart`, `ta`, `backtest`, `instruments`, `store`, `data`, `content`, `ui`, `a11y`, `infra`.

## Verification gates

**Every PR must pass all four locally before review:**

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --quiet
npm test              # vitest run
npm run test:e2e      # playwright test  (only if UI changed)
```

A file write that "succeeded" is not a working change. If a type-checker or linter isn't configured yet for the area you touched, say so in the PR rather than implying it passed.

## Non-negotiable invariants

These are enforced by tests because they are easy to erode across ~73 levels and expensive to discover late.

| Invariant | Why |
|---|---|
| Every level authors **≥2 misconceptions** | A grader returning a score teaches nothing. This is the product. |
| Every chapter boss runs on a **different asset** than its chapter's levels | The cross-asset transfer guarantee |
| No Ch 1–9 level references `public/data/oos/` | Keeps Ch 10's out-of-sample validation genuine |
| Graders are **pure and deterministic** | No `Date.now()`, no `Math.random()`, no DOM, no store access |
| Backtester never reads a bar index **> current** | No look-ahead. Asserted by spying the series accessor. |
| Backtester never fills **inside a market-closed gap** | Uses `spec.hours`. A stop the market gapped through fills at the open. |
| Every level's own `target` scores **3 stars** through its own grader | Catches broken authoring across all levels cheaply |
| Every pattern in `base-rates.json` has **≥3 assets** and a reported `n` | The honesty commitment |
| The y-axis mode toggle **never changes grading** | Normalization is presentation, not scoring |

## Code style

- TypeScript strict. No `any` in committed code; if you need an escape hatch, `unknown` plus a narrowing function.
- **Comment discipline:** only comment what the code cannot say — a non-obvious *why*, a workaround and its cause, an external constraint, or a genuine gotcha. No comments restating the next line, no section-divider banners, no JSDoc echoing the signature. Match the surrounding density.
- Pure logic (`lib/ta`, `lib/levels/graders`, `lib/chart/geometry`, `lib/backtest`) must not import React or touch the DOM. This is what makes it testable.
- Prefer adding to an existing module over creating a near-duplicate one. Check `lib/ta/` before writing another moving-average.

## Testing expectations

| Area | Expectation |
|---|---|
| Graders | Unit tests per kind: the reference answer, a near-miss, a clear miss, and each misconception firing |
| Indicators | Values matched against hand-computed or published fixtures |
| Sizing | All four instrument classes, including lot rounding at boundaries |
| Backtester | Fixture strategy with a hand-computed equity curve; look-ahead and gap-fill assertions |
| Level content | Covered automatically by the authoring guards — no per-level tests needed |
| UI | Playwright smoke per level kind, plus a reload-mid-chapter persistence test |

Pure functions carry the correctness risk in this project, so that's where test effort goes. Chasing component-render coverage is not a good use of time here.

## Adding a level

See [`docs/AUTHORING.md`](docs/AUTHORING.md). Short version: pick a kind, find the bar indices, write the data file, author ≥2 misconceptions, run the tests.

## Adding a level *kind*

This is an architecture change, not a content change. Open an issue first. Ten kinds were chosen to cover the whole curriculum; an eleventh usually means a level is mis-scoped.

## Accessibility

Not a polish pass. Every PR touching UI keeps:

- Draw tools operable by keyboard (arrow keys + enter for anchors)
- Direction encoded by more than red/green — fill and shape too
- `prefers-reduced-motion` honored by anything animated
- Every `classify` level completable without a pointer

## Data changes

Read the immutability rule in [`docs/DATA.md`](docs/DATA.md) before touching `public/data/`. Appending bars is safe. Changing history shifts every bar index and silently breaks every level pointing into that series.
