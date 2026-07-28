# Authoring a level

The most-repeated task in this project. ~73 levels exist as data; adding one should not require writing a component.

---

## Checklist

1. **Pick the kind.** If none of the ten fit, stop and open a discussion issue — a new kind is an architecture change, not a level.
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
    mode: 'trendline',
    attempts: 3,
    snap: 'wick',
  },
  target: {
    anchors: [
      { bar: 826, price: 'low' },
      { bar: 851, price: 'low' },
    ],
  },
  tolerance: { barSlop: 2, priceSlopAtr: 0.4 },
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

Each step carries its own `target`, `tolerance` and `misconceptions`. The ≥2-misconception rule applies **per step**.

For trade bosses, **score R achieved and stop-placement quality separately** (see Ch 3.B in [`CURRICULUM.md`](CURRICULUM.md)). A profitable trade with a stop in a stupid place must not score 3 stars — that would teach outcome-chasing, which is the exact habit the game exists to cure.

---

## Content review bar

Before marking a level done, ask what a skeptical trader would object to:

- Does 3 stars require the *skill*, or just patience with the tolerance?
- Would the reference answer survive on a different asset? (If not, the boss will catch it — better to catch it now.)
- Does the level assert something the game hasn't measured? If it claims a pattern works, is that claim backed by `base-rates.json`?
- Is the brief under three sentences?
