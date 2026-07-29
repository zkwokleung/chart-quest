# Curriculum

**10 chapters, ~73 levels.** Bosses need ≥2 stars to unlock the next chapter; regular levels unlock in order. A chapter-select screen lets returning players jump back.

---

## The cross-asset boss rule

Every chapter's boss runs on a **different asset than that chapter's levels**. This is the transfer guarantee — any asset-specific crutch fails loudly at the gate rather than silently persisting until the player's first real trade.

| Ch | Levels taught on | **Boss runs on** |
|---|---|---|
| 1 | BTC, SPY, EURUSD (mixed by design) | all three |
| 2 | BTC 1d | **EURUSD 1d** |
| 3 | SPY 1d | **BTC 4h** |
| 4 | BTC 1d + AAPL 1d | **EURUSD 1h** |
| 5 | EURUSD 1d | **SPY 15m** |
| 6 | BTC 1d/4h | **AAPL 1d + SPY 1d** |
| 7 | all four instrument classes | **GC 1d** |
| 8 | all six (by definition) | **unseen regime slice** |
| 9 | player's own journal | **3 reports on 3 assets** |
| 10 | player's choice | **≥3 asset classes** |

Enforced by test, not discipline: `every chapter boss uses a different SeriesId than that chapter's levels`.

---

## Ch 1 — Reading the Chart
*unlocks: crosshair, timeframe switch, log/linear, y-axis mode*

| # | Level | Kind |
|---|---|---|
| 1.1 | Anatomy of a candle — click the wick, body, open, close | `mark-bars` |
| 1.2 | Line vs candles — the line chart hid a 12% wick. Find it. | `classify` |
| 1.3 | The timeframe illusion — two charts "trending" opposite ways are the same data | `classify` |
| 1.4 | Volume — click the 3 highest-volume bars, see what happened around them | `mark-bars` |
| 1.5 | Log vs linear — why the 2017 BTC run vanishes on a linear scale | `tune-param` |
| 1.6 | **Four clocks** — BTC 24/7, EURUSD 24/5, SPY 6.5h. The market closes and price moves anyway → that's a gap, and your stop doesn't protect you across it. | `classify` |
| 1.7 | **The split trap** — unadjusted AAPL shows a −75% crash in Aug 2020. It never happened. | `spot-the-flaw` |
| **1.B** | **BOSS: Coin flip** — predict direction 5× across three different assets. Score lands near 50%. | `predict-next` |

> **1.B is deliberate.** The first boss proves the player *cannot predict yet*. It sets the humility baseline the whole game is measured against, and Ch 9.2 calls this exact score back.
>
> **1.6 is the highest-value early level.** Gap blindness is the most expensive thing a crypto-only curriculum teaches. It goes in before any stop is ever placed.

## Ch 2 — Market Structure
*unlocks: swing detector, trendline tool*

| # | Level | Kind |
|---|---|---|
| 2.1 | Click every swing high (fractal ±2 bars) | `mark-bars` |
| 2.2 | HH/HL vs LH/LL across 4 charts | `classify` |
| 2.3 | Draw the trendline — graded on touches, wick anchoring, zero body cuts | `annotate:trendline` |
| 2.4 | The other side — draw the falling resistance line | `annotate:trendline` |
| 2.5 | Break of structure vs deviation — click the bar that actually broke it | `mark-bars` |
| 2.6 | Ranges — bound it, then classify range vs trend | `annotate:zone` |
| **2.B** | **BOSS (EURUSD):** mark swings → trendline → classify regime → predict 10 bars | composite |

> **2.4 draws a resistance line rather than a channel.** No parallel offset catches a single high in that window — the highs fall while the lows rise, making it a contracting triangle rather than a channel. The two lines together explain the breakout that followed, which is a better lesson than a shape the data does not contain. The `channel` shape stays implemented and unit-tested for a level that needs it.
>
> **2.3's window is a range, not an uptrend.** Its swing highs run 9950 → 10380 → 9993 → 9589 → 9292, only 63% rising. The floor lifts while the ceiling does not, which is exactly why the support line is worth drawing — but the brief must not call it a trend, and a content-claims test enforces that.

## Ch 3 — Zones
*unlocks: horizontal level, rectangle, measure tool*

| # | Level | Kind |
|---|---|---|
| 3.1 | A level from multiple touches | `annotate:level` |
| 3.2 | Why a line is wrong — widen it into a zone | `annotate:zone` |
| 3.3 | Click the retest bar | `mark-bars` |
| 3.4 | Breakout or fakeout? 6 mini-charts; reveal shows each one's next 20 bars | `classify` |
| 3.5 | Round numbers and where stops cluster | `mark-bars` |
| 3.6 | **Trap:** a textbook-clean break that fails | `predict-next` |
| **3.B** | **BOSS (BTC 4h) — your first trade:** mark the zone, place entry/stop/target, replay to outcome | `replay-trade` |

> **3.B scores R achieved and stop-placement quality separately.** A profitable trade with a stop in a stupid place gets 1 star. This split runs through every later boss and is the main lever against teaching outcome-chasing.

## Ch 4 — Patterns & Base Rates
*unlocks: pattern library with per-asset stats*

| # | Level | Kind |
|---|---|---|
| 4.1 | Pin bar, doji, engulfing — find them | `mark-bars` |
| 4.2 | Context beats pattern — same pin bar in trend vs chop | `classify` |
| 4.3 | Continuation: flag, triangle — draw the boundaries | `annotate` |
| 4.4 | Reversal: double top, head & shoulders — mark the components | `mark-bars` |
| 4.5 | **Guess the win rate** of 5 patterns → see it measured across all 6 assets | `sort-rank` |
| 4.6 | A perfect pattern that failed — why? | `spot-the-flaw` |
| **4.B** | **BOSS (EURUSD 1h):** scan unseen chart, find the setup, trade it in replay | composite |

> **4.5 is the chapter's payload.** The player guesses (usually 70%+), then sees head & shoulders run 41% on EURUSD and 58% on BTC — with `n` and a 95% CI wide enough to be visibly untrustworthy. The lesson upgrades from *"patterns are weaker than you think"* to **"pattern edge is asset- and regime-dependent, so measure it on your own market."** Guesses are stored and recalled in Ch 9.

## Ch 5 — Indicators
*unlocks: indicator panel, one per level*

| # | Level | Kind |
|---|---|---|
| 5.1 | An MA is just smoothed price — drag the period, watch lag appear | `tune-param` |
| 5.2 | Find the MA this market actually respected | `tune-param` |
| 5.3 | RSI 80 for 40 bars while price doubles — overbought ≠ sell | `classify` |
| 5.4 | MACD is two MAs — click every cross, count how many were noise | `mark-bars` |
| 5.5 | **ATR as % of price** — BTC 3%/day is Tuesday, SPY 3%/day is a crisis. Same chart, three assets, y-axis in ATR units. | `tune-param` |
| 5.6 | Indicator soup — 6 indicators, 6 conflicting signals | `spot-the-flaw` |
| **5.B** | **BOSS (SPY 15m):** structure + 2 indicators, entry in replay | `replay-trade` |

> **5.5 is the normalization keystone.** Once the player thinks in ATR-multiples instead of dollars, volatility intuition transfers between assets for free.

## Ch 6 — Confluence & Multi-Timeframe
*unlocks: MTF split view*

| # | Level | Kind |
|---|---|---|
| 6.1 | HTF bias, LTF entry | `classify` (split) |
| 6.2 | HTF zone + LTF trigger, both panes live | `replay-trade` |
| 6.3 | When timeframes disagree | `classify` |
| 6.4 | Rank 4 setups by confluence, then reveal outcomes — the top-ranked one loses | `sort-rank` |
| 6.5 | Over-confluence and analysis paralysis | `spot-the-flaw` |
| 6.6 | Session context — the opening range exists on SPY and not on BTC | `mark-bars` |
| **6.B** | **BOSS (AAPL + SPY):** full MTF replay trade | `replay-trade` |

## Ch 7 — Risk, R & Sizing
*unlocks: position-size calculator, R overlay*

| # | Level | Kind |
|---|---|---|
| 7.1 | What 1R is — place entry and stop, read your R | `annotate` |
| 7.2 | Sizing from account, entry, stop, risk % — **BTC fractional** | `sizing-calc` |
| 7.3 | **The same trade in four markets** — AAPL whole shares, one ES contract, EURUSD lots. One formula, four `valuePerPoint`. | `sizing-calc` |
| 7.4 | Structural stop vs arbitrary stop — replay the *same trade* with both | `replay-trade` |
| 7.5 | R:R vs required win rate — slider, then test the claim on data | `tune-param` |
| 7.6 | **The 6-loss streak** — replay it at 1% risk, then 5%. Watch the account. | `replay-trade` |
| 7.7 | Trailing stops and partials | `replay-trade` |
| **7.B** | **BOSS (GC 1d) — 10 trades:** survive with the account intact. Scored on expectancy, not profit. | `replay-trade` |

> **7.3 is what makes this chapter transfer at all.** Without it the player can size a BTC trade and nothing else.

## Ch 8 — Asset Character
*unlocks: y-axis normalize toggle, correlation matrix*

| # | Level | Kind |
|---|---|---|
| 8.1 | **Normalize** — the same 10% move on 6 assets. Toggle price → % → ATR. Which was actually big? | `tune-param` |
| 8.2 | **Measure trend-persistence yourself** — run an autocorrelation probe per asset. Crypto persists; the index reverts. You didn't take this on faith. | `tune-param` |
| 8.3 | **One setup, six assets, six outcomes** — the identical breakout rule on all six | `sort-rank` |
| 8.4 | **Correlation** — your 5 "diversified" longs are one bet. See the matrix, then the joint drawdown. | `classify` |
| 8.5 | Regime shift — the same rule through 2017, 2018, 2020, 2022 | `spot-the-flaw` |
| 8.6 | Which market fits which edge — match 4 edges to the assets they survive on | `sort-rank` |
| **8.B** | **BOSS (unseen regime slice):** identify the asset's character from the chart alone, then pick and trade the appropriate edge | composite |

> **8.2 matters most.** It makes asset character *measured, not asserted* — the player runs the probe and reads the number. That's the difference between the game teaching a fact and teaching a method.

## Ch 9 — Edge & Probability
*unlocks: journal analytics*

| # | Level | Kind |
|---|---|---|
| 9.1 | Expectancy from a trade list | `sizing-calc` |
| 9.2 | Sample size — coin-flip sim vs your 10 trades. How much was luck? Recall your 1.B score. | `predict-next` |
| 9.3 | Guess the max drawdown of a +40%/yr equity curve, then see it | `predict-next` |
| 9.4 | Hindsight bias — a replay you already solved, re-shown honestly | `replay-trade` |
| 9.5 | **Overfitting** — tune a rule until in-sample looks incredible, then reveal out-of-sample | `tune-param` |
| 9.6 | **Your journal** — analytics over the trades *you* logged in Ch 3–8, split by asset class | dashboard |
| **9.B** | **BOSS:** 3 backtest reports on 3 assets — one overfit, one under-sampled, one survivorship-biased | `spot-the-flaw` |

> **9.5 is the most important level in the game.** Build it before Ch 10's backtester, because the backtester has to be honest enough to support it.
>
> **9.6 is only possible because there are no accounts.** The journal is genuinely the player's own.

## Ch 10 — Build Your Own Strategy

| # | Level | Objective |
|---|---|---|
| 10.1 | Pick market + timeframe — constrained to your journal's best-performing context |
| 10.2 | State a falsifiable edge hypothesis (structured, not free text) |
| 10.3 | Compose entry rules from unlocked blocks |
| 10.4 | Add invalidation and sizing — via `InstrumentSpec`, so it's tradeable in your actual market |
| 10.5 | In-sample backtest — expectancy > 0 over ≥30 trades |
| 10.6 | **Out-of-sample** on data held back and revealed only now — must not collapse |
| 10.7 | **Cross-asset validation** — ≥3 assets from different classes. Positive expectancy on ≥2, reported per asset. A BTC-2020-only strategy is flagged, not passed. |
| **10.B** | **FINAL: export your playbook** — rules, per-asset stats, both samples, journal stats, known failure modes, review cadence |

> **10.7 is the change that makes the whole game's promise true.** "Works on one series" would have certified overfit strategies as finished work.

---

## Cross-cutting features

Ranked by how much they carry the product.

1. **Replay engine** — bar-by-bar reveal, play/pause/step/speed, future strictly hidden. Powers `predict-next`, `replay-trade`, free-play. Everything else is decoration beside it.
2. **Y-axis normalize toggle** — price / % / ATR-multiples on every chart. Makes skills asset-portable; also the point of 8.1.
3. **Diagnostic feedback** — misconception matching, then the reference answer animated onto the attempt so the player sees the *delta*.
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
