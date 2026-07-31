# Authoring a level

The most-repeated task in this project. ~73 levels exist as data; adding one should not require writing a component.

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
| Level's own `target` scores 3 stars through its own grader         | Catches broken authoring across all ~73 levels for free. If the reference answer doesn't pass, the level is unwinnable. |
| `misconceptions.length >= 2`                                       | The teaching invariant                                                                                                  |
| Chapter boss uses a different `SeriesId` than the chapter's levels | The cross-asset transfer guarantee                                                                                      |
| No Ch 1–9 level references `public/data/oos/`                      | Keeps out-of-sample genuinely out-of-sample                                                                             |
| `from < to`, both within series bounds                             | Off-by-one and stale-index protection                                                                                   |
| Star thresholds ascending, all in `(0, 1]`                         | Malformed scoring                                                                                                       |
| `id` matches file path and chapter number                          | Registry integrity                                                                                                      |
| No level reads opens from a series on the unreliable-open list     | See below                                                                                                               |

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
fixes the feed. Issue #58 tracks the remaining cosmetic effect on Chapter 5.

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

Step data may narrow a range but **must not swap the series** — the player loads the boss's series once and the grader pairs them by position.

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

**The slice must contain the outcome**, because the grader simulates it. `primeBars`
is the only thing holding it back from the player, so getting it wrong hands over the
answer at load. It is `triggerBar - slice.from + 1`.

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
