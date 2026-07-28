# Chart Quest — agent notes

An interactive game teaching technical analysis. Client-side only, no backend, no auth. Progress in `localStorage`.

**Read first:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before touching `lib/`, [`docs/AUTHORING.md`](docs/AUTHORING.md) before adding a level, [`docs/DATA.md`](docs/DATA.md) before touching `public/data/`. [`docs/PLAN.md`](docs/PLAN.md) is the scope source of truth.

## The two rules most easily eroded

1. **Every level authors ≥2 misconceptions.** A grader returning `0.62` teaches nothing; one returning *"you anchored to bodies, not wicks"* teaches the thing. This is the product, not a nicety. CI fails without them.
2. **Every chapter boss runs on a different asset than its chapter's levels.** This is the cross-asset transfer guarantee — the reason a player finishes able to read any market rather than just crypto. CI enforces it.

## Other enforced invariants

- Graders are pure and deterministic — no `Date.now()`, `Math.random()`, DOM, or store access.
- The backtester never reads a bar index `> current`, and never fills inside a market-closed gap (`spec.hours`).
- No level in Ch 1–9 references `public/data/oos/` — that data is Ch 10's out-of-sample set.
- Every level's own `target` must score 3 stars through its own grader.
- The y-axis mode toggle (price/%/ATR) must never change grading.
- Every pattern in `base-rates.json` needs ≥3 assets and a reported `n`.

## Architecture in one paragraph

~73 levels must not be ~73 components. Ten **level kinds**, each one React component + one pure grader, and every level is *data* (`lib/levels/content/ch<N>/`) referencing bar indices into a committed price series. `app/level/[id]/page.tsx` dispatches on `level.kind` and contains no kind-specific logic. Adding a level means adding a data file.

## Verification

Never report work complete without running:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --quiet
npm test              # vitest run
```

If one isn't configured yet, say so explicitly rather than implying it passed. A successful file write is not a working change.

## Conventions

- TypeScript strict. No `any` — use `unknown` plus narrowing.
- Pure logic (`lib/ta`, `lib/levels/graders`, `lib/chart/geometry`, `lib/backtest`) must not import React or touch the DOM.
- Conventional Commits, scopes matching the module layout. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Comment only what code cannot say — a non-obvious *why*, a workaround and its cause, an external constraint, a real gotcha. No line-restating comments, no divider banners, no JSDoc echoing signatures.
- Before writing a new indicator or geometry helper, check `lib/ta/` and `lib/chart/` — near-duplicates are the main source of drift here.

## Tone of the product

This is a teaching tool in a domain full of dishonest content. Never write copy that claims technical analysis predicts prices or guarantees outcomes. Every pattern ships with its measured base rate and sample size. Several levels (1.B, 4.5, 8.3, 9.2, 9.5) exist specifically to teach the player to distrust their own results — treat them as load-bearing, not as polish.

## Work order

Follow the milestones in order; each ends at a verification gate. Later phases assume the earlier engines exist and work.
