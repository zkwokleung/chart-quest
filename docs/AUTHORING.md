# Authoring a level

The most-repeated task in this project. All 73 levels exist as data; adding one should not require writing a component.

---

## Checklist

1. **Pick the kind.** If none of the existing kinds fit, stop and open a discussion issue — a new kind is an architecture change, not a level.
2. **Find the data slice.** Bar indices into a committed series. Use the practice/free-play screen to browse and read off indices.
3. **Write the level file** in `lib/levels/content/ch<N>/<id>.ts`.
4. **Author ≥2 misconceptions.** Not optional. See below.
5. **Set star thresholds.** Author them _loose_ initially; they get calibrated after Milestone 5 playtesting.
6. **Run `npm test`.** The authoring guard tests will tell you if the level is malformed, unreachable, or violates an invariant.

---

## Skeleton

```ts
// lib/levels/content/ch2/2-3.ts
import type { Level } from "@/lib/levels/schema";

export const level: Level = {
  id: "2-3",
  chapter: 2,
  title: "Draw the trendline",
  kind: "annotate",
  brief: "Drag on the chart to place a line the market actually respected.",
  data: [{ series: "BTCUSDT-1d", from: 812, to: 980 }],
  config: {
    prompt: "Draw a rising support line under the lows.",
    shape: "trendline",
    side: "support",
    requiredTouches: 3,
    expectSlope: "up",
  },
  // Shown as the correction, never used to score — see "Drawing levels" below.
  target: {
    reference: {
      shape: "trendline",
      a: { bar: 1012, price: 8642.72 },
      b: { bar: 1058, price: 9125 },
    },
  },
  tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
  stars: [0.5, 0.72, 0.88],
  misconceptions: [
    {
      id: "anchored-to-bodies",
      test: (a, l, d) => countBodyCuts(a.line, d[0]) > 0,
      message:
        "Your line cuts through candle bodies. Anchor to wicks — they mark where price was actually rejected.",
      showOverlay: { kind: "highlight-bars", bars: "body-cuts" },
    },
    {
      id: "only-two-touches",
      test: (a, l, d) => countTouches(a.line, d[0]) < 3,
      message:
        "Any two points make a line. A trendline needs a third touch before it means anything.",
    },
  ],
  unlocks: ["trendline"],
  hints: [
    "Look for the lows, not the closes.",
    "Start at the swing low around bar 826.",
  ],
};
```

---

## Misconceptions: the part that matters

**Invariant: every level authors ≥2 misconceptions.** CI fails otherwise.

A grader that returns `0.62` teaches nothing. The score tells the player they were wrong; the misconception tells them _why_, which is the only part that changes their next attempt.

Good misconception messages:

- Name the specific error in the player's own attempt — not the general principle.
- Explain the _why_ in one clause. "Anchor to wicks — they mark where price was actually rejected."
- Are falsifiable by a `test` function over the attempt. If you can't write the test, the misconception is too vague.

Bad misconception messages:

- ❌ "Incorrect. Try again." — no information
- ❌ "Trendlines should connect swing lows in an uptrend." — restates the lesson, doesn't diagnose _this_ attempt
- ❌ "Close! You were 12% off." — a score wearing a sentence

Order matters: `diagnosis` is returned most-specific-first, and the UI shows the top match prominently. Put narrow, high-confidence tests before broad ones.

---

## Authoring guard tests

These run on every level automatically. You don't write them; you satisfy them.

| Guard                                                              | Why                                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Level's own `target` scores 3 stars through its own grader         | Catches broken authoring across all 73 levels for free. If the reference answer doesn't pass, the level is unwinnable. |
| `misconceptions.length >= 2`                                       | The teaching invariant                                                                                                  |
| Chapter boss uses a different `SeriesId` than the chapter's levels | The cross-asset transfer guarantee                                                                                      |
| No Ch 1–9 level references `public/data/oos/`                      | Keeps out-of-sample genuinely out-of-sample                                                                             |
| `from < to`, both within series bounds                             | Off-by-one and stale-index protection                                                                                   |
| Star thresholds ascending, all in `(0, 1]`                         | Malformed scoring                                                                                                       |
| `id` matches file path and chapter number                          | Registry integrity                                                                                                      |
| No level reads opens from a series on the unreliable-open list     | See below                                                                                                               |
| `RENDER_AS_LINE` equals the unreliable-open allow-list             | A series cannot be flattened to hide a rendering bug, nor left drawing candles that are fiction                          |

### `EURUSD-1d` has no usable open

Yahoo's `EURUSD=X` daily feed reports an open within a pip or two of the **same bar's**
close for everything after November 2010. 72% of that series has a body under a tenth
of its range, against ~11% for every other series we hold, and it is upstream —
refetching reproduces it.

So on `EURUSD-1d`, `h`/`l`/`c` are sound and `o` is not. Anything close-based (every
moving average, RSI, MACD, Bollinger, ATR) is fine. Anything reading a body, a candle
pattern or a gap is measuring an artefact. Level 1.6 taught gaps from this field until
M7 and uses gold futures now; Chapter 4's base rates exclude the series for the same
reason.

`lib/data/integrity.test.ts` holds the allow-list and will say so if upstream ever
fixes the feed.

**Since M8 the series is drawn as a close-only line rather than as candles**, so a player never
sees the artefact. `RENDER_AS_LINE` in `lib/chart/types.ts` decides that from the series id
inside `Chart.tsx` — never from a level — so a level can neither ask for an honest series to be
flattened nor forget to ask for a broken one to be. `integrity.test.ts` asserts the set equals
the unreliable-open allow-list, which means membership has to be earned by the measurement.
That closed #58.

---

## Star thresholds

Author loose (`[0.4, 0.65, 0.85]` is a reasonable starting guess), then calibrate after Milestone 5 when there's enough play data to see the real score distribution. Tight thresholds on an un-playtested level produce a level that feels broken rather than hard.

Three stars should mean "you did this properly," not "you matched the author's pixel-exact answer." A `tolerance` that's too tight is the commonest authoring bug.

---

## Hints

Progressive, each one costing a fraction of a star. Order from _nudge_ to _near-answer_:

1. Redirect attention — "Look at the lows, not the closes."
2. Narrow the search — "Start around bar 826."
3. (Rare, only for the hardest levels) Give one component of the answer.

Never write a hint that gives the whole answer. If a level needs one, the level is mis-scoped.

---

## Drawing levels (`annotate`)

Four shapes: `trendline`, `level`, `zone`, `channel`. Two anchors become whichever the level asked for.

**Grading is intrinsic.** The player's own line is scored on its touch count, body cuts and anchor placement; the authored `target.reference` is shown as the correction and used by `perfectAttempt`, but never to score. This is measured, not stylistic: BTC-1d holds 182 lines with three or more touches and zero body cuts, so a valid answer usually is not the author's.

Three things to get right:

- **Measure the reference, do not eyeball it.** A reference read off a swing-high listing rather than measured scored one star on 2.4. The content-claims test that catches this asserts the reference earns three stars _through the grader itself_.
- **Tolerance is a fraction of the level's window**, so one config works on Bitcoin at 60,000 and EURUSD at 1.09. Never derive it from what a player drew.
- **Every scored penalty needs a matching misconception.** 2.3 briefly docked 15% for anchor placement while saying nothing about it. Use the same helper the grader uses — `anchorQuality` — so the marks and the explanation cannot drift apart.

`expectSlope` is a gate: a support line sloping the wrong way scores zero, because it is a different object rather than a badly drawn one.

## Composite levels (bosses)

A boss chains several kinds and averages the scores. Express it as a sequence, not a new kind:

```ts
kind: 'composite',
config: {
  steps: [
    { kind: 'mark-bars',    weight: 0.25, /* ... */ },
    { kind: 'annotate',     weight: 0.25, /* ... */ },
    { kind: 'classify',     weight: 0.2,  /* ... */ },
    { kind: 'predict-next', weight: 0.3,  /* ... */ },
  ],
},
```

A composite step is a `Level` without its identity, so every existing kind component and grader works inside a boss unchanged. Each step carries its own target, tolerance and **at least two misconceptions** — the teaching invariant applies per stage, and a guard enforces it.

Weight the stages. `predict-next` scores participation rather than accuracy, so an equal share would hand over free marks and lower the bar for the stages actually being tested; 2.B gives it 0.10 against 0.30/0.35/0.25. There is no per-step floor: a boss should test the chapter, not wall a player weak at one thing.

Step data may narrow a range and **may name any series the boss itself loads**, but never one it does not — the player fetches the boss's slices once, and a stage naming anything else has no data.

That rule used to be stricter, and why is worth knowing before you loosen anything else: a step's series had to be a positional _prefix_ of the boss's, because `Composite.tsx` paired step slices with loaded series **by index**. A stage naming the boss's second series was handed its first — silently, with a chart of the wrong market. The pairing now looks each slice up by id (`stepSources`), which is what lets 9.B put a different backtest report on each of three markets. `lib/levels/kinds/composite/steps.test.ts` pins it, and fails under the pairing it replaced.

For trade bosses, **score R achieved and stop-placement quality separately** (see Ch 3.B in [`CURRICULUM.md`](CURRICULUM.md)). A profitable trade with a stop in a stupid place must not score 3 stars — that would teach outcome-chasing, which is the exact habit the game exists to cure.

---

## Trade levels (`replay-trade`)

```ts
kind: 'replay-trade',
config: {
  prompt: '...',
  side: 'long',
  primeBars: 61,   // bars visible before the player acts
  maxBars: 45,     // how far the replay will run
  minRR: 2,
  atrPeriod: 14,
},
target: {
  structure: { shape: 'level', price: 23976.42 },  // what the stop must respect
  triggerBar: 4819,
},
tolerance: { minAtr: 1.05, maxAtr: 2.2, barSlop: 2 },
```

There is no correct stop price, so none is authored. The plan is scored on four
things — stop beyond the structure, room between `minAtr` and `maxAtr`, reward:risk
at or above `minRR`, and entering near the trigger — for the same reason the
trendline grader scores intrinsically: many stops are defensible, and marking against
one author's number teaches guessing the author.

**`minAtr` and `maxAtr` are total risk from entry, in ATR multiples.** Not room beyond
the structure. The two readings agree only when the structure sits close to entry, and
where they diverged the level lost: 4.B's second top is 2.01× ATR above entry, so a
stop `minAtr` beyond _that_ risked 4.06× against a 3.5 cap and failed 4.B's own room
check. It shipped anyway, because a composite averages its steps and the other three
carried the score to 0.904 against a 0.9 threshold.

So measure both ends against entry, and measure them:

- `minAtr` must be wide enough to clear the structure. If the structure is 1.01× ATR
  below entry, `minAtr` below 1.01 asks for a plan the grader scores `beyondStructure: false`.
- `maxAtr` is the widest stop that still reaches `minRR` inside `maxBars`. A wider stop
  pushes the target further away, so this is a real ceiling rather than a formality —
  7.4 reaches 2R at 2.50× and runs out of bars at 2.60×.

`guards.test.ts` checks every replay-trade's reference answer against all four components
individually. Per component, because averaging is what let 4.B through.

**The slice must contain the outcome**, because the grader simulates it. `primeBars`
is the only thing holding it back from the player, so getting it wrong hands over the
answer at load. It is `triggerBar - slice.from + 1`.

**When a level compares markets, every window has to be typical of its own market.** 8.1 shows
five markets that each moved about ten percent and asks which was the biggest event. The first
search found a 2008 euro window and a 2011 index window — both crises — where the euro's ten
percent measured 7.2 ATR against the index's 9.2, which is the wrong answer produced by
comparing two unusual periods rather than two markets. Constrain each window's own median ATR%
to within ~15% of that market's full-history median, and assert it: cherry-picking a calm window
for one market and a wild one for another is the easiest way to make a comparison level say
whatever an author wants.

**Simulate the score surface before locking the window.** This is not optional, and
it is the rule that cost the most to learn. Run a grid of plausible player stops
through `simulate` and check the window _rewards the behaviour being taught_. Boss
3.B was first authored on BTC-4h bar 4240, where a stop given proper room loses and a
stop crammed onto the swing low wins — a level that would have taught the precise
opposite of the chapter. The mechanism recurs whenever the target is a multiple of the
player's own risk: a wider stop pushes the target further away, so on a move of fixed
size a wide stop can miss a 2R that a tight one reaches.

**Score the plan and the outcome separately, and let only the plan award stars.** A
profitable trade with a stop in a stupid place gets one star. Note which mechanism is
actually enforcing that in your level: at Chapter 3's thresholds the 0.3 outcome
weight already caps a weak plan below two stars, and `PLAN_FLOOR` is a backstop for
when #32 retunes thresholds.

**`outcomeWeight` sets that share, and 0 is a real option.** It defaults to 0.3, which every
replay level and stage before 9.4 uses. Set it to 0 when the player already knows what happened:
9.4 shows the outcome first, rewinds, and asks for the plan, so scoring the outcome would be
scoring something it handed over. If you set it, **say so in the brief** — a hidden zero is a
grader that disagrees with the correction screen. And keep it 0.3 elsewhere: a level that quietly
stops scoring outcomes stops teaching that a plan has to survive contact with the market.

`setup` is required on every trade level's config, from a closed vocabulary of three:
`continuation`, `reversal`, `level`. It is what the journal groups by, and it is authored rather
than derived — `AUTHORING`'s usual "measure it" instinct is wrong here, because a setup is a claim
about intent and nothing in the data records intent. Three ids rather than one per level, so at
least one `bySetup` cell reaches n≥3; a guard fails CI if any id goes unused.

---

## Slider levels (`tune-param`)

```ts
kind: 'tune-param',
config: {
  prompt: '...',
  label: 'deviations',
  min: 1, max: 3, step: 0.05, initial: 2,
  indicator: (value) => ({ kind: 'bollinger', period: 20, deviations: value }),
  scoring: 'target',      // or 'exploration'
},
target: { value: 2.35 },
tolerance: { slop: 0.15 },
```

**Decide honestly whether the level has an answer.** `scoring: 'target'` says there
is a measured right value; `exploration` says there is not, and scores whether the
player moved across enough of the range to have seen the effect. 5.1 is the second
kind — a shorter average lags less and whipsaws more, which is a trade-off rather
than a puzzle — and a level with no right answer must not pretend to have one,
because the player will believe it. An exploration level shows **no** correction at
the end, for the same reason.

If you are reaching for `target`, the answer has to survive being measured. 5.2 began
as "find the MA this market respected" and did not: the winner moved between windows,
sat inside noise of its neighbours, and three of five windows lost money on every
period. Check the surface before authoring the answer.

---

## Ranking levels (`sort-rank`)

```ts
kind: 'sort-rank',
data: [],                                    // a table, not a chart, is allowed
config: {
  prompt: '...',
  topLabel: 'commonest', bottomLabel: 'rarest',
  items: [{ id: 'pin-bar', label: 'Pin bar', note: 'body under a third of range' }],
  reveal: 'pattern-base-rates',              // optional measured table on commit
},
target: { order: ['pin-bar', 'doji', 'engulfing', 'double-top', 'head-and-shoulders'] },
tolerance: { swaps: 2 },
```

Scored on Kendall's tau — discordant pairs over total pairs, which is the number of
adjacent swaps between the two orderings, normalised. `tolerance.swaps` is in that same
unit, so you set a tolerance in swaps you can count on your fingers.

**The quantity ranked has to actually separate, and it has to be inferable.** Both halves
matter and 4.5 nearly failed the first. It was specified as "rank the patterns by win
rate", and measured, the five rates span 2.5 points with every interval overlapping every
other — there was no ordering to be right about. Ranked by sample size instead they span
57×, and a player can derive that ordering from the rules alone: the tighter a definition,
the fewer bars satisfy it.

So: compute your quantity at the intended answer *and* at a deliberately wrong one. If
they are close, the metric is wrong — the same check that caught 3.1, 3.2 and 5.2. Then
ask whether a player could reason their way to the ordering, because one that can only be
guessed is a lottery with a correction screen.

Set `swaps` below the cost of the error you actually care about. 4.5 forgives two, and
moving a chart pattern above all three candlesticks costs three.

---

## Reviewing an argument (`spot-the-flaw`)

```ts
kind: 'spot-the-flaw',
config: {
  prompt: '...',
  claims: [
    { id: 'rsi', label: 'RSI is above 50 and rising.', signal: 'rsi' },
    { id: 'round-number', label: 'Price has held a round number.' },
  ],
  reveal: 'signal-correlation',
},
target: { flawed: ['rsi', 'price-vs-sma20', 'return-10'] },
tolerance: {},
```

For an artefact that is **not a chart**. It was specified for 1.7, 5.6 and 4.6 and deferred
all three times, because a chart plus a choice is a `classify`; 6.5 is the case it waited
for, where the thing under review is a written argument.

Scored with `f1`, the same measure `mark-bars` uses, so finding two of three flaws with one
false positive scores sensibly. Marking everything is scored, and scored badly — which
matters for a level about over-confluence.

**`note` is a verdict, and it is shown only after committing** — the same as `ClassifyOption.note`.
Say so out loud because the component got it wrong for three chapters: notes rendered beside the
checkboxes, so 6.5 and 8.5 printed "The premise is true and the conclusion is not" next to the
claim the player was being asked to find. Write notes as corrections, and if you need a player to
know something _before_ they answer, it belongs in the `label` or the `brief`.

**The market is drawn where the level names one.** `data[0]` renders as a chart above the claims —
6.5's Bitcoin window is the setup the argument is about and 8.5's is the market being backtested.
The claims are still the artefact; the chart is the context for them. A level with nothing to show
uses `data: []`.

**With two flawed claims out of five, marking everything scores about 0.55**, which clears the usual
0.5 first threshold. If that is not acceptable for your level, raise it: 9.B uses `[0.6, 0.8, 0.92]`
so a player who marked every sentence in all three reports earns nothing.

**Every flawed claim must be recomputable**, which is what makes the answer measurable rather
than a matter of taste. Two ways, depending on the kind of flaw:

- **By a `signal`**, where the flaw is redundancy. `lib/ta/correlation.ts` computes which
  claims duplicate another and 6.5's content-claims test recomputes it.
- **By the chapter's own claims test**, where the flaw is a false inference from a true number.
  8.5's report quotes seven real figures and four of its sentences still do not follow — "profitable
  on all six, so the edge is in the rule" is true in its premise and wrong in its conclusion,
  because per-trade R spreads fiftyfold. There is no signal to name.

The rule was originally "give every flawed claim a `signal`", which over-fitted 6.5. A claim
that is neither recomputable nor signalled can be shown but must not be in `target.flawed`.

**A sound-but-damning claim is worth including.** 8.5 states that one market produced 43% of the
return from 23% of the trades, which is true and is what dismantles a different claim in the
list. `f1` scoring makes marking it cost something, which is the point: learning to distrust a
report is not the same as learning to read one.

**Leave out anything whose verdict depends on the market.** MACD's histogram runs 0.42 against
RSI on Bitcoin and 0.80 against the ten-bar return on SPY, so whether it is redundant is not a
fact — it is an argument, and a graded answer cannot rest on one.

---

## Composing a strategy (`build-rules`)

```ts
kind: 'build-rules',
data: [                         // one slice per market; each is its own run
  { series: 'SPY-1d', from: 210, to: 4612, label: 'S&P 500 · daily' },
  { series: 'GC-1d',  from: 210, to: 4607, label: 'Gold · daily' },
],
config: {
  prompt: '...',
  palette: 'unlocked',          // or an explicit list, to stage what the level teaches
  objective: { beatBaseline: true, minTrades: 30, minAssetsPassing: 2 },
  fixed: { exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 } },
  playbook: true,               // 10.B only
},
target: { reference: { entry: [...], exit: {...}, risk: {...} } },
tolerance: {},
```

**The composed strategy is the attempt.** The grader receives the blocks, runs them over `level.data`
through the engine and reads the verdict off the result — so it touches no store and stays as pure as
every other grader, which is what lets Chapter 10 exist alongside `CONVENTIONS.md`'s rule that no
level's graded answer may depend on the store. `predict-next` is the precedent for the other half: no
authored answer, because the answer is whatever the data did.

**`target.reference` is never compared against, and authoring one means running it.** It exists so
`perfectAttempt` has something to return, which is what lets the winnability guard prove three stars is
reachable. A reference that does not clear its own objective is an unwinnable level, and the guard is
where that gets found — as it did for 4.B in M7c.

**Set `beatBaseline` unless you can argue against it.** Measured on this spine: with a 2 ATR stop and a
2R target, entering on *every flat bar* returns +0.265R a trade on the index, +0.395R on Apple, +0.337R
on Bitcoin and +0.232R on gold. An objective of "expectancy > 0" is therefore one a random entry clears,
and every two-block rule tried while Chapter 10 was written cleared it — including one that is worse
than doing nothing. The baseline runs through *the level's own exit*, so a player widening their stop
cannot inflate the benchmark.

**State the objective per asset, never as a pooled total.** `minAssetsPassing` and `minClassesPassing`
are the fields that matter; a pooled objective passes a rule that made everything on one market, which
is the sentence 8.5 asks the player to mark as not following. Count *classes* when the point is travel:
three equities are one class.

**Ask one question per level.** `fixed` pins the parts the level is not about — 10.3 fixes the exit and
asks about the entry, 10.4 opens it — because a player's earlier choices would otherwise silently change
what a later level grades.

**Check the trade counts before choosing your markets.** A market that cannot supply `minTrades` comes
back `inconclusive`, which is neither a pass nor a fail, and an objective that needs it to pass makes
the level unclearable on the merits. 10.5 uses Apple rather than Bitcoin for exactly this reason: the
reference takes 18 trades on `BTCUSDT-1d`.

**`build-rules` cannot be a composite step.** It runs over a set of series chosen by its own config, so
a boss stage of it would widen the boss's scope past anything the cross-asset guard can see — and the
eager step map would give every boss the composer.

---

## Measuring across the spine (`probe`)

```ts
kind: 'probe',
data: [],                     // a statistic over thousands of bars is not a window
config: {
  prompt: '...',
  measure: 'variance-ratio',  // named, never a function
  label: 'horizon, in bars',
  min: 2, max: 90, step: 1, initial: 2,
  assets: [...],              // read, never displayed
  focus: 'BTCUSDT-1d',        // the row the question is about
  scoring: 'target',
  exploreFraction: 0.6,
  revealOnCommit: true,       // optional: hold the answer back until they commit
},
target: { value: 6 },         // derived from the artefact, not authored
tolerance: { slop: 2 },
```

`measure` is one of `variance-ratio`, `edge-sweep` or `drawdown`. The switch in `Probe.tsx` is exhaustive, so **a new `measure` without a readout is a compile error** — add both together.

**`revealOnCommit` is the difference between measuring and being told.** 8.2 shows its whole table from the first paint, because the question is which horizon crosses 1.0 and the player has to sweep to find it. 9.5's held-back column and 9.3's measured drawdown are the *answers*, and a player who can see them while sweeping is being shown the thing they are being asked. Where the readout is the answer, set it — and assert it in the chapter's claims test, because nothing else can.

For a question a chart cannot answer: does *this market* behave differently, and by how much.
`tune-param` could not carry it — its config **is** `(value) => IndicatorSpec` — and a variance
ratio across six markets is not an indicator on one window.

**`measure` is a name, not a function.** A function in a level file would put the computation
somewhere no test can recompute it and would ship the estimator to the client. The numbers come
from `public/data/asset-character.json`, the same relationship `sort-rank.reveal` has with the
base rates.

**The control's range must land on the artefact's own grid.** The readout reads a committed
table, so a value between two horizons would have to be interpolated — and an interpolated
variance ratio is a number nobody measured. Assert it in the chapter's claims test.

**`assets` goes in the config, not in `level.data`.** None of them is displayed, so they stay
outside the cross-asset boss guard — which is what lets a chapter measure all six markets while
its boss runs on one of them. Same call `sizing-calc` makes with `data: []`.

**And that privilege has a condition: a readout must never draw an asset's price chart from
`config.assets`.** A *derived* curve is fine — 9.3 draws the cumulative R of a rule on Apple, and R
is not a price — but the moment a readout renders candles for a series that is not in `level.data`,
the boss guard has been evaded rather than satisfied. It is the next thing somebody does by
accident, and no guard catches it, because the guard only reads `level.data`.

**Accuracy is capped by the sweep, not averaged with it.** A player who drags straight to the
answer has read a number off a table; the level is about measuring. The commit button stays
disabled until they have swept, which is clearer than a score explained afterwards.

## Sizing levels (`sizing-calc`)

```ts
kind: 'sizing-calc',
data: [],                    // sizing is arithmetic over a spec; there is no window to show
config: {
  prompt: '...',
  equity: 50_000,
  riskPct: 0.01,
  answer: 'units',           // or 'riskCurrency', or 'expectancy'
  positions: [
    { instrument: 'GC-1d', entry: 1_900, stop: 1_862, label: 'Gold · 100-ounce contracts' },
  ],
},
target: {},                  // derived, never authored
tolerance: { relative: 0.02 },
```

**Author no answers.** `answersFor` derives every row from the account, the risk and the
instrument's contract terms, and it is the same function the grader, `perfectAttempt` and the
claims test all call. Writing the numbers into the level file would create a second source and
a way for a spec change to leave a level quietly wrong.

**Tolerance is relative**, because the rows are not on one scale — 7.3 asks for 0.5 BTC on one
row and 125 shares on the next, and a flat tolerance would be unmissable on one and meaningless
on the other. A correct answer of *zero* is matched exactly rather than by ratio, because zero
is a real answer and the ratio is undefined.

**`answer: 'riskCurrency'` needs `units` on the position**, or the question answers itself: with
no size stated, "what does this position risk" is the risk budget restated. State the size and
the question becomes 7.1's, which is what one R costs.

**`answer: 'expectancy'` takes `outcomes` and no `positions`**, and a guard pairs the two so
neither can be forgotten. This is the one kind M9 bent rather than replaced, and the argument for
bending: `sizing-calc`'s identity is _type a number, derived from the config rather than authored,
graded on relative tolerance_, and an expectancy over a list of R outcomes is exactly that. Compare
9.5, where the rejection was structural — `tune-param.config.indicator` literally _is_ a function
returning an `IndicatorSpec`, so there was nothing to extend.

`answersFor` returns the mean R, and the mean is all it returns: every trade in the game risks 1R
by construction, so `winRate·avgWin − lossRate·avgLoss` _equals_ the mean. Computing both would
create two sources for one number and a way for them to drift. 9.1's claims test asserts they
agree, which is the right place for that check — once, in a test, rather than twice in the grader.

**Cite the contract terms.** A multiplier cannot be re-derived from price data, so `specFor`
carries a `source` naming the venue's own definition, and Chapter 7's claims test asserts every
instrument a level prices a trade with has one. This is the only category of number in the
project that a test cannot check against the data.

`data: []` also keeps a level out of the cross-asset boss guard, which is what lets 7.3 use gold
as its futures example while 7.B runs on gold.

---

## Sizing a run of trades (`trade-sequence`)

```ts
kind: 'trade-sequence',
config: {
  prompt: '...',
  equity: 25_000,
  maxBars: 60,
  riskChoices: [0.005, 0.01, 0.02, 0.05, 0.1],
  trades: [{ bar: 202, stop: 459.24, targetR: 2, label: 'Trade 1 · Oct 2005' }],
},
target: {},
tolerance: { maxRiskPct: 0.02, ruinBelow: 0.4 },
```

**Scored on process, not profit, and the reason is not squeamishness.** The trades are
historical, so their R outcomes are fixed before the player touches anything — no sizing
decision can change the expectancy in R of a sequence that already happened. What sizing
changes is the account path. So the score is survival (0.4), restraint (0.3) and never raising
risk after a loss (0.3).

**Offer genuinely reckless choices.** A `riskChoices` list that only contains sane options
teaches nothing; 7.B goes to 10% precisely so the wrong answer is available.

**Prefer a sequence that makes money.** 7.B's ten trades total +8.6R, so the reckless player
finishes with double the account and still scores worse — which is the lesson. A losing
sequence would let a player conclude that caution is simply what wins, rather than that sizing
is a decision whose quality is independent of the run it happens to meet.

**Check the labels against the bars.** Each trade's label names a month, and the claims test
recomputes it from `series.t`. An off-by-a-few-bars edit is otherwise invisible.

---

## Multi-timeframe levels

Two slices of the **same instrument** at different bar sizes. `LevelPlayer` links them from
the data alone, the finer timeframe driving, so the coarse pane never shows a bar that has not
closed.

- **Slice 0 is the lower timeframe.** `ReplayTrade` trades slice 0 and `simulate` scores it
  there, so listing the higher one first grades the trade on the wrong bars.
- **Both panes must cover the same period.** Only three pairings do: BTCUSDT 4h+1d, EURUSD
  1h+4h, SPY 15m+1h. EURUSD's daily and SPY's daily stop in 2023 while their intraday series
  are recent snapshots, so pairing those shows two periods that never met.
- **A level the trade rests on must be a swing inside the pane that displays it**, and not on
  its first bars. 6.2 and 6.B both shipped drafts whose level sat off the left edge, found by
  a search that looked further back than the pane showed.
- **A structure reading needs enough structure, and corroboration.** `readStructure` answers
  "what have the recent swings done", which on a short window is its tail: daily 1752-1782 of
  BTCUSDT fell 35.3% and reads as an *uptrend*, because its only four swings sit in the
  closing bounce. Require three swing highs and three swing lows, and check the label against
  the window's own net move.

---

## Content review bar

Before marking a level done, ask what a skeptical trader would object to:

- Does 3 stars require the _skill_, or just patience with the tolerance?
- Would the reference answer survive on a different asset? (If not, the boss will catch it — better to catch it now.)
- Does the level assert something the game hasn't measured? If it claims a pattern works, is that claim backed by `base-rates.json`?
- Is the brief under three sentences?
- **Is every claim in the brief visible on the chart the level displays?** Not true
  of the data somewhere — visible in _this_ window. Two Chapter 3 levels were authored
  on scan output that measured over a 200-bar lookback the level never showed: 3.6
  asserted four tests of a level while displaying two, and 3.3 asked for the retest of
  a level that, inside its own window, was never broken. A content-claims test should
  count the thing the brief counts, bounded by `slice.from`.
- Does the level's own reference score three stars _through its own grader_? The
  generic guard checks this, and in Chapter 3 it caught a grader bug rather than a
  content one — the annotate score penalised body cuts on horizontal levels, which a
  level price keeps returning to must by definition cross.
