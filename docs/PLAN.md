# Chart Quest

> **Chart Quest** — learn to read any market, one level at a time.

_The original design plan, kept as the source of truth for scope and for the reasoning behind each decision. Where it disagrees with `ARCHITECTURE.md`, `CURRICULUM.md` or `DATA.md`, those are newer and win._

## Context

A public, account-free website that teaches technical analysis as a **playable puzzle game**. Progress lives only in `localStorage`. The player starts at "what is a candle" and finishes by composing and backtesting their own strategy in-browser, then exporting it as a playbook.

The name was chosen for beginner legibility: a newcomer should guess the subject _and_ the format from the name alone. "Chart" is the word they already have; "Quest" maps onto the real structure of ten chapters with sequential unlocks and bosses. The tagline carries what the name can't — the asset-agnostic promise. Both belong in `<title>`, the landing hero, and the OG card.

**The defining constraint: what the player learns must transfer to any asset.** An earlier draft of this plan centered on crypto for clean 24/7 mechanics. That produced a player who would learn _crypto_-TA and believe they had learned TA — five specific, money-losing blind spots: stops placed inside gap-space, position sizing that only works in fractional spot units, volatility priors calibrated to BTC and applied to SPY, breakout logic applied to a mean-reverting index, and no model of why any of that differs. It also broke the plan's own honesty promise: base rates measured on BTC 2017–2024 and labelled "the pattern's base rate" are the same dishonesty in a nicer wrapper.

So transferability is designed in, not bolted on, via four mechanisms:

1. **Cross-asset bosses.** Every chapter's boss runs on a _different asset than that chapter's levels_. Any asset-specific crutch fails loudly at the gate.
2. **Everything normalized.** A y-axis toggle (price → % → ATR-multiples) means every measurement the player ever makes is already unit-free.
3. **One sizing formula, four instrument specs.** Spot, shares, futures contracts, FX lots — same math, different `valuePerPoint`.
4. **Per-asset base rates.** Patterns show a _distribution across five markets_ with sample sizes and confidence intervals, never a single number. (Five, not six: `EURUSD-1d`'s open is an upstream artefact, so its candle figures would be too — see docs/AUTHORING.md.)

Decisions locked with the user:

| Decision      | Choice                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Chart data    | Bundled real historical OHLCV, committed as static JSON. Offline, deterministic.                               |
| Data spine    | 6 series, contrast-picked so they disagree with each other (§4).                                               |
| Feel          | Playable puzzle game. Every level is an interaction on a chart — draw, click, predict, trade. Minimal reading. |
| Curriculum    | 10 chapters, 73 levels. Asset Character is its own chapter after Risk.                                        |
| Sizing        | Four instrument classes: spot, shares, futures, FX.                                                            |
| Final chapter | Real in-browser backtester; objective requires ≥2 of 3 asset _classes_ to work.                                |

The architectural problem: **73 levels must not be 73 components.** The core of the plan is a small set of reusable interaction primitives plus levels authored as data.

---

## 1. Architecture: 10 level kinds, levels as data

Each level kind = one React component + one pure grader. Levels are data referencing a slice of a series.

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

### Level schema

```ts
// lib/levels/schema.ts
interface Level {
  id: LevelId; // '3-4' | '3-B'
  chapter: number;
  title: string;
  kind: LevelKind;
  brief: string; // one or two sentences, max
  data: { series: SeriesId; from: number; to: number; reveal?: number }[]; // array → MTF & multi-asset levels
  config: KindConfig; // discriminated on `kind`
  target: KindTarget; // reference answer
  tolerance: KindTolerance;
  stars: [number, number, number];
  misconceptions: Misconception[]; // where the teaching actually lives
  unlocks?: ToolId[];
  hints: string[]; // progressive, costs stars
  yAxis?: "price" | "pct" | "atr"; // default; player can toggle unless locked
}

interface Misconception {
  id: string;
  test: (attempt: Attempt, level: Level, data: Series[]) => boolean;
  message: string; // "Your line cuts 2 candle bodies — anchor to wicks."
  showOverlay?: OverlaySpec;
}
```

### Grader contract

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

Graders are pure and deterministic — the highest-value tests in the project.

**Misconceptions matter more than scores.** A grader returning "62%" teaches nothing; one returning _"you anchored to bodies instead of wicks"_ teaches the thing. Every level authors ≥2 misconceptions covering its commonest wrong answers. A level without them should fail review.

---

## 2. Chapter and level breakdown

**10 chapters, 73 levels, all authored.** Bosses need ≥2 stars to unlock the next chapter; regular levels unlock in order. A chapter-select screen lets returning players jump back.

### The cross-asset boss rule

| Ch  | Levels taught on                   | **Boss runs on**          |
| --- | ---------------------------------- | ------------------------- |
| 1   | BTC, SPY, EURUSD (mixed by design) | all three                 |
| 2   | BTC 1d                             | **EURUSD 1d**             |
| 3   | SPY 1d                             | **BTC 4h**                |
| 4   | BTC 1d + AAPL 1d                   | **EURUSD 1h**             |
| 5   | EURUSD 1d                          | **SPY 15m**               |
| 6   | BTC 1d/4h                          | **AAPL 1d + SPY 1d**      |
| 7   | all four instrument classes        | **GC 1d**                 |
| 8   | all six (by definition)            | **unseen regime slice**   |
| 9   | player's own journal               | **3 reports on 3 assets** |
| 10  | player's choice                    | **≥3 asset classes**      |

This is enforced by a test, not by discipline (§7).

---

### Ch 1 — Reading the Chart · _unlocks: crosshair, timeframe switch, log/linear, y-axis mode_

| #       | Level                                                                                                                                                    | Kind            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1.1     | Anatomy of a candle — click the wick, body, open, close                                                                                                  | `mark-bars`     |
| 1.2     | Line vs candles — the line chart hid a 12% wick. Find it.                                                                                                | `classify`      |
| 1.3     | The timeframe illusion — two charts "trending" opposite ways are the same data                                                                           | `classify`      |
| 1.4     | Volume — click the 3 highest-volume bars, see what happened around them                                                                                  | `mark-bars`     |
| 1.5     | Log vs linear — why the 2017 BTC run vanishes on a linear scale                                                                                          | `tune-param`    |
| 1.6     | **Four clocks** — BTC 24/7, EURUSD 24/5, SPY 6.5h. The market closes and price moves anyway → that's a gap, and your stop doesn't protect you across it. | `classify`      |
| 1.7     | **The split trap** — unadjusted AAPL shows a −75% crash in Aug 2020. It never happened.                                                                  | `spot-the-flaw` |
| **1.B** | **BOSS: Coin flip** — predict direction 5× across three different assets. Score lands near 50%.                                                          | `predict-next`  |

> 1.B is deliberate: the first boss proves the player **cannot predict yet**. It sets the humility baseline, and Ch 9 calls this exact score back.
> 1.6 is the single highest-value early addition — it's the gap blind spot, taught before any stop is ever placed.

### Ch 2 — Market Structure · _unlocks: swing detector, trendline tool_

| #       | Level                                                                          | Kind                 |
| ------- | ------------------------------------------------------------------------------ | -------------------- |
| 2.1     | Click every swing high (fractal ±2 bars)                                       | `mark-bars`          |
| 2.2     | HH/HL vs LH/LL across 4 charts                                                 | `classify`           |
| 2.3     | Draw the trendline — graded on touches, wick anchoring, zero body cuts         | `annotate:trendline` |
| 2.4     | Draw the channel                                                               | `annotate:channel`   |
| 2.5     | Break of structure vs deviation — click the bar that actually broke it         | `mark-bars`          |
| 2.6     | Ranges — bound it, then classify range vs trend                                | `annotate:zone`      |
| **2.B** | **BOSS (EURUSD):** mark swings → trendline → classify regime → predict 10 bars | composite            |

### Ch 3 — Zones · _unlocks: horizontal level, rectangle, measure tool_

| #       | Level                                                                                           | Kind             |
| ------- | ----------------------------------------------------------------------------------------------- | ---------------- |
| 3.1     | A level from multiple touches                                                                   | `annotate:level` |
| 3.2     | Why a line is wrong — widen it into a zone                                                      | `annotate:zone`  |
| 3.3     | Click the retest bar                                                                            | `mark-bars`      |
| 3.4     | Breakout or fakeout? 6 mini-charts; reveal shows each one's next 20 bars                        | `classify`       |
| 3.5     | Round numbers and where stops cluster                                                           | `mark-bars`      |
| 3.6     | **Trap:** a textbook-clean break that fails                                                     | `predict-next`   |
| **3.B** | **BOSS (BTC 4h) — your first trade:** mark the zone, place entry/stop/target, replay to outcome | `replay-trade`   |

> 3.B scores **R achieved and stop-placement quality separately.** A profitable trade with a stop in a stupid place gets 1 star. This split runs through every later boss and is the main lever against teaching outcome-chasing.

### Ch 4 — Patterns & Base Rates · _unlocks: pattern library with per-asset stats_

| #       | Level                                                                       | Kind            |
| ------- | --------------------------------------------------------------------------- | --------------- |
| 4.1     | Pin bar, doji, engulfing — find them                                        | `mark-bars`     |
| 4.2     | Context beats pattern — same pin bar in trend vs chop                       | `classify`      |
| 4.3     | Continuation: flag, triangle — draw the boundaries                          | `annotate`      |
| 4.4     | Reversal: double top, head & shoulders — mark the components                | `mark-bars`     |
| 4.5     | **Guess the win rate** of 5 patterns → see it measured across all 6 assets  | `sort-rank`     |
| 4.6     | A perfect pattern that failed — why?                                        | `spot-the-flaw` |
| **4.B** | **BOSS (EURUSD 1h):** scan unseen chart, find the setup, trade it in replay | composite       |

> **4.5 is the chapter's payload, and what it asks changed once the numbers existed.** The plan was: the player guesses (usually 70%+), then sees head & shoulders run 41% on EURUSD and 58% on BTC, with n and a 95% CI wide enough to be visibly untrustworthy. Measured with the shipped detector, the pooled rates for all five patterns fall between **47.6% and 50.1%** with every interval overlapping every other — so there is no ordering to rank and no asset-dependence that is distinguishable from noise. The ranking is by **sample size** instead (66 to 3,733, derivable from the definitions), and the reveal shows that 57× more evidence buys no separation in outcome. The lesson lands as **"the most impressive number in the table is the one with the least behind it"** — still the transferability lesson, and now carrying its own evidence. Rankings are stored and recalled in Ch 9. Full detail in `lib/levels/content/ch4/4-5.ts` and docs/CURRICULUM.md.

### Ch 5 — Indicators · _unlocks: indicator panel, one per level_

| #       | Level                                                                                                                 | Kind            |
| ------- | --------------------------------------------------------------------------------------------------------------------- | --------------- |
| 5.1     | An MA is just smoothed price — drag the period, watch lag appear                                                      | `tune-param`    |
| 5.2     | Find the MA this market actually respected                                                                            | `tune-param`    |
| 5.3     | RSI 80 for 40 bars while price doubles — overbought ≠ sell                                                            | `classify`      |
| 5.4     | MACD is two MAs — click every cross, count how many were noise                                                        | `mark-bars`     |
| 5.5     | **ATR as % of price** — BTC 3%/day is Tuesday, SPY 3%/day is a crisis. Same chart, three assets, y-axis in ATR units. | `tune-param`    |
| 5.6     | Indicator soup — 6 indicators, 6 conflicting signals                                                                  | `spot-the-flaw` |
| **5.B** | **BOSS (SPY 15m):** structure + 2 indicators, entry in replay                                                         | `replay-trade`  |

> 5.5 is the normalization keystone. Once the player thinks in ATR-multiples instead of dollars, volatility intuition transfers between assets for free.

### Ch 6 — Confluence & Multi-Timeframe · _unlocks: MTF split view_

| #       | Level                                                                        | Kind               |
| ------- | ---------------------------------------------------------------------------- | ------------------ |
| 6.1     | HTF bias, LTF entry                                                          | `classify` (split) |
| 6.2     | HTF zone + LTF trigger, both panes live                                      | `replay-trade`     |
| 6.3     | When timeframes disagree                                                     | `classify`         |
| 6.4     | Rank 4 setups by confluence, then reveal outcomes — the top-ranked one loses | `sort-rank`        |
| 6.5     | Over-confluence and analysis paralysis                                       | `spot-the-flaw`    |
| 6.6     | Session context — the opening range exists on SPY and not on BTC             | `mark-bars`        |
| **6.B** | **BOSS (AAPL + SPY):** full MTF replay trade                                 | `replay-trade`     |

### Ch 7 — Risk, R & Sizing · _unlocks: position-size calculator, R overlay_

| #       | Level                                                                                                                    | Kind           |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 7.1     | What 1R is — place entry and stop, read your R                                                                           | `annotate`     |
| 7.2     | Sizing from account, entry, stop, risk % — **BTC fractional**                                                            | `sizing-calc`  |
| 7.3     | **The same trade in four markets** — AAPL whole shares, one ES contract, EURUSD lots. One formula, four `valuePerPoint`. | `sizing-calc`  |
| 7.4     | Structural stop vs arbitrary stop — replay the _same trade_ with both                                                    | `replay-trade` |
| 7.5     | R:R vs required win rate — slider, then test the claim on data                                                           | `tune-param`   |
| 7.6     | **The 6-loss streak** — replay it at 1% risk, then 5%. Watch the account.                                                | `replay-trade` |
| 7.7     | Trailing stops and partials                                                                                              | `replay-trade` |
| **7.B** | **BOSS (GC 1d) — 10 trades:** survive with the account intact. Scored on expectancy, not profit.                         | `replay-trade` |

> 7.3 is what makes this chapter transfer at all. Without it the player can size a BTC trade and nothing else.

### Ch 8 — ★ Asset Character _(new)_ · _unlocks: y-axis normalize toggle, correlation matrix_

| #       | Level                                                                                                                                               | Kind            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 8.1     | **Normalize** — the same 10% move on 6 assets. Toggle price → % → ATR. Which was actually big?                                                      | `tune-param`    |
| 8.2     | **Measure trend-persistence yourself** — run an autocorrelation probe per asset. Crypto persists; the index reverts. You didn't take this on faith. | `tune-param`    |
| 8.3     | **One setup, six assets, six outcomes** — the identical breakout rule on all six                                                                    | `sort-rank`     |
| 8.4     | **Correlation** — your 5 "diversified" longs are one bet. See the matrix, then the joint drawdown.                                                  | `classify`      |
| 8.5     | Regime shift — the same rule through 2017, 2018, 2020, 2022                                                                                         | `spot-the-flaw` |
| 8.6     | Which market fits which edge — match 4 edges to the assets they survive on                                                                          | `sort-rank`     |
| **8.B** | **BOSS (unseen regime slice):** identify the asset's character from the chart alone, then pick and trade the appropriate edge                       | composite       |

> 8.2 matters because it makes asset character **measured, not asserted**. The player runs the probe and reads the number. That's the difference between the game teaching a fact and teaching a method.

### Ch 9 — Edge & Probability · _unlocks: journal analytics_

| #       | Level                                                                                                       | Kind            |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| 9.1     | **Was it worth taking** — expectancy from 24 outcomes, 9 wins, and a positive answer                        | `sizing-calc`   |
| 9.2     | **How much of that was luck** — the binomial for five flips, with your own 1.B accuracy marked on it        | `classify`      |
| 9.3     | **How deep does a good year get** — guess the drawdown of a +51.7R curve, in R, then see it                 | `probe`         |
| 9.4     | **You already know it worked** — the outcome first, then rewind and plan it; the plan alone is scored        | `replay-trade`  |
| 9.5     | **Tune it until it looks brilliant** — sweep 26 lookbacks on four markets; the later window is the reveal    | `probe`         |
| 9.6     | **Your own record** — the journal you actually wrote, split by asset class, and what it will not support     | `classify`      |
| **9.B** | **BOSS:** three backtest reports on three markets — one overfit, one under-sampled, one survivorship-biased | `composite`     |

> 9.5 is the most important level in the game; build it before Ch 10's backtester, because the backtester has to be honest enough to support it.
> 9.6 is only possible _because_ there are no accounts — the journal is genuinely the player's own.
>
> **The kinds above are what shipped, and four of them changed.** `dashboard` was never built — a
> kind that cannot be graded cannot satisfy the winnability guard, so it is a page rather than a
> level. The reasoning for every divergence is in `CURRICULUM.md` under "Where Chapter 9 diverged".
>
> **The headline promise had to be split.** "Your average loss is 1.4R, not the 1R you set" is only
> honest over trades the player planned themselves; ten of the eighteen a full playthrough logs come
> from 7.B, where the stops were authored and only the size was chosen. Those are shown, separately
> and labelled, and no headline figure pools them.

### Ch 10 — Build Your Own Strategy

| #        | Level                                                                                                       | Kind          |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------- |
| 10.1     | **Where to build it** — your record beside the question, and history as the thing that decides              | `classify`    |
| 10.2     | **Something you could be wrong about** — which hypotheses this engine could refute                          | `classify`    |
| 10.3     | **Build the entry** — compose from the blocks your progress unlocked; beat doing nothing on two markets     | `build-rules` |
| 10.4     | **Where it is wrong** — the exit is yours now, and the comparison moves with it                             | `build-rules` |
| 10.5     | **Everything you are allowed to see** — three markets, thirty trades each, all three clearing the baseline  | `build-rules` |
| 10.6     | **What the held-back data can tell you** — your rule on unseen bars, and what nine trades can prove         | `classify`    |
| 10.7     | **Does it travel** — one equity, one commodity, one crypto; two *asset classes* must clear it               | `build-rules` |
| **10.B** | **FINAL: two markets you never tuned on** — a micro-cap and a currency, then the game writes your playbook  | `build-rules` |

> 10.7 is the change that makes the whole game's promise true. "Works on one series" was the old objective and it would have certified overfit strategies as finished work.
>
> **The objective is "beat doing nothing", not "expectancy > 0".** Measured: with a 2 ATR stop and a 2R
> target, entering on every flat bar returns +0.265R a trade on the index, +0.395R on Apple and +0.337R
> on Bitcoin. Zero is a bar a random entry clears, so scoring against it would have certified noise as
> skill in the chapter that is the payoff for Chapter 9.
>
> **And 10.6 asks what the holdback can prove rather than whether the strategy survived**, because the
> holdback produces nine trades on the index. Full reasoning in `CURRICULUM.md` under "Where Chapter 10
> diverged".

---

## 3. Cross-cutting interactive features

Ranked by how much they carry the product.

1. **Replay engine** — bar-by-bar reveal, play/pause/step/speed, future strictly hidden. Powers `predict-next`, `replay-trade`, free-play. Everything else is decoration beside it.
2. **Y-axis normalize toggle** — price / % from anchor / ATR-multiples, on every chart. The mechanism that makes skills asset-portable; also the whole point of 8.1.
3. **Diagnostic feedback** — misconception matching, then the reference answer animated onto the attempt so the player sees the _delta_, not a verdict.
4. **Trade journal → Ch 9 self-analysis.** Every replay trade logs entry/stop/target/exit/R/asset/tags/stated reason. The game later analyses the player's own record, split by asset class.
5. **Progressive tool unlocks** — the toolbar visibly grows. Strong pull, and it stops Ch 2 drowning in 15 unusable buttons.
6. **Per-asset base rates** — `base-rates.json` computed at build time with n and CI per asset, shown as a distribution.
7. **Correlation matrix** (Ch 8+) — live over the bundled spine, used to flag concentrated risk in the composer.
8. **Backtester with anti-overfit guards** — forced in/out-of-sample split, cross-asset requirement, and a visible variant counter that warns past ~10 tries.
9. **Skill radar** — seven axes (structure, zones, patterns, indicators, risk, asset-character, discipline) from level scores; drives "practice this."
10. **Endless drill mode** per skill, against your own best. _Not built — cut from M11 and tracked for after launch. It is the only cross-cutting feature that is neither an accessibility fix nor a launch blocker, and it is the largest; ten complete chapters ship better than nine and a drill mode._
11. **Playbook export** — markdown + PDF. The artifact the player leaves with.
12. **Progress export/import JSON** — no accounts means no cloud sync. Also protects 10 chapters against a cleared cache.

---

## 4. Data spine

Six series, chosen so they **disagree with each other**. Committed, so the app stays fully static.

| Series               | TF      | Character it teaches                                |
| -------------------- | ------- | --------------------------------------------------- |
| `BTCUSDT`            | 1d, 4h  | Crypto · 24/7 · high vol · trend-persistent         |
| `SPY`                | 1d, 15m | Index · sessions · gaps · short-term mean-reverting |
| `AAPL`               | 1d      | Single stock · earnings gaps · splits               |
| `EURUSD`             | 1d, 1h  | FX · 24/5 · low vol · ranging · Sunday gap          |
| `GC` (gold)          | 1d      | Commodity · different volatility regime             |
| _illiquid small-cap_ | 1d      | Spread and slippage                                 |

Sources: Binance public klines for crypto (no key); Stooq/Yahoo for equities, FX, gold. **Equities must be split- and dividend-adjusted** — with one deliberate exception: ship a _raw, unadjusted_ AAPL slice around the Aug 2020 4:1 split so level 1.7 has a real artifact to expose.

Store **columnar, not per-candle objects** (~4× smaller):

```ts
type Series = {
  id: SeriesId;
  tf: Timeframe;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};
```

One file per series+timeframe, lazy-loaded by the levels that need it. Target < 150 KB gzipped each; ~1.5–2 MB committed total.

**Hold back the Ch 10 out-of-sample slices** in separate files no earlier level may load, so 10.6 is genuinely out-of-sample. Enforced by a test.

`scripts/compute-base-rates.ts` emits per-asset stats with sample sizes and CIs:

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

The wide CIs are not a flaw to hide — at n=34 they _are_ the lesson, and Ch 9.2 points straight at them.

---

## 5. Technical approach

### Stack

- **Next.js 16 App Router**, TypeScript, fully client-side, static, on Vercel. No backend, DB, or auth.
- **Charting: `lightweight-charts` (Apache-2.0) + an overlay canvas.** Free crosshair, log scale, pan/zoom, autoscale, volume pane; `timeScale().coordinateToTime()` and `series.coordinateToPrice()` give the price↔pixel conversion draw tools need. Replay is incremental `series.update()`. _Escape hatch:_ if one level kind fights the library, drop to a focused Canvas 2D renderer for that kind only — don't rewrite everything.
- **State: Zustand + `persist`** to `localStorage`, one versioned root key with an explicit migration function.
- **TA + backtest: own pure TS in `lib/ta/`** — SMA, EMA, RSI, MACD, ATR, Bollinger, volume MA, swing detection, autocorrelation (for 8.2), correlation matrix. No dependency, small, testable against fixtures. Backtester is a bar-by-bar loop with **no look-ahead**, asserted in test.
- **Tailwind v4 + shadcn/ui**; **`motion`** for reveal animations. _Neither was adopted._ shadcn was never needed — every control is a native element or a labelled button group, which is how keyboard support stayed free across thirteen kinds ([#30](https://github.com/zkwokleung/chart-quest/issues/30), closed with the accessibility audit as the argument). `motion` was declared, never imported, and removed in M11: the replay is one `requestAnimationFrame` loop and there are no CSS transitions anywhere, which is why `prefers-reduced-motion` could be honoured completely rather than approximately.
- **Vitest** for graders/TA/backtester; **Playwright** smoke per level kind.

### Normalization module

```ts
// lib/ta/normalize.ts
toPct(series, anchorIdx): number[]       // % from anchor
toAtrUnits(series, period): number[]     // price expressed in ATR multiples
atrPct(series, period): number[]         // ATR as % of close — the cross-asset comparator
```

Chart y-axis mode: `'price' | 'pct' | 'atr'`.

### Instrument specs

```ts
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

// the one formula, everywhere
riskPerUnit = Math.abs(entry - stop) * spec.valuePerPoint;
units = roundToLot((equity * riskPct) / riskPerUnit, spec);
```

`hours` doing double duty — teaching content _and_ backtest correctness — is deliberate: a gap the game teaches about is the same gap the backtester must not trade through.

### Strategy blocks (Ch 10)

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

Blocks appear in the palette only once their chapter unlocks them — the composer's palette _is_ the player's progress made concrete. Rules are expressed in ATR-relative terms wherever possible, so a strategy is portable across the spine by construction.

### localStorage

```ts
const KEY = "chart-quest"; // single versioned root key
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
  predictions: Record<LevelId, unknown>; // e.g. 4.5 win-rate guesses, 1.B score
};
```

All access wrapped in try/catch — private mode and quota errors degrade to in-memory with one non-blocking warning, never a crash. Migration runs on read when `version` is behind.

### Accessibility

Non-negotiable for a chart game: keyboard anchor placement for draw tools (arrows + enter), direction encoded by more than red/green (fill + shape), `prefers-reduced-motion` honored by the replay engine, every `classify` level reachable without a pointer.

### Integrity guardrails

No claim that TA predicts or guarantees anything. Every pattern shows its per-asset base rate with sample size. Visible "not financial advice". Levels 1.B, 4.5, 8.3, 9.2 and 9.5 exist specifically to teach the player to distrust their own results.

---

## 6. Repo layout

All paths relative to the repository root.

```
app/
  page.tsx                      # chapter map
  chapter/[n]/page.tsx   level/[id]/page.tsx      # dispatches on level.kind
  strategy/  progress/  settings/   # `practice/` awaits the drill mode; see above
components/
  chart/        Chart, OverlayCanvas, ReplayControls, IndicatorPane,
                MtfSplit, YAxisModeToggle, CorrelationMatrix
  level-kinds/  Annotate, MarkBars, Classify, PredictNext, ReplayTrade,
                TuneParam, SortRank, SizingCalc, SpotTheFlaw, BuildRules
  feedback/     Diagnosis, ReferenceOverlay, StarBurst
lib/
  ta/           indicators, swings, patterns, normalize, autocorr, correlation
  instruments/  specs, sizing
  levels/       schema, graders/, content/ch1..ch10
  backtest/     engine, metrics, guards
  store/        game, journal, strategies, persist
  chart/        coords, geometry, hit-test
scripts/        fetch-data.ts, compute-base-rates.ts
public/data/    series/*.json, oos/*.json, base-rates.json, manifest.json
```

---

## 7. Phasing

**All eleven phases are complete, gated and deployed.** The table is kept as written, before any of it existed, because the gaps between an intended gate and what the work actually found are the useful part — `CURRICULUM.md` records the divergences per chapter, and several invariants in `CONVENTIONS.md` exist because a phase measured something and got a different answer than this table expected.

Each phase ends at a verification gate and waits for approval. Flagging honestly: **Phases 1–2 exceed the 5-file limit** — greenfield scaffolding and the data pipeline can't split below a working vertical slice without leaving the repo unbuildable. Later phases respect it.

| Phase | Scope                                                                                                                             | Gate                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1     | Scaffold: `create-next-app --yes` (package name `chart-quest`), TS + Tailwind + Zustand persist, chart wrapper, one chart renders | `tsc`, `eslint`, chart visible                                                                    |
| 2     | Data pipeline: fetch all 6 series, columnar format, adjusted+raw AAPL, manifest, loader, OOS holdback                             | All series load; sizes within target; OOS files isolated                                          |
| 3     | Level engine: schema, registry, dispatch, star/XP store, `classify` + `mark-bars` + graders + tests                               | Vitest green; Ch 1 playable end-to-end                                                            |
| 4     | Draw tools: overlay canvas, coords/hit-test, `annotate` + geometric grader + misconceptions                                       | Ch 2 playable; trendline grading correct on fixtures                                              |
| 5     | Replay engine + `predict-next` + `replay-trade` + journal writes                                                                  | Ch 3 playable incl. boss; no look-ahead leak (asserted)                                           |
| 6     | `lib/ta/` indicators + `normalize` + y-axis toggle + `tune-param`; `compute-base-rates`                                           | Indicators match fixtures; base-rates.json has ≥3 assets/pattern                                  |
| 7     | `lib/instruments/` specs + sizing; `sort-rank`, `sizing-calc`, `spot-the-flaw`; content Ch 4–7                                    | 7.3 correct for all four instrument classes; Ch 4–7 playable                                      |
| 8     | Ch 8: autocorrelation probe, correlation matrix, asset-character content                                                          | 8.2 reproduces known per-asset persistence figures                                                |
| 9     | Journal analytics, skill radar, Ch 9 content                                                                                      | 9.6 reads real journal data, split by asset class                                                 |
| 10    | Backtest engine + composer + `build-rules` + Ch 10 + playbook export                                                              | Matches a hand-computed fixture; multi-asset objective enforced; OOS verifiably untouched earlier |
| 11    | Polish: a11y pass, reduced motion, export/import, deploy                                                                          | Playwright green; Lighthouse a11y ≥ 95; preview deployed                                          |

Content authoring (Phases 7–9) is the one place worth parallelizing across contributors, one chapter each, since levels are independent data files.

---

## 8. Verification

- `npx tsc --noEmit` and `npx eslint . --quiet` at every gate. If either isn't configured yet, say so rather than claiming success.
- `npx vitest run` — graders, indicators, sizing, backtester. Must-pass properties:
  - every grader is pure and deterministic;
  - the backtester never reads a bar index > current (spy on the series accessor);
  - the backtester never fills inside a market-closed gap (uses `spec.hours`);
  - **every level's own `target` scores 3 stars through its own grader** — catches broken authoring across all 73 levels cheaply;
  - **every chapter boss uses a different `SeriesId` than that chapter's levels** — the cross-asset rule enforced mechanically;
  - **no level in Ch 1–9 references a file under `public/data/oos/`**;
  - every pattern in `base-rates.json` has ≥3 assets and a reported `n`;
  - `compute-base-rates` output is reproducible from committed data.
- `npx playwright test` — one level per kind, a full Ch 1 run, and a reload-mid-chapter persistence test.
- Manual, in a browser: play Ch 1 → Ch 3 boss, clear `localStorage` mid-run to confirm graceful degradation, check one level keyboard-only, and confirm the y-axis toggle changes nothing about grading.

## 9. Open items for Phase 1–2

All eleven phases are complete and deployed. Three of these four questions were answered by building; `DATA.md` carries the detail.

- ~~Which illiquid small-cap for the spread/slippage lesson~~ → **`LAKE`** (Lakeland Industries). Full 2005–2026 history, median volume around 18,500 shares, plus a real 2014 news spike that puts thin-book, gap and slippage risk on one chart.
- ~~Exact date ranges per series~~ → **daily from 2005**, reaching four distinct regimes (2007–09, 2015–16, COVID, the 2022 rate-hike grind). Intraday is whatever upstream will serve.
- ~~Whether ES futures data is obtainable, or a synthetic spec over SPY~~ → **neither: `GC-1d`, real COMEX Gold**, against the published CME specification. Gold was already in the spine for its volatility regime, so the futures case cost no bundle.
- **Star thresholds still need playtest calibration.** Authored loose and never tightened, because the calibration wants real play data and this project collects none by design. Tracked in [#32](https://github.com/zkwokleung/chart-quest/issues/32); the export feature added in M11 is the way to gather it, since a save file carries `stars`, `bestScore` and `attempts` per level.
