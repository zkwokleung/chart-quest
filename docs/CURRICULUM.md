# Curriculum

**10 chapters, 73 levels, all authored.** Bosses need ≥2 stars to unlock the next chapter; regular levels unlock in order. A chapter-select screen lets returning players jump back.

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
| 8   | five of the six                    | **AAPL 1d, unseen window**|
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

| #       | Level                                                              | Kind               |
| ------- | ------------------------------------------------------------------ | ------------------ |
| 6.1     | Two clocks, one market — HTF bias, LTF pause                       | `classify` (split) |
| 6.2     | The level is upstairs — HTF level, LTF trigger, both panes live    | `replay-trade`     |
| 6.3     | A fortnight against a quarter — when the timeframes disagree       | `classify` (split) |
| 6.4     | **Stacking the deck** — rank four setups by confluence             | `sort-rank`        |
| 6.5     | Seven reasons, three facts — over-confluence                       | `spot-the-flaw`    |
| 6.6     | The first half hour — session context                              | `classify`         |
| **6.B** | **BOSS (EURUSD 1h + 4h):** find the level, trade the trigger       | composite          |

> **6.4 is the chapter's payload, and it says something stronger than planned.** The spec
> asks for four setups ranked by confluence, revealing that the top-ranked one lost — one
> anecdote. Measured instead across every 4h bar, with a stop below the last swing low and a
> 2R target, confluence counted from **visible price** (at a prior level, a bullish reversal
> candle, higher lows leading in) gives: 3 ticks 25% \[16–38\], 2 ticks 24% \[21–27\], 1
> tick 28% \[26–30\], 0 ticks 25% \[22–27\]. **Flat** — every interval overlapping every
> other across 4,223 setups. Stacking confirmations bought nothing at all, and 6.5 then shows
> why: most of them are one fact in different units.
>
> Counted *with* indicators the gradient is monotone and dramatic (5 ticks 5%, 2 ticks 28%),
> but two of those five conditions are not drawn on the charts, so the ranking would be
> unanswerable by looking. The flat version is both fair and better evidence.

### Where Chapter 6 diverged from this plan, and why

Each is recorded in full in the level's own file.

- **The data only supports three multi-timeframe pairings**, and two of them had to be
  created. `EURUSD-4h` and `SPY-1h` are resampled from the committed intraday series,
  because EURUSD's hourly begins two years after its daily ends and SPY's 15m three years
  after — there is no period both cover. The resampler is exact, and provably so: aggregating
  `BTCUSDT-4h` into UTC days reproduces the committed `BTCUSDT-1d` on all 931 shared days.
- **6.3 nearly could not be authored.** Requiring three swing highs and three swing lows on
  each pane, plus the structure label agreeing with the window's own net move, leaves fifteen
  opposed windows in the whole 4h series — and zero once the lower window passes ninety bars.
  A fortnight can oppose a quarter; a quarter cannot. The corroboration requirement is not
  decoration: daily 1752-1782 fell 35.3% and reads as an *uptrend*, because its only four
  swings sit in the closing bounce.
- **6.1 teaches the pause, not the agreement.** Both timeframes trending together barely
  occurs in the data; a trending higher timeframe with a *pausing* lower one is abundant — and
  is what "HTF bias, LTF entry" describes anyway.
- **6.6 is `classify`, not `mark-bars`.** The session's widest bar is one of its first two on
  only 19 of 40 sessions, so asking the player to mark the widest would be wrong half the
  time. What is reliable inverts the received idea: the opening thirty minutes really is ~1.7×
  busier than the rest of the session, and the range it draws broke on **39 of 40** sessions.
  So it is a volatility phenomenon and a poor level. The BTC half of the specified comparison
  is absent because Bitcoin's finest committed timeframe is four-hourly and cannot resolve a
  thirty-minute range; 1.6 already established that Bitcoin has no session, on measured gaps.
- **6.B runs on EURUSD 1h+4h, not "AAPL + SPY".** That spec names two *instruments* rather
  than two timeframes, and AAPL has no intraday series. It rests on a level and a trigger
  rather than trend agreement, because the EURUSD pair yields zero windows with a readable
  trend on both panes.

> **Chapter 7 was unreachable until this chapter existed**, exactly as Chapter 5 was before
> Chapter 4. `e2e/chapter6.spec.ts` asserts the chain in both directions.

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

### Where Chapter 7 diverged from this plan, and why

Each is recorded in full in the level's own file. Four of the eight levels changed kind, and
three claims did not survive being measured.

- **7.6's streak is thirteen, not six.** Trading the chapter's rule sequentially on SPY produces
  thirteen consecutive losses, 2007-10-23 to 2008-11-26. LAKE and EURUSD hold thirteen too. Six
  would have been an invention and a comforting one — the point of the level is that the streak
  runs longer than anyone plans for. Two of the thirteen lost more than a full R because both
  gapped through the stop, so the account figures compound the real R values rather than
  thirteen tidy minus-ones.
- **7.4's window never retested its own structure.** The level was drafted claiming every stop
  inside the swing low lost and every stop beyond it won. Price bottomed 23 dollars *above* the
  low, so the boundary sits at 0.80× ATR rather than at the structure's 1.01×. The honest lesson
  is the better one: the stop was rewarded for buying room, not for clearing a level that held,
  and you cannot know in advance which of those you are getting.
- **7.5's break-even line has Bitcoin sitting on it.** Across six assets the rule's profit does
  change hands near 33.3%, but not exactly: BTC is 1.7 points below the line and made +0.01R
  over 76 trades. Break-even to within a hundredth of an R is a stronger demonstration than a
  clean split would have been, and the level says so rather than rounding it away.
- **Four levels changed kind.** 7.1 became `sizing-calc` — the annotate grader scores a drawing
  on whether price respected it, and a risk band is not a level price turned at, so it would
  measure the wrong property of the right shape. 7.5 became `classify`: `tune-param`'s config
  *is* `(value) => IndicatorSpec`, and a required-win-rate curve is not an indicator. 7.6 and
  7.7 became `classify` because both are aggregate claims over hundreds of trades, and a single
  replay is weaker evidence than the measurement.
- **7.B is `trade-sequence`, and "scored on expectancy" cannot mean what it says.** The trades
  are historical, so their R outcomes are fixed before the player touches anything — no sizing
  decision can change the expectancy in R of a sequence that already happened. What sizing
  changes is the account path, so the score is survival, restraint and never raising risk after
  a loss. The sequence deliberately *makes* money: at 10% the reckless player finishes with
  double the account and still scores worse, which is the chapter's argument in one screen.
- **7.3 keeps gold, and 7.B runs on gold.** Normally the cross-asset boss rule would forbid
  that. 7.1 to 7.3 name no series at all — sizing is arithmetic over a contract spec — so
  nothing is *taught* on gold and the guard holds. Asserted in the claims test rather than
  argued here.

> **Chapter 8 was unreachable until this chapter existed.** `e2e/chapter7.spec.ts` asserts the
> chain in both directions, and reaches it by playing 7.B rather than by seeding it.

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

### Where Chapter 8 diverged from this plan, and why

The longest such section in this document, and it should be. **Four of the seven specified
premises were contradicted by the data**, and the chapter that exists to teach measuring rather
than believing had the least excuse of any for shipping them.

- **"Crypto persists; the index reverts" is wrong at one day and right at twenty.** Bitcoin's
  lag-1 daily return autocorrelation is −0.052 — it mean-reverts — and its variance ratio crosses
  1.0 at **6.1 bars**, climbing to 1.41 by ninety. So trend is a property of a *horizon* rather
  than of a market, which is a better lesson and is only reachable if the player varies the
  horizon. 8.2's commit button stays disabled until they have.
- **And once the statistic is robust, almost none of it is significant.** With Lo–MacKinlay's
  heteroskedasticity-robust z, Bitcoin is not distinguishable from a random walk at *any*
  horizon. The one effect in the whole spine that survives is the index's short-horizon
  reversion, significant across q=2 to q=9. The chapter shows the z beside every ratio and says
  so. This document already listed **8.3** among the levels that exist "specifically to teach the
  player to distrust their own results" — the data handed it that lesson a level early.
- **8.3's "six assets, six outcomes" did not happen.** The breakout rule is profitable on all
  six. What is true is a fiftyfold spread per trade, and an ordering that does not follow
  persistence: Apple leads, Bitcoin — the only market that trends at all — is fourth. So the
  level ranks by persistence, which the player measured in 8.2 and can therefore infer, and the
  profit table is the reveal that refuses to cooperate. Spearman's rho between the two orderings
  is 0.771, which sounds convincing and, at n=6, needs about 0.83 to clear the usual bar.
- **8.4's "your five diversified longs are one bet" is not true of this spine.** Over 1,429
  date-aligned days only one pair clears 0.6, and it is a stock against its own index. The true
  version is worse: conditioned on the index's worst decile, Bitcoin goes 0.28 → 0.46 against the
  index and 0.12 → 0.37 against gold while being 0.01 against the index on ordinary days. The
  asset sold as a hedge is the one that stops being one. Not the slogan "correlations go to one",
  which is measurably too strong — Apple against the index *falls* from 0.80 to 0.70.
- **8.5's regime shift became a report review.** 2022 is negative on three of six markets rather
  than all of them, so "the year explains everything" would have been another overclaim. Instead
  every figure in a seven-claim backtest write-up is real and four of the sentences still do not
  follow. It also forced an `AUTHORING.md` amendment: the rule that every flawed claim carry a
  `signal` over-fitted 6.5, and now reads that a flawed claim must be *recomputable*.
- **8.6 has no one-to-one mapping to find.** "Match 4 edges to the assets they survive on" needs
  a bijection and Apple is best for three of the four. Ranked by portability instead, anchored on
  the chapter's only claim with no sample size attached: `gap-fill` finds **zero** setups on
  Bitcoin across 2,778 bars, because a market open every hour never opens below yesterday's low.
  It ranks last for that despite a better mean than the pullback — a rule that cannot be
  expressed in an asset class has failed the portability test before its numbers are consulted.
- **8.1 is `classify`, not `tune-param`,** and **8.2 needed a twelfth kind.** `tune-param`'s
  config *is* `(value) => IndicatorSpec`, so a required-win-rate curve was not the only thing it
  could not express; a variance ratio across six markets is not an indicator on one window
  either. 8.1's interaction is the y-axis toggle, which already existed, plus a choice — a
  `classify`, the fifth time this project has made that call.
- **The boss runs on Apple, and the reserve costs the chapter a pane.** The cross-asset guard is
  series-id granular, so no Chapter 8 level may name `AAPL-1d` at any window — which is why 8.1
  compares five markets rather than six. Apple is worth it: fourth on persistence, first on
  profit, so it is precisely where a player who concluded "persistent means tradeable" gets
  caught. Its unseen-window reserve is asserted from level 8.1 onward, because the generic guard
  stays inert until a boss exists.

> **Chapter 9 was unreachable until this chapter existed.** `e2e/chapter8.spec.ts` asserts the
> chain in both directions.

## Ch 9 — Edge & Probability

_unlocks: journal analytics_

| #       | Level                                                                                                       | Kind            |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| 9.1     | **Was it worth taking** — expectancy from 24 outcomes, 9 wins, and a positive answer                        | `sizing-calc`   |
| 9.2     | **How much of that was luck** — the binomial for five flips, with your own 1.B accuracy marked on it        | `classify`      |
| 9.3     | **How deep does a good year get** — guess the drawdown of a +51.7R curve, in R, then see it                 | `probe`         |
| 9.4     | **You already know it worked** — the outcome first, then rewind and plan it; the plan alone is scored        | `replay-trade`  |
| 9.5     | **Tune it until it looks brilliant** — sweep 26 lookbacks on four markets; the later window is the reveal    | `probe`         |
| 9.6     | **Your own record** — the journal you actually wrote, split by asset class, and what it will not support     | `classify`      |
| **9.B** | **BOSS:** three backtest reports on three markets — one overfit, one under-sampled, one survivorship-biased | `composite`     |

> **9.5 is the most important level in the game.** Build it before Ch 10's backtester, because the backtester has to be honest enough to support it.
>
> **9.6 is only possible because there are no accounts.** The journal is genuinely the player's own.

### Where Chapter 9 diverged from this plan, and why

Longer than Chapter 8's, because **four of the seven specified kinds could not hold and the
milestone's own gate was unmeetable when it was written.**

- **The gate could not be met, and finding out was the first day's work.** Issue #27 asks that 9.6
  read real journal data split by asset class. Only `replay-trade` carried a journal hook and only
  three levels had it as their top-level kind, so four composite bosses silently discarded the
  trade their `replay-trade` stage produced and 7.B's ten sized trades wrote nothing at all. **A
  perfect playthrough of Chapters 1–8 logged three entries across two asset classes**, and the two
  classes that appear only in bosses — fx and futures — never appeared. Fixing that came before any
  Chapter 9 content; `lib/levels/journal-coverage.test.ts` now states the gate mechanically and
  every number in it was wrong before M9.
- **And the fix exposed a distinction the epic's own example sentence depended on.** Of the
  eighteen entries a fixed journal holds, **eleven are gold and ten of those are 7.B's, where the
  entry, stop and target were authored and the only decision was size.** Pooling them would make
  _"your average loss is 1.4R, not the 1R you set"_ — the epic's headline promise — a claim about
  the author's stops. `JournalEntry` gained a `planned` discriminator and every headline figure is
  computed over the player's own plans, of which a full playthrough leaves **eight**.
- **9.6 is a `classify`, not a `dashboard`.** A kind that cannot be graded cannot satisfy the
  winnability guard, which makes it a page rather than a level. The tables live in a component that
  reads the store — which a component may do — and the graded question is what the record supports.
  Its answer is **structurally guaranteed**: the largest per-class cell of planned trades any player
  can reach is four, so "too small to split by asset class" is true for every possible player, and
  the chapter's claims test _computes_ that from the coverage rather than asserting a constant.
- **9.2 and 9.3's `predict-next` could not hold, for different reasons.** A grader may not read the
  store, and `predictions["1-B"]` is absent on a fresh save, after `resetProgress`, and in private
  mode where storage degrades to memory — so 9.2's graded question is the binomial arithmetic and
  the player's own 1.B accuracy is a marker beside it, degrading to "no 1.B score recorded". 9.3
  asks for a magnitude and `predict-next`'s attempt is a list of directions, so it became a `probe`
  with the answer hidden until commit. The chapter carries an invariant with its own test: **no
  Chapter 9 level's graded answer depends on the store.**
- **9.5 is a `probe`, not a `tune-param`, and it must score exploration rather than a target.**
  `tune-param.config.indicator` literally _is_ `(value) => IndicatorSpec`, and a two-window sweep
  is not an indicator on one window — the same argument that produced `probe` in M8. A `target`
  would award three stars for finding the overfit parameter and print "correct: 9" on the
  correction screen, which is the habit the level exists to break.
- **Chapter 9 may not say "out-of-sample".** `public/data/oos/` is Chapter 10's and a live guard
  forbids any Ch 1–9 level from naming an `-oos` series. So 9.5 splits 70/30 _inside_ the
  in-sample data and calls it **"the later third"**, because 10.6 uses "out-of-sample" for bars the
  game has never shown and a game with two meanings for its most load-bearing term has none.
- **The sweep produced a better lesson than the one specified, and it survives its own
  counter-example.** Tuning the breakout lookback across 26 values and measuring the held-back
  window: the index's best in-sample setting placed **25th of 26** later, gold's 21st, Bitcoin's
  13th — and **Apple's placed 3rd**. So the rule is not "the optimum always collapses" but "how
  excited the backtest made you predicts how much it will cost you", and Apple is why the level
  shows four markets. A single-asset version would have taught a new false rule in place of the old.
- **"A replay you already solved" cannot be graded**, because the player may have skipped it or
  scored zero and a graded level may not depend on their history. The honest inverse is: show the
  outcome, rewind, ask for the plan, score the plan alone. `replay-trade` gained
  `outcomeWeight`, set to 0 here and defaulting to the existing 0.3 everywhere else.
- **The boss is a `composite` of three `spot-the-flaw` stages, not one.** A single stage renders
  `data[0]` and scores one flat `f1` over every claim, so a player who dismantles the first report
  and ignores the third earns credit that hides the miss. It surfaced three shipped defects:
  `Composite.tsx` paired stage slices with loaded series **by index** (so all three reports would
  have charted the index); `spot-the-flaw` rendered each claim's note — which is a _verdict_ —
  beside its checkbox, meaning 6.5 and 8.5 printed their answers next to the question from M6
  onward; and the kind never drew the market its claims were about, though both levels declare and
  label a window.
- **Survivorship did not need a dead ticker after all.** `DATA.md` concedes none is obtainable, so
  the third report was always going to be the constructed one. It is not: a universe defined by
  _holding a complete record_ is a universe chosen after the outcomes were known, and this game's
  own data is the proof — all three equities run unbroken from January 2005 to April 2023. The
  chapter ends by turning its lesson on the dataset the player has trusted for eight chapters.
- **The skill radar has ten axes, not the seven the epic listed.** Mapping the seven onto chapters
  leaves Chapter 1, Chapter 6 and — by the same oversight — Chapter 9 itself with no axis, and a
  radar that omits the chapter a beginner spends longest in cannot tell a beginner what to
  practise. `discipline` deliberately has no chapter: it is the one axis measured from behaviour
  rather than answers, which is why the epic wanted it and why it needs the journal.

> **Chapter 10 was unreachable until this chapter existed.** `e2e/chapter9.spec.ts` asserts the
> chain in both directions, without a `localStorage` fixture standing in for a playthrough.

## Ch 10 — Build Your Own Strategy

| #        | Level                                                                                                       | Kind          |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------- |
| 10.1     | **Where to build it** — your record beside the question, and history as the thing that decides              | `classify`    |
| 10.2     | **Something you could be wrong about** — which hypotheses this engine could refute                          | `classify`    |
| 10.3     | **Build the entry** — compose from the blocks your progress unlocked; beat doing nothing on two markets     | `build-rules` |
| 10.4     | **Where it is wrong** — the exit is yours now, and the comparison moves with it                             | `build-rules` |
| 10.5     | **Everything you are allowed to see** — three markets, thirty trades each, all three clearing the baseline  | `build-rules` |
| 10.6     | **What the held-back data can tell you** — your rule on unseen bars, and the asymmetry of what nine trades prove | `classify` |
| 10.7     | **Does it travel** — one equity, one commodity, one crypto; two *asset classes* must clear it               | `build-rules` |
| **10.B** | **FINAL: two markets you never tuned on** — a micro-cap and a currency, then the game writes your playbook  | `build-rules` |

> **10.7 is the change that makes the whole game's promise true.** "Works on one series" would have certified overfit strategies as finished work.

### Where Chapter 10 diverged from this plan, and why

The shortest of these sections, and only because Chapter 9 had already forced the two rules that
would have caused most of the trouble. One measurement still rewrote two levels.

- **"Expectancy > 0 over ≥30 trades" is a bar that entering at random clears.** With a 2 ATR stop and
  a 2R target, a trade on *every flat bar* returns **+0.265R on the index, +0.395R on Apple, +0.337R
  on Bitcoin and +0.232R on gold** — four of six markets. Every two-block rule tried during
  development cleared zero, including "buy breakdowns below the 200-bar average", which makes a
  positive +0.03R on the index and is worse than doing nothing. Scored against zero it earned three
  stars. So the objective became `beatBaseline`: the entry must beat the same exit with no entry
  condition, on the same market, over the same window. What a naive backtest mostly shows you is the
  exit and the market's drift, and this is the comparison that says so. The trade-count half of the
  specified objective survived untouched.
- **10.6 cannot ask whether the strategy survived, because the holdback cannot supply a sample.** The
  most recent 15% of each series yields 33 trades on gold at its most generous lookback and 12 on
  Bitcoin's daily series, against 39 to 166 in-sample; the chapter's own reference produces **nine
  trades on the index, three on gold and nine on Bitcoin's four-hour series.** A player who has just
  spent Chapter 9 learning that eighteen examples cannot distinguish a pattern from a coin cannot then
  be told that nine validated their strategy. So the level asks what a sample this size can *do*, and
  the answer is asymmetric: it can refute and it cannot confirm. That is the honest form of "must not
  collapse".
- **And the holdback's compile-time guarantee survived the level that needed to break it.** Building
  10.6 as a `build-rules` level meant naming `-oos` slices in `level.data`, which meant widening
  `LevelSlice.series` from `SeriesId` — removing one of `DATA.md`'s three layers from all seventy-three
  levels to serve one. The holdback is loaded by a component instead and the graded question is the
  reading, which is author-known for every player.
- **10.1 cannot be graded on the journal**, by the invariant M9 established: `journal` is empty on a
  fresh save, after `resetProgress` and in private mode. The journal marks the options and the data
  decides the answer, exactly as 9.6 does.
- **10.4 grades invalidation and only *shows* sizing.** Both were specified; sizing is already graded
  five times in Chapter 7 from real contract terms, and this chapter has seven slots for eight ideas. A
  sixth sizing level would be a Chapter 7 level wearing a Chapter 10 number.
- **`spec.hours` was never built.** `ARCHITECTURE.md` §7 and issue #28 both ask the engine to avoid
  fills inside a market-closed gap "using `spec.hours`", and `InstrumentSpec` has no such field.
  `simulate` satisfies the rule structurally by filling a gap at the **open** — the market never traded
  at the stop price — which is better than a trading calendar because it cannot be wrong about a
  holiday.
- **The playbook is markdown plus a print stylesheet, not a generated PDF.** A PDF library is 100 KB
  or more against a shared bundle at 94% of budget, for worse typography than the browser's own
  Save-as-PDF produces.
- **shadcn (#30) stayed unadopted.** The composer needs a listbox, buttons and a removable list, all of
  which this project has built natively across twelve kinds precisely so keyboard support is free.
  Moved to M11's accessibility pass, where the weight can be measured rather than guessed.

> **The engine is not new code.** `runEdge` was already a sequential backtester feeding two committed
> artefacts whose numbers nine levels quote, so `lib/backtest/engine.ts` is that loop with the fixed
> parts made parameters and `runEdge` is an adapter over it. The refactor was gated on
> `npm run data:character && npm run data:sweep` leaving `public/data/` byte-identical.

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
