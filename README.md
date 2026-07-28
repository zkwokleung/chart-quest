# Chart Quest

> Learn to read any market, one level at a time.

An interactive game that teaches technical analysis, from "what is a candle" to composing and backtesting your own trading strategy. No account, no signup, no server — progress is saved in your browser's `localStorage`.

**Status:** pre-alpha. Nothing is playable yet. See [milestones](https://github.com/zkwokleung/chart-quest/milestones) for the build order.

---

## What makes this different

Most technical-analysis material is either a wall of prose or a pattern catalogue with invented win rates. Chart Quest is built on three commitments:

**1. Every level is an interaction, not a lesson.** You draw the trendline, click the swing highs, place the stop, predict the next bar. Reading is kept to a sentence or two. Feedback names your specific mistake — *"your line is anchored to bodies, not wicks"* — instead of a score.

**2. Every number is measured, not asserted.** Pattern win rates are computed at build time from the bundled historical data, per asset, with sample sizes and confidence intervals. When head & shoulders runs 41% on EURUSD and 58% on BTC, the game shows you both — because the real lesson is that pattern edge is asset- and regime-dependent, so you have to measure it on *your* market.

**3. What you learn must transfer to any asset.** A crypto-only curriculum produces a player who believes they learned technical analysis and actually learned crypto. Four mechanisms prevent that:

- **Cross-asset bosses** — every chapter's boss runs on a *different asset* than that chapter's levels, so any asset-specific crutch fails at the gate.
- **Normalized measurement** — a y-axis toggle (price → % → ATR-multiples) means every measurement you make is already unit-free.
- **One sizing formula, four instrument classes** — spot crypto, shares, futures contracts, FX lots. Same math, different `valuePerPoint`.
- **Per-asset base rates** — a distribution across six markets, never a single number.

The game also teaches you to distrust your own results. The Chapter 1 boss is a coin flip you score ~50% on. Chapter 9 makes you overfit a rule until it looks brilliant, then reveals the out-of-sample collapse.

---

## Curriculum

Ten chapters, ~73 levels. Full breakdown in [`docs/CURRICULUM.md`](docs/CURRICULUM.md).

| Ch | Title | Ends with |
|---|---|---|
| 1 | Reading the Chart | A coin-flip boss proving you can't predict yet |
| 2 | Market Structure | Swings, trendlines, breaks of structure |
| 3 | Zones | Your first real trade, in replay |
| 4 | Patterns & Base Rates | Guessing win rates, then seeing them measured |
| 5 | Indicators | ATR as % — the normalization keystone |
| 6 | Confluence & Multi-Timeframe | Full MTF replay trade |
| 7 | Risk, R & Sizing | 10 trades; scored on expectancy, not profit |
| 8 | Asset Character | Measuring trend-persistence yourself, per asset |
| 9 | Edge & Probability | Spotting overfit and under-sampled backtests |
| 10 | Build Your Own Strategy | An exported playbook that works on ≥2 asset classes |

---

## Stack

- **Next.js 16** App Router, TypeScript, fully client-side and static
- **lightweight-charts** + an overlay canvas for draw tools and grading visuals
- **Zustand** + `persist` for state and `localStorage`
- **Tailwind v4** + shadcn/ui, `motion` for reveal animations
- Own pure-TS indicators and backtester in `lib/ta/` and `lib/backtest/` — no TA dependency
- **Vitest** for graders/indicators/backtester, **Playwright** for smoke tests
- Deployed on Vercel

## Quick start

> Not yet scaffolded — this section becomes accurate at the end of Milestone 1.

```bash
git clone git@github.com:zkwokleung/chart-quest.git
cd chart-quest
npm install
npm run dev          # http://localhost:3000
```

Useful scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --quiet
npm test             # vitest run
npm run test:e2e     # playwright test
npm run data:fetch   # rebuild public/data from upstream sources
npm run data:rates   # recompute per-asset base rates
```

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | The full design plan — the source of truth for scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The level-kind engine, schemas, grader contract, storage |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md) | All 10 chapters and ~73 levels, plus the cross-asset boss rule |
| [`docs/DATA.md`](docs/DATA.md) | The six-series data spine, sources, format, out-of-sample rules |
| [`docs/AUTHORING.md`](docs/AUTHORING.md) | How to add a level — the most-repeated task in the project |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Branches, commits, and the verification gates |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). The two invariants that are easy to erode and enforced in CI:

1. **Every level authors ≥2 misconceptions.** A grader that returns a score teaches nothing.
2. **Every chapter boss runs on a different asset than its chapter's levels.** This is the transfer guarantee.

---

## Disclaimer

Chart Quest is educational software. It is **not financial advice**, and it does not claim that technical analysis predicts prices. Every pattern it teaches ships with its measured historical base rate and sample size precisely so you can see how thin these edges are. Nothing here is a recommendation to trade any instrument.

## License

Not yet chosen — see [#1](https://github.com/zkwokleung/chart-quest/issues/1).
