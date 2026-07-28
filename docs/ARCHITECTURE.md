# Architecture

The central problem: **~73 levels must not be ~73 components.**

The solution is a small set of reusable interaction primitives ("level kinds"). Each kind is one React component plus one pure grader function. Every level is *data* referencing a slice of a price series. Adding a level means adding a data file, not writing code.

---

## 1. Level kinds

Ten kinds cover the whole curriculum.

| Kind | Interaction | Teaches |
|---|---|---|
| `annotate` | Drag to draw. Modes: `trendline`, `level`, `zone`, `channel`, `fib`. | Structure, zones, geometry |
| `mark-bars` | Click candles / ranges. Graded as set overlap, ±n bar tolerance. | Pattern spotting, swings, volume events |
| `classify` | Chart shown, choose a label. Grounded in a *chart*, never in prose. | Regime, pattern ID, breakout vs fakeout |
| `predict-next` | Chart truncated at bar N. Commit a direction/target. Reveal animates the real bars. | Humility, probabilistic thinking |
| `replay-trade` | Bar-by-bar replay, play/pause/step. Place entry/stop/target, manage the position. | Everything real |
| `tune-param` | Live slider over a parameter. Find the value satisfying a condition. | Indicator lag, parameter sensitivity, overfitting |
| `sort-rank` | Drag to order, then reveal the true ordering. | Base rates, setup quality, confluence |
| `sizing-calc` | Numeric input, graded with tolerance, parameterized by `InstrumentSpec`. | R-multiples, sizing across instruments, expectancy |
| `spot-the-flaw` | A finished bad trade or a backtest report; identify what's wrong. | Anti-patterns, critical reading |
| `build-rules` | Block composer → multi-asset backtest → hit an objective. | Chapter 10 |

Some levels are **composite** — a boss may chain `mark-bars` → `annotate` → `classify` → `predict-next` and average the scores. Composites are expressed as a sequence of kinds, not a new kind.

---

## 2. Level schema

```ts
// lib/levels/schema.ts
interface Level {
  id: LevelId;                       // '3-4' | '3-B'
  chapter: number;
  title: string;
  kind: LevelKind;
  brief: string;                     // one or two sentences, max
  data: { series: SeriesId; from: number; to: number; reveal?: number }[];  // array → MTF & multi-asset
  config: KindConfig;                // discriminated on `kind`
  target: KindTarget;                // the reference answer
  tolerance: KindTolerance;
  stars: [number, number, number];   // score thresholds for 1/2/3 stars
  misconceptions: Misconception[];   // REQUIRED, min 2 — see §4
  unlocks?: ToolId[];
  hints: string[];                   // progressive, costs stars
  yAxis?: 'price' | 'pct' | 'atr';   // default mode; player may toggle unless locked
}
```

`data` is an array so multi-timeframe levels (Ch 6) and multi-asset levels (Ch 8) need no special case. Single-chart levels carry a one-element array.

`from`/`to` are **bar indices** into the series, not dates. Indices are stable because the series files are immutable once committed; a data refresh is a breaking change requiring a level audit (see [`DATA.md`](DATA.md)).

---

## 3. Grader contract

```ts
type Grade = {
  score: number;                     // 0..1
  stars: 0 | 1 | 2 | 3;
  diagnosis: Misconception[];        // matched, most specific first
  reference: OverlaySpec;            // animated onto the player's attempt
};

type Grader<K extends LevelKind> =
  (attempt: Attempt<K>, level: Level & { kind: K }, data: Series[]) => Grade;
```

Graders are **pure and deterministic**. No `Date.now()`, no `Math.random()`, no DOM, no store access. This makes them the highest-value and cheapest-to-test code in the project.

Registry: `lib/levels/graders/index.ts` maps `LevelKind → Grader`. The level page dispatches on `level.kind`; it never contains kind-specific logic.

---

## 4. Misconceptions: where the teaching actually lives

```ts
interface Misconception {
  id: string;
  test: (attempt: Attempt, level: Level, data: Series[]) => boolean;
  message: string;                   // "Your line cuts 2 candle bodies — anchor to wicks."
  showOverlay?: OverlaySpec;         // draw the correction on their attempt
}
```

A grader that returns `0.62` teaches nothing. A grader that returns *"you anchored to bodies instead of wicks"* teaches the thing. This is the single most important design decision in the codebase.

**Invariant: every level authors ≥2 misconceptions** covering its commonest wrong answers. Enforced by test. A PR adding a level without them fails CI.

After grading, the UI shows the diagnosis, then animates `reference` onto the player's attempt so they see the **delta**, not a verdict.

---

## 5. Normalization

The mechanism that makes skills portable between assets. If every measurement the player makes is unit-free, volatility intuition transfers for free.

```ts
// lib/ta/normalize.ts
toPct(series, anchorIdx): number[]       // % from anchor
toAtrUnits(series, period): number[]     // price expressed in ATR multiples
atrPct(series, period): number[]         // ATR as % of close — the cross-asset comparator
```

Chart y-axis mode is `'price' | 'pct' | 'atr'`, toggleable on every chart (unlocked in Ch 8, available earlier for levels that set it explicitly).

**The toggle must never change grading.** Verified by test: grade a fixture attempt in all three modes, assert identical `Grade`.

---

## 6. Instrument specs

```ts
// lib/instruments/specs.ts
type InstrumentSpec = {
  id: SeriesId;
  class: 'crypto-spot' | 'equity' | 'futures' | 'fx';
  valuePerPoint: number;    // $ per 1.0 price move, per unit
  lotSize: number;          // 1e-8 crypto | 1 share | 1 contract | 0.01 FX lot
  tick?: number;            // futures tick size
  tickValue?: number;       // futures $ per tick
  quoteCcy: string;
  hours: TradingHours;      // drives gap/session lessons AND backtest bar validity
  typicalSpreadBps: number; // slippage lesson
};
```

The one formula, everywhere:

```ts
riskPerUnit = Math.abs(entry - stop) * spec.valuePerPoint;
units       = roundToLot((equity * riskPct) / riskPerUnit, spec);
```

`hours` deliberately does double duty — it is teaching content (Ch 1.6 gaps, Ch 6.6 sessions) *and* backtest correctness. A gap the game teaches about is the same gap the backtester must not fill inside.

---

## 7. Backtester

`lib/backtest/engine.ts` is a bar-by-bar loop. Two hard rules, both asserted in tests:

1. **No look-ahead.** A decision at bar `i` may only read indices `≤ i`. Tested by spying on the series accessor and failing on any read of `> i`.
2. **No fills inside a market-closed gap.** Uses `spec.hours`. A stop "at" a price the market gapped through fills at the open, not the stop.

Strategy representation:

```ts
type Block =
  | { kind: 'cross';      fast: IndicatorRef; slow: IndicatorRef; dir: 'above'|'below' }
  | { kind: 'compare';    left: IndicatorRef; op: '<'|'>'; right: number | IndicatorRef }
  | { kind: 'structure';  event: 'bos'|'retest'|'swing-high'|'swing-low' }
  | { kind: 'zone';       touching: 'support'|'resistance' }
  | { kind: 'volatility'; atrPct: { op: '<'|'>'; value: number } };   // unlocked by Ch 8

type Strategy = {
  entry: { all: Block[] };
  exit:  { stop: StopRule; target: TargetRule; timeStop?: number };
  risk:  { perTradePct: number };
  scope: { series: SeriesId; from: number; to: number }[];   // multi-asset
};
```

Blocks appear in the Ch 10 composer palette only once their chapter has unlocked them — **the palette is the player's progress made concrete.** Rules are expressed in ATR-relative terms wherever possible, so a strategy is portable across the data spine by construction.

Anti-overfit guards in `lib/backtest/guards.ts`: forced in-sample/out-of-sample split, the ≥2-of-3-asset-classes objective, and a visible variant counter that warns past ~10 attempts.

---

## 8. Persistence

No accounts, no server. One versioned root key.

```ts
const KEY = 'chart-quest';
type Persisted = {
  version: 1;
  profile:     { xp: number; streak: number; lastPlayed: string; settings: Settings };
  progress:    Record<LevelId, { stars: 0|1|2|3; bestScore: number; attempts: number; completedAt: string }>;
  journal:     JournalEntry[];        // includes seriesId + asset class → Ch 9.6 breakdown
  strategies:  SavedStrategy[];
  predictions: Record<LevelId, unknown>;   // e.g. Ch 4.5 win-rate guesses, Ch 1.B score
};
```

- All access wrapped in `try/catch`. Private mode and quota errors degrade to in-memory with **one** non-blocking warning — never a crash.
- `migrate(persisted)` runs on read whenever `version` is behind.
- **Export/import JSON** is a real feature, not a nicety: with no cloud sync it's the only way to move devices, and it protects ten chapters of progress against a cleared cache.

The journal is what makes Ch 9.6 possible — because progress is local, the trade log is genuinely the player's own, so the game can tell them *"you're +0.6R on trend continuation and −0.9R counter-trend; your average loss is 1.4R, not the 1R you set."*

---

## 9. Charting

`lightweight-charts` (Apache-2.0) for the chart, plus an absolutely-positioned overlay canvas for draw tools and grading visuals.

Why not a fully custom renderer: crosshair, log scale, pan/zoom, autoscale and the volume pane come free, and `timeScale().coordinateToTime()` / `series.coordinateToPrice()` provide exactly the price↔pixel conversion draw tools need, so annotations stay locked to the chart through pan and zoom. Replay is incremental `series.update()`.

**Escape hatch:** if one level kind fights the library, drop to a focused Canvas 2D renderer *for that kind only*. Do not rewrite everything.

Coordinate helpers, geometry, and hit-testing live in `lib/chart/` and are pure — testable without a DOM.

---

## 10. Module layout

```
app/
  page.tsx                      # chapter map
  chapter/[n]/page.tsx
  level/[id]/page.tsx           # dispatches on level.kind — no kind-specific logic
  practice/  strategy/  progress/
components/
  chart/        Chart, OverlayCanvas, ReplayControls, IndicatorPane,
                MtfSplit, YAxisModeToggle, CorrelationMatrix
  level-kinds/  Annotate, MarkBars, Classify, PredictNext, ReplayTrade,
                TuneParam, SortRank, SizingCalc, SpotTheFlaw, BuildRules
  feedback/     Diagnosis, ReferenceOverlay, StarBurst
  ui/           (shadcn)
lib/
  ta/           indicators, swings, patterns, normalize, autocorr, correlation
  instruments/  specs, sizing
  levels/       schema, registry, graders/, content/ch1..ch10
  backtest/     engine, metrics, guards
  store/        game, journal, strategies, persist
  chart/        coords, geometry, hit-test
scripts/        fetch-data.ts, compute-base-rates.ts
public/data/    series/*.json, oos/*.json, base-rates.json, manifest.json
```

## 11. Accessibility

Non-negotiable for a chart-driven game:

- Keyboard anchor placement for draw tools (arrow keys + enter)
- Direction encoded by more than red/green — fill and shape too
- `prefers-reduced-motion` honored by the replay engine
- Every `classify` level reachable without a pointer

Target Lighthouse a11y ≥ 95.
