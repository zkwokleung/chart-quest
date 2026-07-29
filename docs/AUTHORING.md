# Authoring a level

The most-repeated task in this project. ~73 levels exist as data; adding one should not require writing a component.

---

## Checklist

1. **Pick the kind.** If none of the existing kinds fit, stop and open a discussion issue — a new kind is an architecture change, not a level.
2. **Find the data slice.** Bar indices into a committed series. Use the practice/free-play screen to browse and read off indices.
3. **Write the level file** in `lib/levels/content/ch<N>/<id>.ts`.
4. **Author ≥2 misconceptions.** Not optional. See below.
5. **Set star thresholds.** Author them *loose* initially; they get calibrated after Milestone 5 playtesting.
6. **Run `npm test`.** The authoring guard tests will tell you if the level is malformed, unreachable, or violates an invariant.

---

## Skeleton

```ts
// lib/levels/content/ch2/2-3.ts
import type { Level } from '@/lib/levels/schema';

export const level: Level = {
  id: '2-3',
  chapter: 2,
  title: 'Draw the trendline',
  kind: 'annotate',
  brief: 'Drag on the chart to place a line the market actually respected.',
  data: [{ series: 'BTCUSDT-1d', from: 812, to: 980 }],
  config: {
    prompt: 'Draw a rising support line under the lows.',
    shape: 'trendline',
    side: 'support',
    requiredTouches: 3,
    expectSlope: 'up',
  },
  // Shown as the correction, never used to score — see "Drawing levels" below.
  target: {
    reference: {
      shape: 'trendline',
      a: { bar: 1012, price: 8642.72 },
      b: { bar: 1058, price: 9125 },
    },
  },
  tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
  stars: [0.5, 0.72, 0.88],
  misconceptions: [
    {
      id: 'anchored-to-bodies',
      test: (a, l, d) => countBodyCuts(a.line, d[0]) > 0,
      message: 'Your line cuts through candle bodies. Anchor to wicks — they mark where price was actually rejected.',
      showOverlay: { kind: 'highlight-bars', bars: 'body-cuts' },
    },
    {
      id: 'only-two-touches',
      test: (a, l, d) => countTouches(a.line, d[0]) < 3,
      message: 'Any two points make a line. A trendline needs a third touch before it means anything.',
    },
  ],
  unlocks: ['trendline'],
  hints: [
    'Look for the lows, not the closes.',
    'Start at the swing low around bar 826.',
  ],
};
```

---

## Misconceptions: the part that matters

**Invariant: every level authors ≥2 misconceptions.** CI fails otherwise.

A grader that returns `0.62` teaches nothing. The score tells the player they were wrong; the misconception tells them *why*, which is the only part that changes their next attempt.

Good misconception messages:

- Name the specific error in the player's own attempt — not the general principle.
- Explain the *why* in one clause. "Anchor to wicks — they mark where price was actually rejected."
- Are falsifiable by a `test` function over the attempt. If you can't write the test, the misconception is too vague.

Bad misconception messages:

- ❌ "Incorrect. Try again." — no information
- ❌ "Trendlines should connect swing lows in an uptrend." — restates the lesson, doesn't diagnose *this* attempt
- ❌ "Close! You were 12% off." — a score wearing a sentence

Order matters: `diagnosis` is returned most-specific-first, and the UI shows the top match prominently. Put narrow, high-confidence tests before broad ones.

---

## Authoring guard tests

These run on every level automatically. You don't write them; you satisfy them.

| Guard | Why |
|---|---|
| Level's own `target` scores 3 stars through its own grader | Catches broken authoring across all ~73 levels for free. If the reference answer doesn't pass, the level is unwinnable. |
| `misconceptions.length >= 2` | The teaching invariant |
| Chapter boss uses a different `SeriesId` than the chapter's levels | The cross-asset transfer guarantee |
| No Ch 1–9 level references `public/data/oos/` | Keeps out-of-sample genuinely out-of-sample |
| `from < to`, both within series bounds | Off-by-one and stale-index protection |
| Star thresholds ascending, all in `(0, 1]` | Malformed scoring |
| `id` matches file path and chapter number | Registry integrity |

---

## Star thresholds

Author loose (`[0.4, 0.65, 0.85]` is a reasonable starting guess), then calibrate after Milestone 5 when there's enough play data to see the real score distribution. Tight thresholds on an un-playtested level produce a level that feels broken rather than hard.

Three stars should mean "you did this properly," not "you matched the author's pixel-exact answer." A `tolerance` that's too tight is the commonest authoring bug.

---

## Hints

Progressive, each one costing a fraction of a star. Order from *nudge* to *near-answer*:

1. Redirect attention — "Look at the lows, not the closes."
2. Narrow the search — "Start around bar 826."
3. (Rare, only for the hardest levels) Give one component of the answer.

Never write a hint that gives the whole answer. If a level needs one, the level is mis-scoped.

---

## Drawing levels (`annotate`)

Four shapes: `trendline`, `level`, `zone`, `channel`. Two anchors become whichever the level asked for.

**Grading is intrinsic.** The player's own line is scored on its touch count, body cuts and anchor placement; the authored `target.reference` is shown as the correction and used by `perfectAttempt`, but never to score. This is measured, not stylistic: BTC-1d holds 182 lines with three or more touches and zero body cuts, so a valid answer usually is not the author's.

Three things to get right:

- **Measure the reference, do not eyeball it.** A reference read off a swing-high listing rather than measured scored one star on 2.4. The content-claims test that catches this asserts the reference earns three stars *through the grader itself*.
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

## Content review bar

Before marking a level done, ask what a skeptical trader would object to:

- Does 3 stars require the *skill*, or just patience with the tolerance?
- Would the reference answer survive on a different asset? (If not, the boss will catch it — better to catch it now.)
- Does the level assert something the game hasn't measured? If it claims a pattern works, is that claim backed by `base-rates.json`?
- Is the brief under three sentences?
