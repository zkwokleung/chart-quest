# Data

All price data is **bundled and committed** as static JSON. The app never calls a market API at runtime. This keeps it offline-capable, deterministic (every player sees the same candles, so answers can be pre-authored), and free of keys and rate limits.

---

## The six-series spine

Chosen so the series **disagree with each other**. Contrast is the pedagogical point — a spine of six crypto pairs would teach nothing that a single pair doesn't.

| Series | Timeframes | Character it exists to teach |
|---|---|---|
| `BTCUSDT` | 1d, 4h | Crypto · 24/7 · high vol · trend-persistent |
| `SPY` | 1d, 15m | Index · sessions · gaps · short-term mean-reverting |
| `AAPL` | 1d | Single stock · earnings gaps · splits |
| `EURUSD` | 1d, 1h | FX · 24/5 · low vol · ranging · Sunday gap |
| `GC` (gold) | 1d | Commodity · different volatility regime |
| *illiquid small-cap (TBD)* | 1d | Spread and slippage |

Target: **< 150 KB gzipped per series+timeframe**, ~1.5–2 MB committed total. Each file is lazy-loaded only by the levels that reference it, so page-load cost is per-level, not total.

## Sources

- **Crypto** — Binance public klines REST endpoint. No API key required.
- **Equities, FX, gold** — Stooq or Yahoo historical CSV.

**Equities must be split- and dividend-adjusted**, with one deliberate exception: ship a *raw, unadjusted* AAPL slice around the Aug 2020 4:1 split so level 1.7 has a genuine artifact to expose. An unadjusted chart there shows a −75% single-day crash that never happened — that's the level.

Rerun with `npm run data:fetch`. The script writes normalized output; the committed JSON is the source of truth for the app.

---

## Format: columnar, not per-candle

```ts
type Series = {
  id: SeriesId;
  tf: Timeframe;
  t: number[];   // epoch ms, ascending, no duplicates
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};
```

Columnar is roughly **4× smaller** than an array of `{t,o,h,l,c,v}` objects because JSON key names aren't repeated per bar. Prices are rounded to sane per-instrument precision before writing — full float precision on a 1500-bar series is wasted bytes.

`public/data/manifest.json` lists every available series, its timeframe, bar count, date range, and byte size.

---

## Bar indices are the addressing scheme

Levels reference data by **bar index**, not date:

```ts
data: [{ series: 'BTCUSDT-1d', from: 812, to: 980 }]
```

Indices are stable only because series files are **immutable once committed**.

> **A data refresh is a breaking change.** Appending new bars to the end is safe. Changing history, changing the start date, or changing the adjustment basis shifts every index and silently breaks every level pointing into that series. If you must do it, treat it as a migration: bump the series id (`SPY-1d` → `SPY-1d-v2`), re-audit affected levels, and rely on the "every level's own target scores 3 stars" test to catch what you missed.

---

## Out-of-sample holdback

`public/data/oos/` holds the slices used by Ch 10.6 and 10.7.

**No level in chapters 1–9 may reference a file under `oos/`.** This is what makes the out-of-sample validation genuine rather than theatre — if the player has already practiced on those bars, the final chapter proves nothing.

Enforced by test: `no level in Ch 1–9 references a series under public/data/oos/`.

---

## Base rates

`scripts/compute-base-rates.ts` scans the spine for each pattern definition and emits measured forward-return statistics **per asset**:

```json
{
  "head-and-shoulders": {
    "byAsset": {
      "BTCUSDT-1d": { "n": 34, "winRate": 0.58, "meanFwdR":  0.21, "ci95": [0.41, 0.74] },
      "EURUSD-1d":  { "n": 41, "winRate": 0.41, "meanFwdR": -0.08, "ci95": [0.26, 0.57] }
    },
    "pooled": { "n": 210, "winRate": 0.49, "spread": [0.41, 0.58] }
  }
}
```

Rerun with `npm run data:rates`. Output must be **reproducible** from the committed series — asserted in tests.

Three rules for this file:

1. **Per asset, always.** A single pooled number labelled "the pattern's base rate" is the exact dishonesty this project exists to correct. Ch 4.5 shows the spread across markets.
2. **Report `n` and the CI.** The wide intervals are not a flaw to hide. At `n = 34` they *are* the lesson, and Ch 9.2 points straight at them.
3. **≥3 assets per pattern**, or the pattern doesn't ship. Enforced by test.

---

## Open data decisions

Tracked as issues, resolved during Milestones 1–2:

- Which illiquid small-cap for the spread/slippage lesson, and whether free adjusted history for it is reliable enough to commit.
- Exact date ranges per series — drives bundle size and how many distinct regimes Ch 8.5 can show.
- Whether free ES futures data is obtainable at acceptable quality for level 7.3, or whether the futures case uses a documented synthetic contract spec layered over the SPY series instead.
