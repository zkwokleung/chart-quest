# Conventions

Orientation for anyone working in this repo. An interactive game teaching technical analysis — client-side only, no backend, no auth, progress in `localStorage`.

**Read first:** [`ARCHITECTURE.md`](ARCHITECTURE.md) before touching `lib/`, [`AUTHORING.md`](AUTHORING.md) before adding a level, [`DATA.md`](DATA.md) before touching `public/data/`. [`PLAN.md`](PLAN.md) is the scope source of truth.

## The two rules most easily eroded

1. **Every level authors ≥2 misconceptions.** A grader returning `0.62` teaches nothing; one returning _"you anchored to bodies, not wicks"_ teaches the thing. This is the product, not a nicety. CI fails without them.
2. **Every chapter boss runs on a different asset than its chapter's levels.** This is the cross-asset transfer guarantee — the reason a player finishes able to read any market rather than just crypto. CI enforces it.

## Other enforced invariants

- Graders are pure and deterministic — no `Date.now()`, `Math.random()`, DOM, or store access.
- **No level's graded answer depends on the store.** The stronger form of the rule above, and the one Chapter 9 had to be designed around: a component may read the player's journal or their recalled scores — 9.6's whole point is that it does — but the _answer_ may not, because `journal` and `predictions` are empty on a fresh save, after `resetProgress`, and in private mode where storage degrades to memory. A level whose answer depends on them is unwinnable for those players and cannot satisfy the winnability guard. Read the store to show evidence; grade against the data.
- The backtester never reads a bar index `> current`, and never fills inside a market-closed gap (`spec.hours`).
- No level in Ch 1–9 references `public/data/oos/` — that data is Ch 10's out-of-sample set.
- Every level's own `target` must score 3 stars through its own grader.
- The y-axis mode toggle (price/%/ATR) must never change grading.
- Every pattern in `base-rates.json` needs ≥3 assets and a reported `n`.

## Architecture in one paragraph

~73 levels must not be ~73 components. Twelve **level kinds**, each one React component + one pure grader, and every level is _data_ (`lib/levels/content/ch<N>/`) referencing bar indices into a committed price series. `app/level/[id]/page.tsx` dispatches on `level.kind` and contains no kind-specific logic. Adding a level means adding a data file.

## Verification

Work is not complete until these pass:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --quiet
npm test              # vitest run
npm run build         # production build
```

A successful file write is not a working change. If one of these isn't configured yet for the area you touched, say so rather than implying it passed.

## Code conventions

- TypeScript strict, with `noUncheckedIndexedAccess`. No `any` — use `unknown` plus narrowing.
- Pure logic (`lib/ta`, `lib/levels/graders`, `lib/chart/geometry`, `lib/backtest`) must not import React or touch the DOM. This is what makes it testable.
- Conventional Commits, scopes matching the module layout. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- Comment only what the code cannot say — a non-obvious _why_, a workaround and its cause, an external constraint, a real gotcha. No line-restating comments, no divider banners, no JSDoc echoing signatures.
- Before writing a new indicator or geometry helper, check `lib/ta/` and `lib/chart/` — near-duplicates are the main source of drift here.

## Tone of the product

This is a teaching tool in a domain full of dishonest content. Never write copy claiming technical analysis predicts prices or guarantees outcomes. Every pattern ships with its measured base rate and sample size. Several levels (1.B, 4.5, 8.3, 9.2, 9.5) exist specifically to teach the player to distrust their own results — treat them as load-bearing, not as polish.

## Work order

Follow the milestones in order; each ends at a verification gate. Later milestones assume the earlier engines exist and work.
