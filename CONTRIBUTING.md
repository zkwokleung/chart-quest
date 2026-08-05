# Contributing

## Working order

The ten-chapter curriculum shipped at 1.0, so work is now discrete rather than phased. Start from an [open issue](https://github.com/zkwokleung/chart-quest/issues), or open one describing the change before writing it.

The eleven build milestones are closed and kept for their history: each one records what it found, and several of those findings are the reason an invariant exists. Worth reading before proposing a change to `lib/backtest/`, `lib/store/` or anything under `public/data/`.

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

**Every PR must pass all six locally before review:**

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --quiet
npm test              # vitest run
npm run build         # production build
npm run check:bundle  # per-route client JS budget (needs the build above)
npm run test:e2e      # playwright test (runs against a production build)
```

`check:bundle` is not optional and not cosmetic: several routes sit near their budget, and it is the gate that catches a dependency quietly landing in the shared chunk.

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
| Backtester never fills **inside a market-closed gap** | A stop the market gapped through fills at the **open**, which satisfies the rule without a trading calendar — `spec.hours` was specified and turned out not to be needed. |
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

This is an architecture change, not a content change. Open an issue first. Thirteen kinds cover the whole curriculum; a fourteenth usually means a level is mis-scoped.

## Accessibility

Not a polish pass, and measured rather than asserted — Lighthouse accessibility is 100 with no failing audits on every route. Every PR touching UI keeps:

- **Every kind** completable without a pointer, not just `classify`. `e2e/keyboard.spec.ts` is where that stops being a claim; add a case there rather than trusting a review.
- Draw tools operable by keyboard (arrows to move, shift for coarse steps, enter to place, escape to clear) and announcing where the cursor is.
- Direction encoded by more than red/green — fill and shape too.
- `prefers-reduced-motion` honoured by anything animated, via `useReducedMotion` rather than the media query directly, because an explicit choice in `/settings` beats the OS.
- Any container a third-party library renders into stays `aria-hidden`, with the label on a wrapper. See the note in `docs/ARCHITECTURE.md` §14 — this cost a real defect on every charted level.

**Never verify keyboard support with a synthetic `KeyboardEvent` or a browser-extension harness.** Both have reported this codebase's keyboard handling as broken when it was working. Playwright's `keyboard.press` is the arbiter.

## Data changes

Read the immutability rule in [`docs/DATA.md`](docs/DATA.md) before touching `public/data/`. Appending bars is safe. Changing history shifts every bar index and silently breaks every level pointing into that series.
