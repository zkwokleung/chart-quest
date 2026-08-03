# Data

All price data is **bundled and committed** as static JSON. The app never calls a market API at runtime. This keeps it offline-capable, deterministic (every player sees the same candles, so answers can be pre-authored), and free of keys and rate limits.

---

## The six-series spine

Chosen so the series **disagree with each other**. Contrast is the pedagogical point — a spine of six crypto pairs would teach nothing that a single pair doesn't.

Sizes are actual gzip measurements. The in-sample column is what chapters 1–9 teach on; the rest is held back for Chapter 10 (see below).

| Series        | Range (in-sample) | Bars  | gz     | Character it exists to teach                        |
| ------------- | ----------------- | ----- | ------ | --------------------------------------------------- |
| `BTCUSDT-1d`  | 2017-08 → 2025-03 | 2,778 | 57 KB  | Crypto · 24/7 · high vol · trend-persistent         |
| `BTCUSDT-4h`  | 2021-01 → 2023-07 | 5,586 | 112 KB | Crypto intraday                                     |
| `SPY-1d`      | 2005-01 → 2023-04 | 4,612 | 78 KB  | Index · sessions · gaps · short-term mean-reverting |
| `SPY-15m`     | rolling 60 days   | 1,041 | 16 KB  | Intraday sessions and the opening range             |
| `AAPL-1d`     | 2005-01 → 2023-04 | 4,612 | 69 KB  | Single stock · earnings gaps · split-adjusted       |
| `AAPL-1d-raw` | 2020-06 → 2020-09 | 86    | 2 KB   | Level 1.7 only — see _Reconstruction_               |
| `EURUSD-1d`   | 2005-01 → 2023-05 | 4,755 | 64 KB  | FX · 24/5 · low vol · ranging · Sunday gap          |
| `EURUSD-1h`   | rolling 500 days  | 7,163 | 64 KB  | FX intraday                                         |
| `GC-1d`       | 2005-01 → 2023-05 | 4,607 | 63 KB  | Commodity · different volatility regime             |
| `LAKE-1d`     | 2005-01 → 2023-04 | 4,612 | 54 KB  | Illiquid small-cap · spread and slippage            |

**579 KB gzipped in-sample, plus 102 KB held back.** Ceiling is **150 KB gzipped per file**; the fetch script refuses to write anything larger. Files are lazy-loaded only by the levels that reference them, so page-load cost is per-level, not total.

`LAKE` (Lakeland Industries) is the illiquid series: median volume around 18,500 shares, plus a real 2014 news spike that puts thin-book, gap and slippage risk on one chart.

Daily history starts **2005** so four distinct regimes are reachable — the 2007–09 crisis, 2015–16, COVID, and the 2022 rate-hike grind — and so base-rate samples are large enough for their confidence intervals to mean something.

## Sources

- **Crypto** — Binance public klines. No API key. Paginates at 1,000 bars; BTCUSDT starts 2017-08-17 on every interval, which is the exchange's own launch.
- **Everything else** — Yahoo `v8/finance/chart`, which needs a browser-like `User-Agent`.

Rerun with `npm run data:fetch`. Raw responses cache under `.data-cache/` (gitignored) so development runs don't re-hit upstream. The committed JSON is the source of truth for the app.

> **Stooq is not usable.** It sits behind a JavaScript proof-of-work challenge, so it cannot be fetched from a script. Yahoo is therefore the sole source for eight of the ten series. That is a real single point of failure, and it is acceptable only because the data is fetched once and committed — a later upstream change cannot break the app.

### What Yahoo will and will not give you

| Constraint                                                                                         | Consequence                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quote.close` is **split-adjusted but not dividend-adjusted**; `adjclose` is both                  | We keep `quote` so OHLC stays internally consistent. Mixing an adjusted close with an unadjusted high produces bars whose close sits outside their own range.                           |
| Daily reaches **2005 via `period1`** (the `range=10y` shorthand is what caps at ten years)         | The 2007–09 crisis is reachable.                                                                                                                                                        |
| Intraday is **hard-capped**: 15m and 30m at ~60 days, 1h at ~730. It errors rather than truncating | `SPY-15m` and `EURUSD-1h` are rolling-window **snapshots**.                                                                                                                             |
| The **current in-progress bar** is appended regardless of `period2`                                | Trimmed client-side. Committing a partial candle would teach from an incomplete bar and silently fill in on any refetch.                                                                |
| **Delisted tickers 404**                                                                           | No real dead-ticker series is obtainable, so boss 9.B's survivorship-bias report is constructed content — which it always was, being a `spot-the-flaw` on a report rather than on data. |

### Snapshots

`SPY-15m` and `EURUSD-1h` are marked `"snapshot": true` in the manifest. Upstream only serves a rolling window for those intervals, so **re-running the fetch produces different bars**. They are pinned by hash and are not expected to match a later refetch. Everything else is reproducible from the pinned end date in `scripts/fetch-data.ts`.

### Reconstruction: the unadjusted AAPL slice

No free source publishes genuinely unadjusted prices. Level 1.7 ("The split trap") needs them, because the lesson is that a chart can show a catastrophic drop that never happened. So `AAPL-1d-raw` is **derived**, not fetched: each bar is multiplied by the product of every split dated after it, inverting the adjustment using the split events Yahoo reports alongside the prices.

The result is the artifact the level wants — the same two sessions read as:

```
AAPL-1d-raw   2020-08-28  499.24  →  2020-08-31  129.04    −74.2%
AAPL-1d       2020-08-28  124.81  →  2020-08-31  129.04     +3.4%
```

Both readings come from the same trades. Volume is deliberately not rescaled: it adjusts in the opposite direction and the level is about price, so a synthetic volume series would add noise a player might mistake for signal.

### Repaired bars

Roughly **5% of gold bars and 2% of EURUSD bars** arrive with a range that excludes their own open or close, because the extremes and the endpoints come from different feeds. Rendering one produces a candle whose wick does not contain its body — actively wrong in Chapter 1, whose subject is candle anatomy.

The fetch script widens the offending extreme to contain the endpoint. That is the minimal correction and invents no price that was not already in the bar. Counts are recorded per series in the manifest as `repairedBars` rather than swallowed, and above **10%** the fetch fails outright on the grounds that the feed is broken rather than quirky.

---

## Format: columnar, not per-candle

```ts
type Series = {
  id: SeriesId;
  tf: Timeframe;
  t: number[]; // epoch ms, ascending, no duplicates
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};
```

Columnar is roughly **4× smaller** than an array of `{t,o,h,l,c,v}` objects because JSON key names aren't repeated per bar. Prices are rounded per instrument before writing — 2 decimals for equities, crypto and gold, 5 for FX. Full float precision across 5,000 bars is wasted bytes.

Rounding is validated: if it flattened a series so that most bars had a high equal to their low, the fetch fails with a "precision too coarse" error rather than committing a chart with no wicks.

`SeriesId` in `lib/chart/types.ts` is a literal union, not `string` — a typo in a level's `series` field should be a compile error rather than a runtime 404. A test asserts the union and `public/data/series/manifest.json` list exactly the same ids.

`manifest.json` records per series: timeframe, bar count, first and last bar, raw and gzipped size, `sha256`, source, and the `snapshot` / `reconstructed` / `repairedBars` / `droppedBars` flags.

---

## Bar indices are the addressing scheme

Levels reference data by **bar index**, not date:

```ts
data: [{ series: "BTCUSDT-1d", from: 812, to: 980 }];
```

Indices are stable only because series files are **immutable once committed**.

> **A data refresh is a breaking change.** Appending new bars to the end is safe. Changing history, changing the start date, or changing the adjustment basis shifts every index and silently breaks every level pointing into that series. If you must do it, treat it as a migration: bump the series id (`SPY-1d` → `SPY-1d-v2`), re-audit affected levels, and rely on the "every level's own target scores 3 stars" test to catch what you missed.

---

## Out-of-sample holdback

`public/data/oos/` holds the slices used by Ch 10.6 and 10.7 — the most recent **15%** of each series.

**No level in chapters 1–9 may reference a file under `oos/`.** This is what makes the out-of-sample validation genuine rather than theatre — if the player has already practised on those bars, the final chapter proves nothing.

The in-sample files are **genuinely truncated**, not shipped whole alongside a duplicate tail. Verified disjoint: every holdback starts strictly after its counterpart ends, with zero shared timestamps.

Why 15%: a daily strategy trades roughly monthly, so clearing 10.6's "at least 30 trades" bar wants about three years, and 15% of a 2005–2026 series is ~815 bars. `splitOos` refuses anything under 200 bars rather than shipping a holdback too small to say anything.

**Everything is held back except `SPY-15m`.** That includes `BTCUSDT-4h` and `EURUSD-1h`, because Chapter 10 lets the player choose their timeframe — leaving a series unsplit would let them skip out-of-sample validation simply by picking it. `SPY-15m` is the exception: a 60-day snapshot has no room to spare, and it exists for the session levels rather than for strategy building.

Three layers keep the holdback separate:

1. **Type** — `OosSeriesId` is a distinct type. A level's `series` field accepts only `SeriesId`, so no level can name one even by accident.
2. **Module** — `lib/data/load-oos.ts` is separate from the ordinary loader and should be imported by nothing outside Chapter 10.
3. **Manifest** — `oos/manifest.json` is absent from the one the ordinary loader reads, and a test asserts no `-oos` id appears in the main manifest.

The level-content scan (`no level in Ch 1–9 references an oos series`) belongs with the authoring guards, since levels do not exist yet to scan.

## Integrity guard

`lib/data/integrity.test.ts` checks the committed files against the manifest: hashes, bar counts, first and last bar, column alignment, strictly increasing timestamps, every bar's range containing its own open and close, the size ceiling, and the absence of any `-oos` id from the main manifest. Verified by tampering with a single close price — three independent checks caught it.

**What it cannot catch:** a deliberate refetch that shifts history _and_ updates the manifest in the same commit. That surfaces as a manifest diff in review, which is why the manifest is committed. Verifying committed data against upstream needs the network and can never pass for the snapshot series, so it stays a manual step rather than a CI job.

---

## Base rates

_Not built yet — `compute-base-rates.ts` needs the pattern detectors from `lib/ta/`, so it lands with the indicators milestone._

`scripts/compute-base-rates.ts` scans the spine for each pattern definition and emits measured forward-return statistics **per asset**:

```json
{
  "head-and-shoulders": {
    "byAsset": {
      "BTCUSDT-1d": {
        "n": 34,
        "winRate": 0.58,
        "meanFwdR": 0.21,
        "ci95": [0.41, 0.74]
      },
      "EURUSD-1d": {
        "n": 41,
        "winRate": 0.41,
        "meanFwdR": -0.08,
        "ci95": [0.26, 0.57]
      }
    },
    "pooled": { "n": 210, "winRate": 0.49, "spread": [0.41, 0.58] }
  }
}
```

Rerun with `npm run data:rates`. Output must be **reproducible** from the committed series — asserted in tests.

Three rules for this file:

1. **Per asset, always.** A single pooled number labelled "the pattern's base rate" is the exact dishonesty this project exists to correct. Ch 4.5 shows the spread across markets.
2. **Report `n` and the CI.** The wide intervals are not a flaw to hide. At `n = 34` they _are_ the lesson, and Ch 9.2 points straight at them.
3. **≥3 assets per pattern**, or the pattern doesn't ship. Enforced by test.

---

## The edge sweep

`public/data/edge-sweep.json`, from `npm run data:sweep`. One rule — a close above the highest high of the previous _n_ bars, a stop 2 ATR below entry, a 2R target, entering only when flat — across **26 lookbacks** (5 to 55, step 2) and **four markets**, measured twice: on the first 70% of each series and on the rest.

Per (asset, lookback) it stores `trades`, `totalR`, `perTradeR` and `maxDrawdownR` for each window, plus `rankLater` — where that lookback's later-window total placed among all 26, best first. The rank is the honest statistic, and the reason it is stored rather than left to be inferred: a total can be explained away by a shorter window and a rank cannot.

**The split is inside the in-sample data, and Chapter 9 must not call it out-of-sample.** `oos/` is Chapter 10's, and 10.6 uses that phrase for bars the game has never shown. 9.5 says "the later third", and its claims test asserts the level never says otherwise. A game with two meanings for its most load-bearing term has none.

**The loader refuses a file missing `trades` per cell.** A total R with no sample size attached is a number nobody can argue with, which is precisely what Chapter 9 is about.

`lib/data/edge-sweep.test.ts` recomputes the committed file from the shipped `edges.ts` and fails on drift, exactly as the base rates do. `breakoutN(20)` is separately pinned to reproduce Chapter 8's committed `breakout-20` figures on all six markets, so Chapter 8's numbers cannot move underneath 8.3, 8.5, 8.6 and 8.B.

---

## Open data decisions

**Resolved:**

- _Illiquid small-cap_ → `LAKE`. Full 2005–2026 history, median volume ~18,500 shares, plus a real 2014 news spike.
- _Date ranges_ → daily from 2005, giving four distinct regimes. Intraday is whatever upstream allows (see the caps table).

**Still open:**

- Whether free ES futures data is obtainable at acceptable quality for level 7.3, or whether the futures case uses a documented synthetic contract spec layered over the SPY series instead. Nothing in the data pipeline depends on this — `InstrumentSpec` arrives with the risk milestone.
