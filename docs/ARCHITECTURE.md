# Architecture

The central problem: **73 levels must not be 73 components.**

The solution is a small set of reusable interaction primitives ("level kinds"). Each kind is one React component plus one pure grader function. Every level is _data_ referencing a slice of a price series. Adding a level means adding a data file, not writing code.

---

## 1. Level kinds

Thirteen kinds cover the whole curriculum.

| Kind            | Interaction                                                                         | Teaches                                            |
| --------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `annotate`      | Drag to draw. Modes: `trendline`, `level`, `zone`, `channel`, `fib`.                | Structure, zones, geometry                         |
| `mark-bars`     | Click candles / ranges. Graded as set overlap, ±n bar tolerance.                    | Pattern spotting, swings, volume events            |
| `classify`      | Chart shown, choose a label. Grounded in a _chart_, never in prose.                 | Regime, pattern ID, breakout vs fakeout            |
| `predict-next`  | Chart truncated at bar N. Commit a direction/target. Reveal animates the real bars. | Humility, probabilistic thinking                   |
| `replay-trade`  | Bar-by-bar replay, play/pause/step. Place entry/stop/target, manage the position.   | Everything real                                    |
| `tune-param`    | Live slider over a parameter. Find the value satisfying a condition.                | Indicator lag, parameter sensitivity, overfitting  |
| `sort-rank`     | Reorder rows with up/down buttons, then reveal the measured ordering.                | Base rates, setup quality, confluence              |
| `sizing-calc`   | Numeric input, graded with tolerance, parameterized by `InstrumentSpec`.            | R-multiples, sizing across instruments, expectancy |
| `spot-the-flaw` | A list of claims about a trade; check the ones that add nothing. Scored with `f1`.  | Anti-patterns, critical reading                    |
| `trade-sequence`| Size N historical trades one at a time, account compounding between them.           | Risk of ruin, streaks, sizing discipline           |
| `probe`         | A control over a statistic computed across the whole data spine, redrawn live.       | Asset character, measuring rather than believing    |
| `build-rules`   | Compose blocks the chapters unlocked → multi-asset backtest → beat doing nothing.   | Chapter 10; the composed strategy *is* the attempt |

Some levels are **composite** — a boss may chain `mark-bars` → `annotate` → `classify` → `predict-next` and average the scores. Composites are expressed as a sequence of kinds, not a new kind.

**Kind components load lazily; kind behaviour does not.** `lib/levels/kinds/behaviour.ts` holds the graders and `perfectAttempt` functions and is imported eagerly, because `LevelPlayer` needs them on every route. `components.ts` maps each kind to a `lazy()` import, so a `classify` level no longer ships the drawing engine, the replay controls and the correlation matrix. This took the level route from 266.0 KB to 199.3 KB gzipped. The cost is that a kind missing from `components.ts` fails only in a browser, behind a `Suspense` boundary — which is why every chapter's e2e suite asserts each of its levels renders past it.

**Four kinds author no target at all**, setting `target: {}`: `predict-next`, `sizing-calc`, `trade-sequence` and — for its exploration levels — `probe`. Their answers are derived from the data or from the contract spec, so there is exactly one source for each and no way for a level file to disagree with its own grader.

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

Chart y-axis mode is `'price' | 'pct' | 'atr'`. Two separate questions decide who sees the control and what mode they open in, and `lib/levels/y-axis.ts` splits them:

```ts
export const Y_AXIS_EVERYWHERE_FROM = 8;
export function yAxisFor(level): { mode?: YAxisMode; toggle: boolean } | undefined;
```

A level opts in through `Level.yAxis`, which also sets its starting mode. **From Chapter 8 the control is on everywhere, including replays of Chapter 1**, because that chapter's subject is that a move's size is only meaningful in its own market's units. Before it, only the levels whose lesson needs the control show it.

**The unlock is a fact about the player, not about the level**, so the progress read lives in `SliceChart` — the one component that already reads the store — and `yAxisFor` contributes only the level's own opinion. An earlier version resolved visibility from `level.chapter` alone, which meant a Chapter 1 level never gained the control however far the player had got. Every unit test passed: the resolver was self-consistently wrong, and an e2e assertion across two pages is what caught it.

The stored preference sets the mode and never the visibility. A saved setting must not make Chapter 2 sprout an unlock it has not reached.

**The toggle must never change grading.** Verified two ways: grade a fixture attempt in all three modes and assert an identical `Grade`, and a source-level test pinning that the mode is applied as a *formatter* rather than by transforming the series. Transforming the data is the obvious implementation, would break every tolerance in the game, and would fail no grader test at all — the graders would stay internally consistent while measuring the wrong thing.

**The formatter belongs to the price series, not to the chart.** `chart.localization.priceFormatter` is chart-wide and therefore relabels every pane, including volume: 8.B shipped a volume axis reading "+1036269330.1%" — a share count run through percent-from-anchor — until it moved onto the candle series' own `priceFormat`.

---

## 6. Instrument specs

```ts
// lib/instruments/specs.ts
type InstrumentSpec = {
  id: SeriesId;
  class: "crypto-spot" | "equity" | "futures" | "fx";
  valuePerPoint: number; // quote currency per 1.0 price move, per unit
  lotSize: number; // 1e-8 crypto | 1 share | 1 contract | 0.01 FX lot
  tick?: number; // futures tick size
  tickValue?: number; // always tick × valuePerPoint; stored so a level can quote it
  quoteCcy: string;
  typicalSpreadBps: number; // slippage lesson
  unitLabel: string; // "BTC" | "shares" | "contracts" | "lots"
  source: string; // where the contract terms come from
};
```

**These are exchange specifications, not measurements, and `source` exists to keep that distinction visible.** Every other number in this codebase is computed from a committed series and re-derived by a test. A contract multiplier cannot be — no amount of price data reveals that COMEX gold is 100 troy ounces — so each spec cites the venue's own definition and Chapter 7's claims test asserts that every instrument a level prices a trade with carries one. A wrong multiplier is invisible on a chart and changes every answer in 7.3 by two orders of magnitude.

What the tests *can* check is internal consistency: that `tickValue` equals `tick × valuePerPoint`, and that a rounded position never exceeds its risk budget.

The one formula, everywhere:

```ts
riskPerUnit = Math.abs(entry - stop) * spec.valuePerPoint;
units = roundToLot((equity * riskPct) / riskPerUnit, spec);
```

`roundToLot` rounds **down**, always. Rounding to nearest would let a position exceed the risk budget it was sized from, which is the one thing the formula exists to prevent. It is also what makes 7.3's gold row answer zero rather than a fraction: one contract risks 3,800 against a 500 budget, so the honest size is none.

`sizePosition` returns `risked` alongside `units` — what the rounded position actually loses if the stop is hit, which is at or under the budget rather than equal to it. `riskOf` answers the reverse question for a position whose size is already stated, which is what 7.1 asks.

Trading hours were specified here in the original plan and are **not implemented**. Nothing needs them yet: the gap lessons (1.6, 7.6, 7.B) read gaps straight off the committed bars, and `simulate` already fills a gapped stop at the open. They belong with the backtester in Chapter 10, where bar validity is a correctness requirement rather than a lesson.

### Asset character: two measurements that need opposite treatment of the same bars

```ts
// lib/ta/autocorr.ts — within-asset
varianceRatio(returns, q): { q; vr; z; n } | null
crossingHorizon(curve, level?): number | null

// lib/ta/cross-asset.ts — between-asset
dayKey(t): number
alignByDate(series, window?): { days; index }
returnCorrelation(assets, aligned, keep?): AssetMatrix
```

A **variance ratio** compares the variance of a q-bar return against q times the variance of a one-bar return: above 1 the moves reinforce, below 1 they cancel, 1.0 is a random walk. It is *within-asset* and must use that market's own consecutive bars — including Bitcoin's weekends, since dropping them changes what a one-day return means for Bitcoin. Log returns, because only they sum, and a variance ratio is the variance of a *sum*. Overlapping windows with the Lo–MacKinlay finite-sample correction, because non-overlapping leaves 23 observations at q=60 over 1,434 bars.

**And the heteroskedasticity-robust z, which changed two levels.** Bitcoin's ratio climbs to 1.41 by ninety bars and is significant at *no* horizon — z=1.7 at its strongest. The only effect in the whole spine that survives a robust test is the index's short-horizon mean reversion, significant across q=2 through q=9. Volatility clustering explains most of the rest, so the chapter shows the z beside every ratio and says plainly that the tidy picture is mostly not evidence.

A **correlation** is between-asset and must align on dates, which is harder than it looks. Every committed daily bar is stamped at its own market's open:

| Series | UTC time-of-day |
| --- | --- |
| BTCUSDT-1d | 0.0h |
| SPY / AAPL / LAKE | 13.5h, 14.5h (EST/EDT) |
| GC-1d | 4.0h, 5.0h |
| **EURUSD-1d** | 0.0h under GMT, **23.0h under BST** — the previous UTC date |

Joining on raw `t` returns **zero rows** for any pair. Joining on the UTC calendar day looks right and files 2,759 euro bars a day early; a draft of Chapter 8 did that and reported the euro three to five times more correlated with the index than it is. The key is `floor((t + 2h) / 24h)` — the smallest shift that fixes the euro and the largest that moves nothing else — and the test pins all three answers so the wrong ones cannot return: 0 rows raw, 1,269 naive, 1,429 correct.

Unmatched days are **dropped, never forward-filled.** Carrying Friday's index close into Saturday to pair with a live Bitcoin bar would invent a correlation.

`lib/ta/correlation.ts` is left alone: it correlates *signals within one asset* for 6.5, which is the transpose with a different index. One function meaning both would leave callers disagreeing about what a row is. The Pearson primitive is shared; only the indexing differs.

Everything Chapter 8 quotes is precomputed into `public/data/asset-character.json` by `npm run data:character`. Two reasons, the second binding: a measurement is not code and only one chapter needs it — and `behaviour.ts` is imported eagerly by every level route, so a grader reaching for the estimators would ship the variance-ratio machinery to `/level/1-1`. `probe/grade.test.ts` asserts the grader imports nothing from `lib/ta`. Nothing in the file is a conclusion: it holds ratios and z-statistics per horizon, and the crossing the level grades on is computed from them at play time.

### Trade management: trailing stops and partials

`TradePlan` carries two optional clauses, and `simulate` returns `finalStop` and `partial` so a level can show where the stop ended up:

```ts
trail?: { afterR: number; distanceR: number };   // start trailing at afterR, stay distanceR behind
partial?: { atR: number; fraction: number };     // take fraction off at atR, run the rest
```

**The trail moves at bar end, never intrabar.** A stop that tightened partway through the bar that reached a new high would be reading the future — the same look-ahead rule the backtester enforces. It is also the difference between a plausible measurement and a flattering one.

The measurement these exist for, 720 trades across six assets with identical entries and initial stops:

| Management               | Total   | Positive |
| ------------------------ | ------- | -------- |
| fixed 2R target          | +69.7R  | 37%      |
| trail 1R behind by 0.5R  | +41.6R  | 49%      |
| trail 2R behind by 1.0R  | +104.2R | 37%      |
| half off at 1R, rest 3R  | +38.4R  | 32%      |
| half off at 1R, trailed  | +17.6R  | 49%      |

A tight trail costs 40% of the return **while raising the share of winning trades from 37% to 49%** — it feels better and earns less, which is 7.7's subject. A late, loose trail is the only variant that beats a plain target. Chapter 7's claims test recomputes every one of these figures, so the level cannot drift from them.

---

## 7. Backtester

### One execution path, and why it is not new code

`lib/backtest/engine.ts` walks a rule through bars — and it is `runEdge`'s loop with the fixed parts made parameters, not a second implementation. Two things that did this already existed when Chapter 10 started: `lib/trade/simulate.ts` resolves a single trade's fills, and `runEdge` in `lib/ta/edges.ts` was a sequential backtester feeding **both** committed measurement artefacts, whose numbers 8.3, 8.5, 8.6, 8.B, 9.3, 9.5 and 9.B quote. A third loop would have disagreed with them quietly, in the fifth decimal, on gapped bars.

So `runEdge` is now an adapter over `runStrategy`, and the refactor's gate was not a passing test suite but a **byte-identical artefact diff**: `npm run data:character && npm run data:sweep` must leave `public/data/` unchanged.

The two hard rules:

1. **No look-ahead**, asserted by **prefix invariance** rather than by spying on the series accessor. A Proxy cannot distinguish the two forward reads the engine legitimately makes — the decision at bar `i` must not look past `i`, but `simulate` walks bars after the entry by design. Truncating the series draws the line exactly: a decision that peeked would change a trade that had already closed.
2. **No fill at a price the market never traded at.** A gap past the stop fills at the **open**. `spec.hours` does not exist and is not needed — filling at the open satisfies the rule structurally, without a trading calendar that could be wrong about a holiday.

Everything is in R. Position sizing is `InstrumentSpec`'s job at the point a player is asked to trade, which is 10.4's subject rather than the engine's.

### Strategy representation

```ts
type Signal =                          // one number per bar; `IndicatorSpec` describes what to *draw*
  | { kind: "close" }
  | { kind: "sma" | "ema" | "rsi" | "atr-pct"; period: number }
  | { kind: "bollinger"; period: number; deviations: number; band: "upper" | "mid" | "lower" }
  | { kind: "macd"; line: "macd" | "signal" | "histogram"; params?: MacdParams };

type Block =
  | { kind: "cross"; fast: Signal; slow: Signal; dir: "above" | "below" }
  | { kind: "compare"; left: Signal; op: "<" | ">"; right: number | Signal }
  | { kind: "structure"; event: "bos-up" | "bos-down" | "swing-high" | "swing-low" | "retest" }
  | { kind: "zone"; touching: "support" | "resistance" }
  | { kind: "volatility"; atrPct: { op: "<" | ">"; value: number } };   // unlocked by Ch 8
```

Two divergences from the original sketch, both forced. It referenced an `IndicatorRef`; the type that exists is `IndicatorSpec`, which describes what to **draw**, and Bollinger and MACD have three lines each — complete for drawing, ambiguous for deciding. And `event: "bos"` had no direction, which a composer that lets the player pick a side cannot leave to be inferred.

`compileEntry(blocks)` is an **`all` conjunction**, and the conservative reading is also the pedagogically right one: Chapter 6 spent a chapter on over-confluence, so a player who stacks five conditions has to watch their trade count collapse. An empty stack fires on **nothing** — "no conditions" is an unfinished strategy, and a vacuous truth would hand out four thousand trades and a plausible expectancy.

Indicators are computed once per series behind a `WeakMap`, not once per bar: `rsi(series, i)` builds its whole series per call, so the naive form is 21 million operations on `SPY-1d`. Reading index `i` out of a prebuilt array is also what makes the predicate structurally unable to look forward — it never chooses an index. `warmupFor(blocks)` derives the history a rule needs, giving smoothed indicators three periods rather than one, because their first *defined* value is not their converged one.

Blocks appear in the composer palette only once their chapter has unlocked them — **the palette is the player's progress made concrete** — and `lib/backtest/palette.ts` declares that mapping with a test behind it, following `lib/levels/skills.ts`. It unlocks on an *attempt* rather than a pass: requiring stars would make the composer a second grading of chapters already graded and leave the weakest players unable to build anything.

### The objective is "beat doing nothing", not "expectancy > 0"

**The measurement that shaped Chapter 10.** With a 2 ATR stop and a 2R target, entering on *every flat bar* returns **+0.265R a trade on the index, +0.395R on Apple, +0.337R on Bitcoin and +0.232R on gold** — four of six markets. Zero is a bar a random entry clears, and every two-block rule tried during development cleared it, including one that is measurably worse than doing nothing. So `Objective.beatBaseline` compares a rule against the same exit with no entry condition, on the same market, over the same window. The comparison runs through the player's own exit, so widening the stop cannot inflate the benchmark — it moves both sides.

`lib/backtest/guards.ts` holds the forced split, the objective and a variant counter that warns past ten attempts. Everything is a pure function over runs; the counter takes the count rather than reading it, because these are what Chapter 10 grades on.

**A verdict of "confirmed" is not available.** The out-of-sample holdback cannot produce thirty trades on any daily series in the spine — 9 on Bitcoin, 21 on the index, 33 on gold at its most generous lookback — so the verdict is `passed | refuted | inconclusive`, and a test asserts the vocabulary never produces "confirmed" or "validated". `inconclusive` being a third outcome is load-bearing: an asset that took eleven trades has not failed, and counting it as one would make 10.7's cross-asset objective a measure of how much history a market happens to have.

Objectives are stated over **per-asset** results and never over a pooled total — 8.5's flawed claim expressed as a return type. `poolMetrics` always returns `perAsset` beside `pooled`, and 10.7 counts distinct asset **classes**, so three equities are one class.

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

The journal is what makes Ch 9.6 possible — because progress is local, the trade log is genuinely the player's own.

### What the journal records, and the discriminator it needed

**Every trade the player commits is logged, not one in six.** Until M9 only `replay-trade` carried a journal hook, so four composite bosses discarded the trade their `replay-trade` stage produced and 7.B's ten sized trades wrote nothing: a perfect playthrough of Chapters 1–8 left **three entries across two asset classes**, and the two classes that appear only in bosses never appeared at all. The hook is now `journalEntries(attempt, level, grade): JournalDraft[]` — plural, an array, no `null`, because a `Draft | Draft[] | null` union pushes a normalisation branch into the dispatcher and every test. It deliberately does not take `data`, or the composite would have to re-grade its steps to build the journal: a second grading pass whose only purpose is to be able to disagree with the first.

`composite/grade.ts` therefore returns `reference: { kind: "steps", steps: OverlaySpec[] }`, one per stage, and `journalEntriesComposite` reads each `replay-trade` stage's own `trade` overlay out of it. That preserves the invariant `replay-trade` already stated — the journal is read off the grade's own overlay rather than recomputed, so the journal and the score card cannot disagree.

**`JournalEntry.planned` is what keeps 9.6 honest.** Of the eighteen entries a full playthrough leaves, ten come from 7.B, where the entry, stop and target were authored and the only decision was size. Pooling those into _"your average loss is 1.4R, not the 1R you set"_ would make it a claim about the author's stops — the exact error Chapter 9 exists to cure. `planned` and `setup` are both optional so pre-M9 saves stay valid and `SCHEMA_VERSION` need not move, the same call `attemptNo` made in M5; undefined reads as planned, because every entry written before M9 came from a level where the plan was the player's.

**`logTrades(entries)` takes a batch, with one `attemptNo` for all of it.** Per entry, 7.B's ten trades would number 1…10 within a single attempt. Ids carry an index because ten entries share an ISO millisecond. And `JOURNAL_LIMIT` eviction is **per attempt, not per entry** — evicting oldest-first by entry can leave five of 7.B's ten in the record, which 9.6 would read as a five-trade run at a ten-trade level.

`lib/levels/journal-coverage.test.ts` walks every authored level, grades its reference attempt and pins what the journal holds: eighteen entries, four asset classes at 2/4/1/11, exactly eight planned. Every number in it was wrong before M9.

### Analytics live in `lib/journal/`, not in the store

`reportOn(journal)` and `disciplineScore(journal)` are pure — no store import, no React. Analytics over the journal is computation, not store code.

Two things the module argues rather than leaving to be discovered. **Expectancy is the mean R, and the textbook formula is not computed beside it**: every trade here risks exactly 1R by construction, so `winRate·avgWin − lossRate·avgLoss` _equals_ the mean, and computing both would create two sources for one number and a way for them to drift. **Max drawdown is of the cumulative R curve, in R** — there is no equity curve, because the trades come from nine levels with different notional accounts and are sequential in none of them, so the label carries its unit rather than inviting a reading as a percentage of an account that never existed.

`UNDERPOWERED_BELOW = 20`, and the report **names** the cells beneath it rather than leaving them to be noticed. The n=1 fx cell is not a defect to hide; it is 9.2's sample-size lesson turned on the player, and the report is built for it.

### The skill radar

`lib/levels/skills.ts` maps each teaching chapter to one of nine axes and takes a tenth, `discipline`, from the journal. Two decisions in it are declarations with a test behind them rather than inferences: **Chapter 10 has no axis**, because the capstone composes all nine and a tenth would score the same skills twice; and **an unattempted axis is `null`, never zero**, because a chapter scored badly and a chapter never opened are the same number of stars and completely different facts.

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
  backtest/     engine, blocks, describe, palette, metrics, guards
  journal/      analytics                 # pure; reads no store, imports no React
  playbook/     export                    # markdown from a run; pure and tested
  store/        game, strategies, persist
  chart/        coords, geometry, hit-test
scripts/        fetch-data.ts, compute-base-rates.ts, compute-edge-sweep.ts
public/data/    series/*.json, oos/*.json, base-rates.json,
                asset-character.json, edge-sweep.json, manifest.json
```

`store/journal` was specified and is not built. Reading the journal back is computation over an array — a report with intervals, per-cell sample sizes and a drawdown curve — and putting it in the store would make it the one part of the analytics that cannot be tested without a store. The store's job is to hold the entries and write them; `lib/journal/analytics.ts` does the rest.

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

Non-negotiable for a chart-driven game, and measured in M11 rather than asserted. **Lighthouse accessibility is 100 with no failing audits** on every route; the target was ≥ 95.

| Guarantee | How it is met, and what holds it |
| --- | --- |
| Every kind completable without a pointer | Native `radio`/`checkbox`/`range`/`number` wherever the kind allows it, and a `role="application"` surface with arrow, shift, enter and escape handling where the interaction is a canvas. `e2e/keyboard.spec.ts` drives eleven cases through real key events — the only thing that makes this a fact rather than a claim. |
| Draw tools from the keyboard | `annotate` moves a cursor by bar, snaps its price to the bar's extreme so a keyboard user lands on wicks rather than nudging a price axis, and announces its position with the date and price. Its `aria-label` teaches the keys, because a focusable box that explains nothing is not operable. |
| Chart data without sight | `lib/chart/summary.ts` → `ChartData`: a summary line plus ~20 evenly spaced bars, never the whole window. A screen reader reads linearly, so 250 rows is a way to make the page unusable while technically providing the data. |
| Direction beyond colour | Fill and shape carry it too — hollow for down. A `CONVENTIONS.md` invariant since M3. |
| `prefers-reduced-motion` | Honoured completely, because there is **exactly one animation site** in the codebase (`ReplayControls`) and no CSS transitions or keyframes anywhere. `useReducedMotion` is tri-state: an explicit in-game choice beats the OS, and `/settings` is where that choice is made. |

**One rule worth stating on its own, because it cost a real defect.** Any third-party library that renders its own DOM into a container we label must have that container `aria-hidden`. `lightweight-charts` lays itself out in a `<table>`; `role="img"` is supposed to make a node a leaf and Chrome exposes the descendants anyway — so a screen reader met the chart's label and then a table of empty cells, on every charted level, from M3 until M11. The label now lives on a wrapper and the library owns an `aria-hidden` child inside it.

The corollary: anything that *should* be reachable must be a **sibling** of that wrapper rather than a child. The data summary is, for exactly this reason.

Measuring it again: `npx lighthouse <url> --only-categories=accessibility --chrome-flags="--headless=new"`, **one route per invocation** — successive runs in a shell loop fail silently on Chrome profile contention.

**Never test keyboard operability with anything but real key events.** Two different tools have now reported this codebase's keyboard support as broken when it was not: a synthetic `KeyboardEvent` dispatched into the page (React's listeners never saw it) and a browser-extension harness driving a window the OS had not focused (the surface reported itself as `document.activeElement` and still received nothing). Both were false negatives, and both are more expensive than they look — the failure claims a working feature is broken, so the temptation is to "fix" code that was already correct. Playwright's `keyboard.press` is the arbiter; that is why `e2e/keyboard.spec.ts` exists rather than a unit test with a mocked event.

---

## 15. Patterns, base rates, and paying for hindsight

`lib/ta/patterns.ts` detects five shapes: `pin-bar`, `doji` and `engulfing` from bar
geometry, `double-top` and `head-and-shoulders` from `findSwings`. Chart patterns are
built on the same swing definition levels 2.1 and 3.3 are graded against, so a pattern
is made of parts the player was taught to find elsewhere.

**Every threshold is an exported named constant.** An SMA has one correct answer and a
pin bar does not, so the choices are stated where they can be argued with, and
`patterns.test.ts` asserts each one with a fixture that satisfies it and one that misses
by a fraction. Loosening `PIN_MAX_BODY` moves every pin-bar figure in the game, which is
why `base-rates.json` records the definition beside the numbers.

### `confirmedAt`, and why it exists

A `PatternHit` carries both `bar` — where the pattern completes, which is what a player
clicks — and `confirmedAt`, the first bar at which it could actually be *known*.

For a candle those are the same: a pin bar is a fact at its own close. For a chart
pattern they differ by `SWING_LOOKBACK`, because the final peak is not a swing high
until four further bars have failed to exceed it — and those four bars are exactly the
ones in which price falls away from a top.

Measuring forward returns from `bar` reported double tops winning **73.2%** of the time
at +1.36 ATR. From `confirmedAt` the same patterns win **47.6%** at −0.13 ATR. The
entire apparent edge was the measurement method. Anything asking what a pattern was
worth must start its clock at `confirmedAt`; 4.4 and 4.6 apply the same discipline to a
*window*, ending at the confirmation bar so the player marks a shape they could have
seen.

### The base-rate artefact

`lib/ta/base-rates.ts` computes; `scripts/compute-base-rates.ts` writes
`public/data/base-rates.json`; `lib/data/load-base-rates.ts` fetches it at runtime.
Computation and verification share one implementation on purpose — a table generated by
one and checked by another only proves the two agree.

- Per pattern, per asset: `n`, `winRate`, `meanFwdAtr`, `ci95`, plus a pooled row.
- Intervals are **Wilson**, not the normal approximation, which produces bounds outside
  [0, 1] at the n=8 cells this table contains.
- Forward return is in **ATR multiples**, because a binary win rate hides magnitude.
- `EURUSD-1d` is excluded: its open is an artefact (see docs/AUTHORING.md), so its
  candle figures would be too.
- `npm run data:rates` regenerates it. `lib/data/base-rates.test.ts` recomputes from the
  committed series and fails on drift — and the script's `main()` sits behind a
  direct-execution check, because a top-level write made that guard regenerate the file
  it was about to compare against.

What the table says is the argument of Chapter 4: every pooled win rate sits between
47.6% and 50.1%, every interval overlaps every other, and no mean forward return reaches
a quarter of an ATR. Sample sizes run 66 to 3,733. There is nothing to rank by
profitability and a great deal to rank by evidence.

---

## 16. Multi-timeframe: resampling, linked feeds, and one transport

Chapter 6 needs two views of the same period. Only Bitcoin has that natively — EURUSD's
hourly series begins two years after its daily ends, and SPY's 15m three years after — so
`EURUSD-4h` and `SPY-1h` are **aggregated from the committed intraday series** rather than
fetched. `npm run data:resample` regenerates them.

`lib/data/resample.ts` takes the first bar's open, the last bar's close, the max high, the
min low and the summed volume. **Whole buckets only**: a day holding four of its six bars
still has a high and a low, and they describe two thirds of a day while reading as a daily
range. Boundaries are stated per bucket — UTC calendar day, UTC clock hour, four-hour blocks
from UTC midnight — which is Binance's convention and therefore why the proof below is exact.
On a US equity session it costs the 09:30–10:00 stub, which is asserted rather than left to be
discovered.

**The correctness argument is a proof, not a fixture.** `BTCUSDT-4h` and `BTCUSDT-1d` are both
committed and both describe the same 931 days, so resampling one into the other has a right
answer nobody wrote down. It matches on open, high, low and close for all 931. Volume matches
only to within 3 units and cannot do better: `columnar.ts` rounds each bar's volume at fetch
time, so the daily figure is one rounding and the six 4h figures are six roundings summed.

### One transport, and the leak it exists to prevent

`lib/replay/linked.ts` makes the lower timeframe drive and derives the higher one's reveal
point from the driver's current moment rather than counting alongside it, so drift is not
representable — a scrub, a reset and a run of single steps all land in the same place.

**The obvious rule leaks the future.** Revealing the follower bar *containing* the driver's
timestamp puts a 4h bar on screen whose open is an hour behind and whose close is three hours
ahead. It looks entirely normal. So a follower bar is revealed only once its whole window has
elapsed, which means the higher pane lags by up to one of its own bars — correct, since the bar
genuinely has not finished. `seal.test.ts` asserts it over all three pairs and over the
authored windows.

`barEnd` asks the series when a bar ends rather than assuming a duration, so an equity Friday
ends when Monday opens. The nominal duration is a fallback for the final bar — and for the
driver's own bar, where `visible()` is truncated and there is no successor to ask, which makes
the conservative answer the only available one.

`LevelPlayer` links a level's feeds when the data says to: two slices of the same instrument at
different bar sizes. Decided from the data rather than the kind, so that file still contains no
branch on `level.kind`. Different instruments are never linked — 1.6 shows three markets and
5.5 shows three, and neither knows when the other's bar closed.

**Slice 0 is the traded timeframe.** `ReplayTrade` places its trade on slice 0 and `simulate`
scores it there, so a multi-timeframe trade level lists the lower timeframe first and renders
the higher one as a context pane above it.
