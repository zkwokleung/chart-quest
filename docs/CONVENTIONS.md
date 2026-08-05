# Conventions

Orientation for anyone working in this repo. An interactive game teaching technical analysis — client-side only, no backend, no auth, progress in `localStorage`.

**Read first:** [`ARCHITECTURE.md`](ARCHITECTURE.md) before touching `lib/`, [`AUTHORING.md`](AUTHORING.md) before adding a level, [`DATA.md`](DATA.md) before touching `public/data/`. [`PLAN.md`](PLAN.md) is the original design plan and carries the reasoning behind each decision, but it was written before any of this was built — where it disagrees with the three above, they are newer and win.

## The two rules most easily eroded

1. **Every level authors ≥2 misconceptions.** A grader returning `0.62` teaches nothing; one returning _"you anchored to bodies, not wicks"_ teaches the thing. This is the product, not a nicety. CI fails without them.
2. **Every chapter boss runs on a different asset than its chapter's levels.** This is the cross-asset transfer guarantee — the reason a player finishes able to read any market rather than just crypto. CI enforces it.

## Other enforced invariants

- Graders are pure and deterministic — no `Date.now()`, `Math.random()`, DOM, or store access.
- **No level's graded answer depends on the store.** The stronger form of the rule above, and the one Chapter 9 had to be designed around: a component may read the player's journal or their recalled scores — 9.6's whole point is that it does — but the _answer_ may not, because `journal` and `predictions` are empty on a fresh save, after `resetProgress`, and in private mode where storage degrades to memory. A level whose answer depends on them is unwinnable for those players and cannot satisfy the winnability guard. Read the store to show evidence; grade against the data.
- **One execution path: every simulated fill goes through `simulate`.** The backtester drives it per trade rather than resolving fills itself, `runEdge` is an adapter over the same engine, and `npm run data:character && npm run data:sweep` must leave `public/data/` byte-identical. Two implementations would give the game two answers for one rule, and they would disagree in the fifth decimal on gapped bars — where nobody would look.
- The backtester never reads a bar index `> current`, asserted by prefix invariance: truncating the series cannot change a trade that already closed. A gap past the stop fills at the **open** rather than at the stop, which satisfies the market-closed-gap rule without a trading calendar (`spec.hours` was specified and is not needed).
- No level in Ch 1–9 references `public/data/oos/` — that data is Ch 10's out-of-sample set.
- Every level's own `target` must score 3 stars through its own grader.
- The y-axis mode toggle (price/%/ATR) must never change grading.
- Every pattern in `base-rates.json` needs ≥3 assets and a reported `n`.
- **Every level kind is completable without a pointer**, and `e2e/keyboard.spec.ts` is where that stops being a claim. A kind whose interaction is a canvas provides a `role="application"` surface that announces where its cursor is; everything else uses the native element that already has the behaviour.
- **A library that renders its own DOM into a container we label gets `aria-hidden` on that container.** `role="img"` does not stop Chrome exposing descendants — `lightweight-charts` announced a table of empty cells inside every chart from M3 until M11 because of it. Anything that should be reachable goes beside the wrapper, not inside it.
- **Imported saves are validated before they are migrated.** `migratePersisted` fills gaps from `initialPersisted`, which is right for our own storage and wrong for a file: it would accept a text file as an empty save and replace ten chapters with it. `lib/store/transfer.ts` checks the shape first and never partially applies.

## Architecture in one paragraph

73 levels must not be 73 components. Thirteen **level kinds**, each one React component + one pure grader, and every level is _data_ (`lib/levels/content/ch<N>/`) referencing bar indices into a committed price series. `app/level/[id]/page.tsx` dispatches on `level.kind` and contains no kind-specific logic. Adding a level means adding a data file.

## Verification

Work is not complete until these pass:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --quiet
npm test              # vitest run
npm run build         # production build
npm run check:bundle  # per-route client JS budget (needs the build above)
npm run test:e2e      # playwright test (runs against a production build)
```

A successful file write is not a working change. If one of these isn't configured yet for the area you touched, say so rather than implying it passed.

`check:bundle` belongs in the gate rather than beside it. Several routes sit near their budget, and a dependency landing in the shared chunk is invisible to every other command here.

## Code conventions

- TypeScript strict, with `noUncheckedIndexedAccess`. No `any` — use `unknown` plus narrowing.
- Pure logic (`lib/ta`, `lib/levels/graders`, `lib/chart/geometry`, `lib/backtest`) must not import React or touch the DOM. This is what makes it testable.
- Conventional Commits, scopes matching the module layout. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- Comment only what the code cannot say — a non-obvious _why_, a workaround and its cause, an external constraint, a real gotcha. No line-restating comments, no divider banners, no JSDoc echoing signatures.
- Before writing a new indicator or geometry helper, check `lib/ta/` and `lib/chart/` — near-duplicates are the main source of drift here.

## Tone of the product

This is a teaching tool in a domain full of dishonest content. Never write copy claiming technical analysis predicts prices or guarantees outcomes. Every pattern ships with its measured base rate and sample size. Several levels (1.B, 4.5, 8.3, 9.2, 9.5) exist specifically to teach the player to distrust their own results — treat them as load-bearing, not as polish.

## Work order

The curriculum shipped at 1.0 and the eleven build milestones are closed, so there is no phase to be in: work starts from an open issue. The closed milestones are kept for their history — several invariants above exist because a milestone measured something and got a different answer than the plan expected, and that reasoning is not reconstructable from the code.
