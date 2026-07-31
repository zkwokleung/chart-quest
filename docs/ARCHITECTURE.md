# Architecture

The central problem: **~73 levels must not be ~73 components.**

The solution is a small set of reusable interaction primitives ("level kinds"). Each kind is one React component plus one pure grader function. Every level is _data_ referencing a slice of a price series. Adding a level means adding a data file, not writing code.

---

## 1. Level kinds

Ten kinds cover the whole curriculum.

| Kind            | Interaction                                                                         | Teaches                                            |
| --------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `annotate`      | Drag to draw. Modes: `trendline`, `level`, `zone`, `channel`, `fib`.                | Structure, zones, geometry                         |
| `mark-bars`     | Click candles / ranges. Graded as set overlap, ±n bar tolerance.                    | Pattern spotting, swings, volume events            |
| `classify`      | Chart shown, choose a label. Grounded in a _chart_, never in prose.                 | Regime, pattern ID, breakout vs fakeout            |
| `predict-next`  | Chart truncated at bar N. Commit a direction/target. Reveal animates the real bars. | Humility, probabilistic thinking                   |
| `replay-trade`  | Bar-by-bar replay, play/pause/step. Place entry/stop/target, manage the position.   | Everything real                                    |
| `tune-param`    | Live slider over a parameter. Find the value satisfying a condition.                | Indicator lag, parameter sensitivity, overfitting  |
| `sort-rank`     | Drag to order, then reveal the true ordering.                                       | Base rates, setup quality, confluence              |
| `sizing-calc`   | Numeric input, graded with tolerance, parameterized by `InstrumentSpec`.            | R-multiples, sizing across instruments, expectancy |
| `spot-the-flaw` | A finished bad trade or a backtest report; identify what's wrong.                   | Anti-patterns, critical reading                    |
| `build-rules`   | Block composer → multi-asset backtest → hit an objective.                           | Chapter 10                                         |

Some levels are **composite** — a boss may chain `mark-bars` → `annotate` → `classify` → `predict-next` and average the scores. Composites are expressed as a sequence of kinds, not a new kind.

---

## 2. Level schema

```ts
// lib/levels/schema.ts
interface Level {
  id: LevelId; // '3-4' | '3-B'
  chapter: number;
  title: string;
  kind: LevelKind;
  brief: string; // one or two sentences, max
  data: { series: SeriesId; from: number; to: number; reveal?: number }[]; // array → MTF & multi-asset
  config: KindConfig; // discriminated on `kind`
  target: KindTarget; // the reference answer
  tolerance: KindTolerance;
  stars: [number, number, number]; // score thresholds for 1/2/3 stars
  misconceptions: Misconception[]; // REQUIRED, min 2 — see §4
  unlocks?: ToolId[];
  hints: string[]; // progressive, costs stars
  yAxis?: "price" | "pct" | "atr"; // default mode; player may toggle unless locked
}
```

`data` is an array so multi-timeframe levels (Ch 6) and multi-asset levels (Ch 8) need no special case. Single-chart levels carry a one-element array.

`from`/`to` are **bar indices** into the series, not dates. Indices are stable because the series files are immutable once committed; a data refresh is a breaking change requiring a level audit (see [`DATA.md`](DATA.md)).

---

## 3. Grader contract

```ts
type Grade = {
  score: number; // 0..1
  stars: 0 | 1 | 2 | 3;
  diagnosis: Misconception[]; // matched, most specific first
  reference: OverlaySpec; // animated onto the player's attempt
};

type Grader<K extends LevelKind> = (
  attempt: Attempt<K>,
  level: Level & { kind: K },
  data: Series[],
) => Grade;
```

Graders are **pure and deterministic**. No `Date.now()`, no `Math.random()`, no DOM, no store access. This makes them the highest-value and cheapest-to-test code in the project.

Registry: `lib/levels/graders/index.ts` maps `LevelKind → Grader`. The level page dispatches on `level.kind`; it never contains kind-specific logic.

---

## 4. Misconceptions: where the teaching actually lives

```ts
interface Misconception {
  id: string;
  test: (attempt: Attempt, level: Level, data: Series[]) => boolean;
  message: string; // "Your line cuts 2 candle bodies — anchor to wicks."
  showOverlay?: OverlaySpec; // draw the correction on their attempt
}
```

A grader that returns `0.62` teaches nothing. A grader that returns _"you anchored to bodies instead of wicks"_ teaches the thing. This is the single most important design decision in the codebase.

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
  class: "crypto-spot" | "equity" | "futures" | "fx";
  valuePerPoint: number; // $ per 1.0 price move, per unit
  lotSize: number; // 1e-8 crypto | 1 share | 1 contract | 0.01 FX lot
  tick?: number; // futures tick size
  tickValue?: number; // futures $ per tick
  quoteCcy: string;
  hours: TradingHours; // drives gap/session lessons AND backtest bar validity
  typicalSpreadBps: number; // slippage lesson
};
```

The one formula, everywhere:

```ts
riskPerUnit = Math.abs(entry - stop) * spec.valuePerPoint;
units = roundToLot((equity * riskPct) / riskPerUnit, spec);
```

`hours` deliberately does double duty — it is teaching content (Ch 1.6 gaps, Ch 6.6 sessions) _and_ backtest correctness. A gap the game teaches about is the same gap the backtester must not fill inside.

---

## 7. Backtester

`lib/backtest/engine.ts` is a bar-by-bar loop. Two hard rules, both asserted in tests:

1. **No look-ahead.** A decision at bar `i` may only read indices `≤ i`. Tested by spying on the series accessor and failing on any read of `> i`.
2. **No fills inside a market-closed gap.** Uses `spec.hours`. A stop "at" a price the market gapped through fills at the open, not the stop.

Strategy representation:

```ts
type Block =
  | {
      kind: "cross";
      fast: IndicatorRef;
      slow: IndicatorRef;
      dir: "above" | "below";
    }
  | {
      kind: "compare";
      left: IndicatorRef;
      op: "<" | ">";
      right: number | IndicatorRef;
    }
  | { kind: "structure"; event: "bos" | "retest" | "swing-high" | "swing-low" }
  | { kind: "zone"; touching: "support" | "resistance" }
  | { kind: "volatility"; atrPct: { op: "<" | ">"; value: number } }; // unlocked by Ch 8

type Strategy = {
  entry: { all: Block[] };
  exit: { stop: StopRule; target: TargetRule; timeStop?: number };
  risk: { perTradePct: number };
  scope: { series: SeriesId; from: number; to: number }[]; // multi-asset
};
```

Blocks appear in the Ch 10 composer palette only once their chapter has unlocked them — **the palette is the player's progress made concrete.** Rules are expressed in ATR-relative terms wherever possible, so a strategy is portable across the data spine by construction.

Anti-overfit guards in `lib/backtest/guards.ts`: forced in-sample/out-of-sample split, the ≥2-of-3-asset-classes objective, and a visible variant counter that warns past ~10 attempts.

---

## 8. Persistence

No accounts, no server. One versioned root key.

```ts
const KEY = "chart-quest";
type Persisted = {
  version: 1;
  profile: {
    xp: number;
    streak: number;
    lastPlayed: string;
    settings: Settings;
  };
  progress: Record<
    LevelId,
    {
      stars: 0 | 1 | 2 | 3;
      bestScore: number;
      attempts: number;
      completedAt: string;
    }
  >;
  journal: JournalEntry[]; // includes seriesId + asset class → Ch 9.6 breakdown
  strategies: SavedStrategy[];
  predictions: Record<LevelId, unknown>; // e.g. Ch 4.5 win-rate guesses, Ch 1.B score
};
```

- All access wrapped in `try/catch`. Private mode and quota errors degrade to in-memory with **one** non-blocking warning — never a crash.
- `migrate(persisted)` runs on read whenever `version` is behind.
- **Export/import JSON** is a real feature, not a nicety: with no cloud sync it's the only way to move devices, and it protects ten chapters of progress against a cleared cache.

The journal is what makes Ch 9.6 possible — because progress is local, the trade log is genuinely the player's own, so the game can tell them _"you're +0.6R on trend continuation and −0.9R counter-trend; your average loss is 1.4R, not the 1R you set."_

---

## 9. Charting

`lightweight-charts` (Apache-2.0) for the chart, plus an absolutely-positioned overlay canvas for draw tools and grading visuals.

Why not a fully custom renderer: crosshair, log scale, pan/zoom, autoscale and the volume pane come free, and `timeScale().coordinateToTime()` / `series.coordinateToPrice()` provide exactly the price↔pixel conversion draw tools need, so annotations stay locked to the chart through pan and zoom. Replay is incremental `series.update()`.

**Escape hatch:** if one level kind fights the library, drop to a focused Canvas 2D renderer _for that kind only_. Do not rewrite everything.

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

## 11. The replay feed, and what the seal proves

Kind components never receive a `Series`. They receive one `ReplayFeed` per slice,
and the series itself lives in a closure `createFeed` owns.

```ts
// lib/replay/feed.ts
type ReplayFeed = {
  readonly at: number; // absolute index of the last revealed bar
  readonly last: number; // the final bar this feed will ever reveal
  visible(): Series; // arrays cut at `at`; absolute indices intact
  step(n?): void;
  seek(bar): void; // scrubbing, both directions
  subscribe(fn): () => void;
};
```

`visible()` truncates the arrays rather than re-basing them at the window start, so
an absolute bar index still means what the level file said it means. Re-basing would
have shifted every index across the authored levels and reopened the off-by-`from`
trap that bit `mark-bars` and the drawing primitive.

**The invariant, stated precisely.** `visible()` is both the only way to read bars
and the only thing the chart renders, so _what a component can read is exactly what
the player can see_. Advancing a feed is not a leak — it shows the player those bars
too. What is ruled out is reading unrevealed bars while displaying fewer, which is
how a `predict-next` kind would come to know the answer before the call was locked in.
`lib/replay/seal.test.ts` asserts it over every authored level.

**What it does not prove.** Nothing about the network. Whole series files are fetched
and shared across levels by design, so a player with devtools can read any bar of any
committed series. Chapter 10's holdback is the strong guarantee — separate files no
level can name, enforced at the type level by `OosSeriesId`. This is the weaker,
in-process one, and saying so here is deliberate.

**One intentional hole.** `KindProps.truth` hands full series to `composite` alone,
because a boss grades each stage as the player finishes it and grading a
`predict-next` stage means knowing what happened next. The seal test asserts no other
kind receives it.

Two things the kinds declare rather than the player inferring, so `LevelPlayer` never
branches on `level.kind`: `revealHorizon` (how far past the slice a kind may reveal —
`classify`'s `revealBars`, `predict-next`'s horizon) and `primedBars` (how much starts
visible, which only a trade level shrinks, because its slice must _contain_ the
outcome the grader scores).

**Replay redraws with `setData`, not `series.update()`**, which supersedes the note in
`docs/PLAN.md`. `update()` requires each appended bar to be strictly newer, making a
rewind impossible, and a replay you cannot scrub backwards is not a teaching tool.
Slices are a few hundred bars at at most twenty reveals a second, so the rebuild cost
is irrelevant.

## 12. Indicators and the y-axis

Indicator _shape_ and indicator _values_ are separate, and the split is load-bearing.
`indicatorShape(spec)` says how many lines an indicator has, which pane it belongs in
and what reference lines it carries, all without touching data;
`computeIndicator(spec, series)` fills the values in. Series are created once with the
chart's lifetime, values are pushed on every reveal, and a `tune-param` slider
therefore redraws a moving average without tearing down and rebuilding every series
each frame. `indicatorLayoutKey` is what tells the two apart.

Overlays share the price pane. RSI and MACD take one each, after volume's — they
cannot share a price scale without flattening the candles into a line. All of them
are created in the chart-lifetime effect for the reason the volume series is: the M2
renderer crash was a cleanup running against an already-removed chart.

Indicators are computed **from `feed.visible()`**, so the look-ahead seal covers
derived data for free — an average cannot include bars the player has not seen.
`seal.test.ts` asserts it, including that the last revealed value does not shift when
more bars arrive, because "compute once up front and slice later" is the optimisation
that would silently break it.

**The y-axis mode is a label formatter and nothing else.** `Chart` rewrites the axis
labels through `priceFormatter`; the series keeps raw prices, so drawings,
hit-testing, the pane primitive and every grader carry on in the units they were
written for. That makes "normalization never changes grading" structural rather than
a convention someone has to remember, and a source-level test in `normalize.test.ts`
pins it down — because transforming the data would fail no grader test at all. The
graders would stay internally consistent, just consistently measuring the wrong thing.

It is exact rather than approximate because both transforms are **affine** in price:
percent-from-anchor subtracts a fixed anchor, ATR-multiples divides by a fixed unit,
and a linear axis relabelled by an affine function is still a correct axis. A
non-affine mode could not be done this way and would have to move the data.

### What a level's score measures

`annotate` scores a trendline on touches, body cuts and anchor placement. For a
`level` or a `zone` it scores **swing reversals** inside the tolerance instead, and
drops the cut and anchor components entirely — a horizontal line that price keeps
returning to must cross bodies, and there are no anchors to misplace. Counting bar
touches there was nearly constant across the whole answer space: level 3.1 scored
three stars with its line lifted 40% of the window's range. The perturbation sweep in
`score-distribution.test.ts` is what found it.

## 13. The client bundle, and where it runs out

Measured after Chapter 2, not projected: **every level route loads the identical
11 chunks.** `/level/1-1`, `/level/2-3` and `/level/2-B` are byte-for-byte the
same 257 KB gzipped, because the level registry is a client module that statically
imports all content — so every level ships the whole curriculum.

That means bundle cost grows with the number of levels rather than with the page,
and the arithmetic is not comfortable. Fifteen levels of content are ~16 KB
gzipped; 73 levels extrapolate to ~78 KB, which would take a level route past
320 KB. **The 275 KB budget in `scripts/check-bundle.ts` should be reached around
Chapter 4 or 5** and CI will say so.

The structural answer is to load content per level — `import(\`./content/\${id}.ts\`)`
keyed by level id, so a route carries its own level and not the other 72. It is
deliberately _not_ done yet: it trades a static import for an async one in the
level player's loading path, and doing that before the replay engine exists means
doing it twice. When CI fails the budget, that is the fix, not a bigger number.

## 14. Accessibility

Non-negotiable for a chart-driven game:

- Keyboard anchor placement for draw tools (arrow keys + enter)
- Direction encoded by more than red/green — fill and shape too
- `prefers-reduced-motion` honored by the replay engine
- Every `classify` level reachable without a pointer

Target Lighthouse a11y ≥ 95.
