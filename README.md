# Chart Quest

> Learn to read any market, one level at a time.

An interactive game that teaches technical analysis, from "what is a candle" to composing and backtesting your own trading strategy. No account, no signup, no server — progress is saved in your browser's `localStorage`.

**Live:** <https://chart-quest.vercel.app>

**Status:** pre-alpha. **Chapters 1 through 6 are playable end to end** — 43 levels across nine interaction kinds, including draw tools, a replay engine, a graded first trade with a journal, indicators with a price/percent/ATR y-axis, pattern base rates measured per asset with sample sizes and confidence intervals, and multi-timeframe levels running two live panes from one clock. Risk and position sizing are next. See [milestones](https://github.com/zkwokleung/chart-quest/milestones) for the build order.

---

## What makes this different

Most technical-analysis material is either a wall of prose or a pattern catalogue with invented win rates. Chart Quest is built on three commitments:

**1. Every level is an interaction, not a lesson.** You draw the trendline, click the swing highs, place the stop, predict the next bar. Reading is kept to a sentence or two. Feedback names your specific mistake — _"your line is anchored to bodies, not wicks"_ — instead of a score.

**2. Every number is measured, not asserted.** Pattern win rates are computed at build time from the bundled historical data, per asset, with sample sizes and confidence intervals.

This commitment has teeth, and the pattern chapter is where it bit hardest. The plan for it assumed win rates would come in around 40–60% and vary interestingly by market. Measured, all five patterns land between **47.6% and 50.1%**, every confidence interval overlaps every other, and no mean forward move reaches a quarter of a daily range in either direction. The first run looked better — double tops at 73% — until it turned out that a swing high isn't knowable until four later bars have failed to exceed it, and measuring from before that hands the pattern four bars of hindsight. Correct the clock and the edge disappears entirely.

So the level built on those numbers asks a different question than planned: not which pattern wins most, but **how much evidence there is for any of it**. Sample sizes run from 3,733 pin bars down to 66 head & shoulders — and the rarest, most storied shape reads 26.7% on gold and 66.7% on a small-cap industrial, from fifteen and eighteen examples respectively. The most impressive number in the table is the one with the least behind it, which is a better lesson than the one we set out to teach.

**3. What you learn must transfer to any asset.** A crypto-only curriculum produces a player who believes they learned technical analysis and actually learned crypto. Four mechanisms prevent that:

- **Cross-asset bosses** — every chapter's boss runs on a _different asset_ than that chapter's levels, so any asset-specific crutch fails at the gate.
- **Normalized measurement** — a y-axis toggle (price → % → ATR-multiples) means every measurement you make is already unit-free.
- **One sizing formula, four instrument classes** — spot crypto, shares, futures contracts, FX lots. Same math, different `valuePerPoint`.
- **Per-asset base rates** — a distribution across five markets, never a single number.

The game also teaches you to distrust your own results. The Chapter 1 boss is a coin flip you score ~50% on. Chapter 9 makes you overfit a rule until it looks brilliant, then reveals the out-of-sample collapse.

---

## Curriculum

Ten chapters, ~73 levels. Full breakdown in [`docs/CURRICULUM.md`](docs/CURRICULUM.md).

| Ch  | Title                        | Ends with                                           |
| --- | ---------------------------- | --------------------------------------------------- |
| 1   | Reading the Chart            | A coin-flip boss proving you can't predict yet      |
| 2   | Market Structure             | Swings, trendlines, breaks of structure             |
| 3   | Zones                        | Your first real trade, in replay                    |
| 4   | Patterns & Base Rates        | Guessing win rates, then seeing them measured       |
| 5   | Indicators                   | ATR as % — the normalization keystone               |
| 6   | Confluence & Multi-Timeframe | Full MTF replay trade                               |
| 7   | Risk, R & Sizing             | 10 trades; scored on expectancy, not profit         |
| 8   | Asset Character              | Measuring trend-persistence yourself, per asset     |
| 9   | Edge & Probability           | Spotting overfit and under-sampled backtests        |
| 10  | Build Your Own Strategy      | An exported playbook that works on ≥2 asset classes |

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

Requires Node 24 or newer.

```bash
git clone git@github.com:zkwokleung/chart-quest.git
cd chart-quest
npm install
npm run dev          # http://localhost:3000
```

`/dev/chart` renders any committed series and reports the bar index under the pointer — useful for working on anything coordinate-related.

Scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --quiet
npm test             # vitest run
npm run test:e2e     # playwright test (runs against a production build)
npm run build        # production build
npm run check:bundle # per-route client JS budget (needs a build first)
npm run data:fetch   # rebuild public/data from upstream sources
npm run data:rates   # recompute pattern base rates
npm run data:resample # rebuild the derived higher-timeframe series
```

### Data

Twelve committed series spanning crypto, an index, a single stock, FX, gold and an illiquid small-cap — chosen so they disagree with each other. Two of the twelve are aggregated from the others rather than fetched, because multi-timeframe levels need two views of one period and outside Bitcoin the fetched pairs do not overlap. Daily history starts 2005, reaching four distinct market regimes. The app never calls a market API at runtime.

`npm run data:fetch` regenerates them, but **the committed JSON is the source of truth** — levels address it by bar index, so a series is immutable once committed. Two series are rolling-window snapshots that upstream cannot serve twice identically. Read [`docs/DATA.md`](docs/DATA.md) before touching anything under `public/data/`.

`npm run data:rates` regenerates the per-asset pattern base rates and `npm run data:resample` the derived higher-timeframe series. Both write committed artefacts that a test recomputes, so a stale file fails CI rather than quietly teaching last month's numbers.

### Version pinning

Every dependency is pinned exactly (`save-exact=true`), because two windows in this stack are narrow:

- **TypeScript is held at 6.0.3**, not 7.x. Re-verified 2026-07-30: `tsc` and the whole test suite already pass on 7.0.2 — it is the toolchain that does not. `typescript-eslint` refuses TS 7.0 outright (peer `>=4.8.4 <6.1.0`; TS ≥7.1 tracked in [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)), and `next build` reports that 7.0.2 "does not provide the compiler API required by Next.js".
- **ESLint is held at 9.x**, not 10.x. One unguarded line: `eslint-plugin-react/lib/util/version.js:31` calls `context.getFilename()`, removed in ESLint 10. The plugin ships a compat shim for `getScope`, `getAncestors` and `getSourceCode`, but not this one — and it sits in React-version detection, which nearly every `react/*` rule consults, so it takes out the whole config.

Both are worth revisiting once the plugin ecosystem catches up — tracked in [#31](https://github.com/zkwokleung/chart-quest/issues/31). Until then a minor bump silently breaks the lint gate.

## Documentation

| Doc                                            | What's in it                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/PLAN.md`](docs/PLAN.md)                 | The full design plan — the source of truth for scope                 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The level-kind engine, schemas, grader contract, storage             |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md)     | All 10 chapters and ~73 levels, plus the cross-asset boss rule       |
| [`docs/DATA.md`](docs/DATA.md)                 | The six-series data spine, sources, format, out-of-sample rules      |
| [`docs/AUTHORING.md`](docs/AUTHORING.md)       | How to add a level — the most-repeated task in the project           |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)   | Orientation: the invariants, code conventions, verification commands |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)           | Branches, commits, and the verification gates                        |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). The two invariants that are easy to erode and enforced in CI:

1. **Every level authors ≥2 misconceptions.** A grader that returns a score teaches nothing.
2. **Every chapter boss runs on a different asset than its chapter's levels.** This is the transfer guarantee.

---

## Disclaimer

Chart Quest is educational software. It is **not financial advice**, and it does not claim that technical analysis predicts prices. Every pattern it teaches ships with its measured historical base rate and sample size precisely so you can see how thin these edges are. Nothing here is a recommendation to trade any instrument.

## License

[MIT](LICENSE). Fork it, teach with it, build your own curriculum on the level-kind
engine — the point is that the teaching spreads.

Third-party notices: charting is [lightweight-charts](https://github.com/tradingview/lightweight-charts)
(Apache-2.0), which requires attribution to TradingView. The price data under
`public/data/` is derived from public Binance, Stooq and Yahoo endpoints and is
redistributed for education; see [`docs/DATA.md`](docs/DATA.md) for provenance.
