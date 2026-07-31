# Curriculum

**10 chapters, ~73 levels.** Bosses need ≥2 stars to unlock the next chapter; regular levels unlock in order. A chapter-select screen lets returning players jump back.

---

## The cross-asset boss rule

Every chapter's boss runs on a **different asset than that chapter's levels**. This is the transfer guarantee — any asset-specific crutch fails loudly at the gate rather than silently persisting until the player's first real trade.

| Ch  | Levels taught on                   | **Boss runs on**          |
| --- | ---------------------------------- | ------------------------- |
| 1   | BTC, SPY, EURUSD (mixed by design) | all three                 |
| 2   | BTC 1d                             | **EURUSD 1d**             |
| 3   | SPY 1d                             | **BTC 4h**                |
| 4   | BTC 1d + AAPL 1d                   | **EURUSD 1h**             |
| 5   | EURUSD 1d, BTC 1d, SPY 1d          | **SPY 15m**               |
| 6   | BTC 1d/4h                          | **AAPL 1d + SPY 1d**      |
| 7   | all four instrument classes        | **GC 1d**                 |
| 8   | all six (by definition)            | **unseen regime slice**   |
| 9   | player's own journal               | **3 reports on 3 assets** |
| 10  | player's choice                    | **≥3 asset classes**      |

Enforced by test, not discipline: `every chapter boss uses a different SeriesId than that chapter's levels`.

---

## Ch 1 — Reading the Chart

_unlocks: crosshair, timeframe switch, log/linear, y-axis mode_

| #       | Level                                                                                                                                                    | Kind           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1.1     | Anatomy of a candle — click the wick, body, open, close                                                                                                  | `mark-bars`    |
| 1.2     | Line vs candles — the line chart hid a 12% wick. Find it.                                                                                                | `classify`     |
| 1.3     | The timeframe illusion — two charts "trending" opposite ways are the same data                                                                           | `classify`     |
| 1.4     | Volume — click the 3 highest-volume bars, see what happened around them                                                                                  | `mark-bars`    |
| 1.5     | Log vs linear — why the 2017 BTC run vanishes on a linear scale                                                                                          | `classify`     |
| 1.6     | **Four clocks** — BTC 24/7, EURUSD 24/5, SPY 6.5h. The market closes and price moves anyway → that's a gap, and your stop doesn't protect you across it. | `classify`     |
| 1.7     | **The split trap** — unadjusted AAPL shows a −75% crash in Aug 2020. It never happened.                                                                  | `classify`     |
| **1.B** | **BOSS: Coin flip** — predict direction 5× across three different assets. Score lands near 50%.                                                          | `predict-next` |

> **1.B is deliberate.** The first boss proves the player _cannot predict yet_. It sets the humility baseline the whole game is measured against, and Ch 9.2 calls this exact score back.
>
> **1.6 is the highest-value early level.** Gap blindness is the most expensive thing a crypto-only curriculum teaches. It goes in before any stop is ever placed.

## Ch 2 — Market Structure

_unlocks: swing detector, trendline tool_

| #       | Level                                                                          | Kind                 |
| ------- | ------------------------------------------------------------------------------ | -------------------- |
| 2.1     | Click every swing high (fractal ±2 bars)                                       | `mark-bars`          |
| 2.2     | HH/HL vs LH/LL across 4 charts                                                 | `classify`           |
| 2.3     | Draw the trendline — graded on touches, wick anchoring, zero body cuts         | `annotate:trendline` |
| 2.4     | The other side — draw the falling resistance line                              | `annotate:trendline` |
| 2.5     | Break of structure vs deviation — click the bar that actually broke it         | `mark-bars`          |
| 2.6     | Ranges — bound it, then classify range vs trend                                | `annotate:zone`      |
| **2.B** | **BOSS (EURUSD):** mark swings → trendline → classify regime → predict 10 bars | composite            |

> **2.4 draws a resistance line rather than a channel.** No parallel offset catches a single high in that window — the highs fall while the lows rise, making it a contracting triangle rather than a channel. The two lines together explain the breakout that followed, which is a better lesson than a shape the data does not contain. The `channel` shape stays implemented and unit-tested for a level that needs it.
>
> **2.3's window is a range, not an uptrend.** Its swing highs run 9950 → 10380 → 9993 → 9589 → 9292, only 63% rising. The floor lifts while the ceiling does not, which is exactly why the support line is worth drawing — but the brief must not call it a trend, and a content-claims test enforces that.

## Ch 3 — Zones

_unlocks: horizontal level, rectangle, measure tool_

| #       | Level                                                                                    | Kind             |
| ------- | ---------------------------------------------------------------------------------------- | ---------------- |
| 3.1     | A level from multiple touches                                                            | `annotate:level` |
| 3.2     | Why a line is wrong — widen it into a zone                                               | `annotate:zone`  |
| 3.3     | Click the retest bar                                                                     | `mark-bars`      |
| 3.4     | Breakout or fakeout? 6 mini-charts; reveal shows each one's next 20 bars                 | `classify`       |
| 3.5     | Round numbers and where stops cluster                                                    | `mark-bars`      |
| 3.6     | **Trap:** a textbook-clean break that fails                                              | `predict-next`   |
| **3.B** | **BOSS (BTC 4h) — your first trade:** place stop/target on a pullback, replay to outcome | `replay-trade`   |

> **3.B scores R achieved and stop-placement quality separately.** A profitable trade with a stop in a stupid place gets 1 star. This split runs through every later boss and is the main lever against teaching outcome-chasing.
>
> **3.B trades a pullback, not a retest of a horizontal zone.** The window's candidate level was touched exactly once before price broke it two bars later, so treating it as tested structure would have been inventing a story the chart does not tell. What BTC-4h March 2023 actually holds is a 35% run, a pullback to 23,976, and a continuation — and the structure the stop must respect is that pullback low. The `zone` shape stays implemented and is used by 3.2.
>
> **A boss window has to be simulated before it is locked.** 3.B was first authored on BTC-4h bar 4240, where a stop given proper room beyond structure _loses_ while one crammed onto the swing low wins — the exact inverse of the lesson. Bar 4819 was chosen because the score surface rewards the behaviour being taught: a stop on the obvious low is taken out at +3 bars, and anything with a tenth of an ATR of room reaches 2R. Simulating that surface across a grid of plausible player stops is now part of authoring a trade level, not an optional check.
>
> **3.3 moved windows for the same class of reason.** It was first authored on the 2009 break of 87.65, reported by a data scan as "four visits then a break" — but the visits lay in a 200-bar lookback the level never showed, and inside the window price was already above the level throughout. A level's claims have to be visible on the chart it displays, which is now asserted per level rather than trusted.

## Ch 4 — Patterns & Base Rates

_unlocks: pattern library with per-asset stats_

| #       | Level                                                                 | Kind        |
| ------- | --------------------------------------------------------------------- | ----------- |
| 4.1     | Pin bar, doji, engulfing — find them (and the bars that nearly are)   | `mark-bars` |
| 4.2     | The same candle, twice — one ran, one collapsed                       | `classify`  |
| 4.3     | Continuation: the falling ceiling of a bear flag — draw it            | `annotate`  |
| 4.4     | Reversal: head & shoulders — mark the three peaks                     | `mark-bars` |
| 4.5     | **Rank the patterns by evidence**, then see every win rate            | `sort-rank` |
| 4.6     | A perfect pattern that failed — why?                                  | `classify`  |
| **4.B** | **BOSS (LAKE 1d):** find the setup on an unseen market, then trade it | composite   |

> **4.5 is still the chapter's payload, and it asks a different question than planned.**
> The specified version had the player rank five patterns by win rate and discover the
> rates were lower and more asset-dependent than they guessed. Measured with the shipped
> detector across five markets, the pooled rates are 47.6%–50.1% — a 2.5 point spread
> with every 95% interval overlapping every other. There is no ordering there to be right
> about, and ranking it would be the "metric that is nearly constant across the answer
> space" fault that sank three earlier levels.
>
> So the ranking is by **sample size**, which spans 66 to 3,733 and is derivable from the
> rules taught in 4.1. The reveal then shows that 57× more evidence buys no separation in
> outcome at all, and that head & shoulders — rarest and most storied — reads 26.7% on
> gold and 66.7% on LAKE from fifteen and eighteen examples. The lesson lands as *"the
> most impressive number in the table is the one with the least behind it"*, and the
> ranking is stored for Ch 9.

### Where Chapter 4 diverged from this plan, and why

Each is recorded in full in the level's own file.

- **4.2** was to show that context beats pattern: trend good, chop bad. Apple's bullish
  pin bars do _worst_ in uptrends (51.2%, +0.10 ATR) and best after downtrends (64.7%,
  +0.59 ATR); Bitcoin's run the other way (53.9% vs 53.8%, +1.28 vs −0.08 ATR). The two
  spine assets disagree about the sign of the effect, so the answer is that the shape is
  not carrying the information — a stronger version of the same lesson, and measured.
- **4.3** asks for one trendline rather than a flag's two boundaries. The annotate grader
  scores a `channel`'s primary rail only, so asking for a channel would grade half of
  what it asked. A bear flag's floor is a horizontal level, which is Chapter 3.
- **4.6** is `classify`, not `spot-the-flaw` — the third time that call has come up,
  after 1.7 and 5.6. It is a chart plus a choice. `spot-the-flaw` stays unbuilt until a
  level needs a non-chart artefact, most likely a backtest report in Chapter 9.
- **4.B** runs on LAKE-1d, not EURUSD 1h. Hourly euro holds 1,295 pin bars in 7,163 bars,
  so "scan the chart and find the setup" has no defensible answer there, and it contains
  zero double tops and zero head-and-shoulders at any span. LAKE gives exactly one chart
  pattern in its window and a 3.70% daily ATR no chapter has taught on.

> **Chapter 5 was unreachable until this chapter existed.** `isChapterUnlocked(5)` asks
> for two stars on 4-B, and M6 shipped Chapter 5 with 4-B unwritten — its own e2e tests
> seeded `"4-B": cleared` into localStorage, which made the suite pass and hid the gap.
> `e2e/chapter4.spec.ts` now asserts the chain in both directions.

## Ch 5 — Indicators

_unlocks: indicator panel, one per level_

| #       | Level                                                                                                                 | Kind         |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| 5.1     | An MA is just smoothed price — drag the period, watch lag appear                                                      | `tune-param` |
| 5.2     | Two sigma is not ninety-five percent — widen the bands until they contain what they claim                             | `tune-param` |
| 5.3     | RSI 80 for 40 bars while price doubles — overbought ≠ sell                                                            | `classify`   |
| 5.4     | MACD is two MAs — click every cross, count how many were noise                                                        | `mark-bars`  |
| 5.5     | **ATR as % of price** — BTC 3%/day is Tuesday, SPY 3%/day is a crisis. Same chart, three assets, y-axis in ATR units. | `tune-param` |
| 5.6     | Indicator soup — 6 indicators, 6 conflicting signals                                                                  | `classify`   |
| **5.B** | **BOSS (SPY 15m):** structure + indicator read + entry in replay                                                      | composite    |

> **5.5 is the normalization keystone.** Once the player thinks in ATR-multiples instead of dollars, volatility intuition transfers between assets for free. Measured, the curriculum's own slogan understates it: Bitcoin's _median_ day spans 4.60% and 85.6% of its days exceed 3%, so 3% is a quiet Tuesday rather than an ordinary one. SPY clears 3% on 4.2% of days and the euro on 0.8%.
>
> **5.2 is not "find the MA this market respected", and the data is why.** That question has no honest answer. Counting touches or bounces, the shortest period offered wins every window; reframed as "which held you in the trend", the longest wins. Running the rule for real, the best period moves between windows and sits inside noise of its neighbours — MA150 at 13.1% against MA200 at 12.9% in 2006-07 — and in three of five windows every period loses money. Shipping an answer would have taught overfitting one chapter before the one that warns about it. The slider now tunes Bollinger deviations, which has a measured answer and a better lesson: two sigma contains 88.8% of closes here, not the 95% the textbooks promise, and 95% needs 2.35σ.
>
> **5.6 uses `classify` rather than `spot-the-flaw`.** A new kind needs a level the existing ones cannot express, and 5.6 is a chart with six indicators plus a choice. `spot-the-flaw` stays unbuilt until a level needs a non-chart artefact — a backtest report in Chapter 9 is the likely first. Levels 1.5 and 1.7 shipped as `classify` in M3 for the same reason, and this table said otherwise until now.
>
> **5.B is a composite.** SPY-15m is a 1,041-bar rolling snapshot and yields one setup under 3.B's stop discriminator, so a single-trade boss would rest on a knife edge. "Structure + 2 indicators, entry in replay" is three stages anyway, and `replay-trade` has been a valid composite step since M5 precisely so 4.B, 5.B and 6.B would be authoring rather than building.

## Ch 6 — Confluence & Multi-Timeframe

_unlocks: MTF split view_

| #       | Level                                                                        | Kind               |
| ------- | ---------------------------------------------------------------------------- | ------------------ |
| 6.1     | HTF bias, LTF entry                                                          | `classify` (split) |
| 6.2     | HTF zone + LTF trigger, both panes live                                      | `replay-trade`     |
| 6.3     | When timeframes disagree                                                     | `classify`         |
| 6.4     | Rank 4 setups by confluence, then reveal outcomes — the top-ranked one loses | `sort-rank`        |
| 6.5     | Over-confluence and analysis paralysis                                       | `spot-the-flaw`    |
| 6.6     | Session context — the opening range exists on SPY and not on BTC             | `mark-bars`        |
| **6.B** | **BOSS (AAPL + SPY):** full MTF replay trade                                 | `replay-trade`     |

## Ch 7 — Risk, R & Sizing

_unlocks: position-size calculator, R overlay_

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

> **7.3 is what makes this chapter transfer at all.** Without it the player can size a BTC trade and nothing else.

## Ch 8 — Asset Character

_unlocks: y-axis normalize toggle, correlation matrix_

| #       | Level                                                                                                                                               | Kind            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 8.1     | **Normalize** — the same 10% move on 6 assets. Toggle price → % → ATR. Which was actually big?                                                      | `tune-param`    |
| 8.2     | **Measure trend-persistence yourself** — run an autocorrelation probe per asset. Crypto persists; the index reverts. You didn't take this on faith. | `tune-param`    |
| 8.3     | **One setup, six assets, six outcomes** — the identical breakout rule on all six                                                                    | `sort-rank`     |
| 8.4     | **Correlation** — your 5 "diversified" longs are one bet. See the matrix, then the joint drawdown.                                                  | `classify`      |
| 8.5     | Regime shift — the same rule through 2017, 2018, 2020, 2022                                                                                         | `spot-the-flaw` |
| 8.6     | Which market fits which edge — match 4 edges to the assets they survive on                                                                          | `sort-rank`     |
| **8.B** | **BOSS (unseen regime slice):** identify the asset's character from the chart alone, then pick and trade the appropriate edge                       | composite       |

> **8.2 matters most.** It makes asset character _measured, not asserted_ — the player runs the probe and reads the number. That's the difference between the game teaching a fact and teaching a method.

## Ch 9 — Edge & Probability

_unlocks: journal analytics_

| #       | Level                                                                                              | Kind            |
| ------- | -------------------------------------------------------------------------------------------------- | --------------- |
| 9.1     | Expectancy from a trade list                                                                       | `sizing-calc`   |
| 9.2     | Sample size — coin-flip sim vs your 10 trades. How much was luck? Recall your 1.B score.           | `predict-next`  |
| 9.3     | Guess the max drawdown of a +40%/yr equity curve, then see it                                      | `predict-next`  |
| 9.4     | Hindsight bias — a replay you already solved, re-shown honestly                                    | `replay-trade`  |
| 9.5     | **Overfitting** — tune a rule until in-sample looks incredible, then reveal out-of-sample          | `tune-param`    |
| 9.6     | **Your journal** — analytics over the trades _you_ logged in Ch 3–8, split by asset class          | dashboard       |
| **9.B** | **BOSS:** 3 backtest reports on 3 assets — one overfit, one under-sampled, one survivorship-biased | `spot-the-flaw` |

> **9.5 is the most important level in the game.** Build it before Ch 10's backtester, because the backtester has to be honest enough to support it.
>
> **9.6 is only possible because there are no accounts.** The journal is genuinely the player's own.

## Ch 10 — Build Your Own Strategy

| #        | Level                                                                                                                                                          | Objective |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 10.1     | Pick market + timeframe — constrained to your journal's best-performing context                                                                                |
| 10.2     | State a falsifiable edge hypothesis (structured, not free text)                                                                                                |
| 10.3     | Compose entry rules from unlocked blocks                                                                                                                       |
| 10.4     | Add invalidation and sizing — via `InstrumentSpec`, so it's tradeable in your actual market                                                                    |
| 10.5     | In-sample backtest — expectancy > 0 over ≥30 trades                                                                                                            |
| 10.6     | **Out-of-sample** on data held back and revealed only now — must not collapse                                                                                  |
| 10.7     | **Cross-asset validation** — ≥3 assets from different classes. Positive expectancy on ≥2, reported per asset. A BTC-2020-only strategy is flagged, not passed. |
| **10.B** | **FINAL: export your playbook** — rules, per-asset stats, both samples, journal stats, known failure modes, review cadence                                     |

> **10.7 is the change that makes the whole game's promise true.** "Works on one series" would have certified overfit strategies as finished work.

---

## Cross-cutting features

Ranked by how much they carry the product.

1. **Replay engine** — bar-by-bar reveal, play/pause/step/speed, future strictly hidden. Powers `predict-next`, `replay-trade`, free-play. Everything else is decoration beside it.
2. **Y-axis normalize toggle** — price / % / ATR-multiples on every chart. Makes skills asset-portable; also the point of 8.1.
3. **Diagnostic feedback** — misconception matching, then the reference answer animated onto the attempt so the player sees the _delta_.
4. **Trade journal → Ch 9 self-analysis.** Every replay trade logs entry/stop/target/exit/R/asset/tags/reason.
5. **Progressive tool unlocks** — the toolbar visibly grows. Strong pull, and it stops Ch 2 drowning in 15 unusable buttons.
6. **Per-asset base rates** — computed at build time with `n` and CI per asset, shown as a distribution.
7. **Correlation matrix** (Ch 8+) — live over the spine; flags concentrated risk in the composer.
8. **Backtester with anti-overfit guards** — forced in/out-of-sample split, cross-asset requirement, visible variant counter warning past ~10 tries.
9. **Skill radar** — seven axes (structure, zones, patterns, indicators, risk, asset-character, discipline).
10. **Endless drill mode** per skill, against your own best.
11. **Playbook export** — markdown + PDF. The artifact the player leaves with.
12. **Progress export/import JSON** — no accounts means no cloud sync.

---

## Integrity guardrails

No claim that technical analysis predicts or guarantees anything. Every pattern shows its per-asset base rate with sample size. Visible "not financial advice."

Levels **1.B, 4.5, 8.3, 9.2 and 9.5** exist specifically to teach the player to distrust their own results. They are not optional polish — they are the reason this curriculum is worth shipping.
