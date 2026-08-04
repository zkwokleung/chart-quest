import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import { atrFraction } from "@/lib/ta/atr";
import { sma } from "@/lib/ta/moving-average";
import { rsi } from "@/lib/ta/rsi";
import { findSwings } from "@/lib/ta/swings";
import { runStrategy } from "./engine";
import {
  compileEntry,
  warmupFor,
  SWING_K,
  type Block,
  type Signal,
} from "./blocks";

/**
 * What a composed rule fires on, checked against the primitives it is made of.
 *
 * The interesting risks here are not arithmetic — `sma`, `rsi` and `findSwings` all have their own
 * suites. They are: a cross that fires on every bar of a trend instead of the bar that turned; a
 * predicate that reads a bar it should not be able to see; and an empty stack that fires on
 * everything. All three would produce a strategy with a plausible expectancy and no meaning.
 */

const cache = new Map<string, Series<string>>();
function load(id: SeriesId): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

const SPY = load("SPY-1d");

/** Every bar in a window on which a predicate fires. */
function firesOn(blocks: Block[], series: Series<string>, from: number, to: number) {
  const entry = compileEntry(blocks);
  const bars: number[] = [];
  for (let i = from; i < to; i += 1) if (entry(series, i)) bars.push(i);
  return bars;
}

describe("an empty stack", () => {
  it("fires on nothing, because no conditions is unfinished rather than universal", () => {
    // A vacuous `all` would hand the player four thousand trades and a plausible expectancy.
    expect(firesOn([], SPY, 300, 1_000)).toEqual([]);
    expect(warmupFor([])).toBe(2);
  });
});

describe("compare", () => {
  const block: Block = {
    kind: "compare",
    left: { kind: "rsi", period: 14 },
    op: ">",
    right: 70,
  };

  it("fires exactly when the reading it names is over the threshold", () => {
    const bars = firesOn([block], SPY, 500, 1_500);
    expect(bars.length).toBeGreaterThan(20);
    for (const bar of bars) expect(rsi(SPY, bar, 14)!).toBeGreaterThan(70);
    // And nowhere else in the window.
    for (let i = 500; i < 1_500; i += 1) {
      if (bars.includes(i)) continue;
      expect(rsi(SPY, i, 14) ?? 0).toBeLessThanOrEqual(70);
    }
  });

  it("compares two signals as readily as a signal and a number", () => {
    const bars = firesOn(
      [
        {
          kind: "compare",
          left: { kind: "close" },
          op: ">",
          right: { kind: "sma", period: 200 },
        },
      ],
      SPY,
      500,
      1_500,
    );
    expect(bars.length).toBeGreaterThan(300);
    for (const bar of bars) expect(SPY.c[bar]!).toBeGreaterThan(sma(SPY, bar, 200)!);
  });

  it("is false rather than throwing where the signal has no value yet", () => {
    const early = compileEntry([
      { kind: "compare", left: { kind: "sma", period: 200 }, op: ">", right: 0 },
    ]);
    expect(early(SPY, 50)).toBe(false);
    expect(early(SPY, 500)).toBe(true);
  });
});

describe("cross", () => {
  const block: Block = {
    kind: "cross",
    fast: { kind: "sma", period: 20 },
    slow: { kind: "sma", period: 50 },
    dir: "above",
  };

  it("fires on the bar that turned, not on every bar of the trend", () => {
    // **The mistake this test exists for.** Testing only "fast > slow now" fires on hundreds of
    // bars; a cross is a two-bar event and there are a handful of them in four years.
    const crossings = firesOn([block], SPY, 300, 1_300);
    const above = firesOn(
      [
        {
          kind: "compare",
          left: { kind: "sma", period: 20 },
          op: ">",
          right: { kind: "sma", period: 50 },
        },
      ],
      SPY,
      300,
      1_300,
    );
    expect(crossings.length).toBeGreaterThan(3);
    expect(crossings.length).toBeLessThan(40);
    expect(above.length).toBeGreaterThan(crossings.length * 10);

    for (const bar of crossings) {
      expect(sma(SPY, bar - 1, 20)!).toBeLessThanOrEqual(sma(SPY, bar - 1, 50)!);
      expect(sma(SPY, bar, 20)!).toBeGreaterThan(sma(SPY, bar, 50)!);
    }
  });

  it("crosses down as the mirror of crossing up, and never on the same bar", () => {
    const up = firesOn([block], SPY, 300, 1_300);
    const down = firesOn([{ ...block, dir: "below" }], SPY, 300, 1_300);
    expect(down.length).toBeGreaterThan(3);
    expect(up.filter((bar) => down.includes(bar))).toEqual([]);
  });
});

describe("volatility", () => {
  it("thresholds ATR as a percentage, so the number travels between markets", () => {
    const quiet: Block = { kind: "volatility", atrPct: { op: "<", value: 1 } };
    // The same threshold on two markets of very different character: the point of Chapter 8.
    const onIndex = firesOn([quiet], SPY, 300, 1_300).length;
    const onCrypto = firesOn([quiet], load("BTCUSDT-1d"), 300, 1_300).length;
    expect(onIndex).toBeGreaterThan(onCrypto);
    for (const bar of firesOn([quiet], SPY, 300, 400)) {
      expect(atrFraction(SPY, bar, 14) * 100).toBeLessThan(1);
    }
  });
});

describe("structure and zones", () => {
  it("only ever uses swings the market had already confirmed", () => {
    // A swing at bar b is not knowable until b + SWING_K. Firing at b would be look-ahead with a
    // helper function in front of it, so the predicate is checked against the confirmation lag.
    const bars = firesOn([{ kind: "structure", event: "swing-low" }], SPY, 300, 1_300);
    expect(bars.length).toBeGreaterThan(10);
    // Each fires exactly SWING_K bars after the low it names, never on the low itself.
    for (const bar of bars) {
      const low = Math.min(...SPY.l.slice(bar - SWING_K, bar + 1));
      expect(SPY.l[bar - SWING_K]!).toBeCloseTo(low, 6);
    }
  });

  it("breaks structure only above the last swing high the market had confirmed", () => {
    const bars = firesOn([{ kind: "structure", event: "bos-up" }], SPY, 300, 1_300);
    expect(bars.length).toBeGreaterThan(50);

    const swings = findSwings(SPY, { from: 0, to: SPY.c.length }, SWING_K);
    for (const bar of bars) {
      const lastHigh = swings
        .filter((s) => s.kind === "high" && s.bar + SWING_K <= bar)
        .at(-1)!;
      expect(SPY.c[bar]!, `bar ${bar}`).toBeGreaterThan(lastHigh.price);
    }
  });

  it("touches a level with the bar's range rather than its close", () => {
    // 1.2's lesson: a wick is where price actually went. A close-only test would miss the touch
    // that mattered on precisely the bars a zone rule is for.
    const bars = firesOn([{ kind: "zone", touching: "support" }], SPY, 300, 1_300);
    expect(bars.length).toBeGreaterThan(10);
    const closeOnlyWouldMiss = bars.filter((bar) => {
      const low = SPY.l[bar]!;
      const close = SPY.c[bar]!;
      return close - low > atrFraction(SPY, bar, 14) * close * 0.25;
    });
    expect(closeOnlyWouldMiss.length).toBeGreaterThan(0);
  });

  it("needs a retest to have been broken first", () => {
    const retests = firesOn([{ kind: "structure", event: "retest" }], SPY, 300, 2_000);
    const zones = firesOn([{ kind: "zone", touching: "resistance" }], SPY, 300, 2_000);
    // Strictly rarer than merely touching: a level matters more once it has already gone.
    expect(retests.length).toBeGreaterThan(0);
    expect(retests.length).toBeLessThan(zones.length);
  });
});

describe("stacking", () => {
  it("is a conjunction, so each block can only reduce the count", () => {
    // Chapter 6 spent a chapter on over-confluence. A player who stacks five conditions has to
    // watch their trade count collapse, or the composer teaches the opposite of 6.5.
    const one: Block[] = [
      {
        kind: "compare",
        left: { kind: "close" },
        op: ">",
        right: { kind: "sma", period: 200 },
      },
    ];
    const two: Block[] = [
      ...one,
      { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
    ];
    const three: Block[] = [...two, { kind: "zone", touching: "support" }];

    const counts = [one, two, three].map(
      (blocks) => firesOn(blocks, SPY, 300, 3_000).length,
    );
    expect(counts[0]!).toBeGreaterThan(counts[1]!);
    expect(counts[1]!).toBeGreaterThan(counts[2]!);
    expect(counts[2]!).toBeGreaterThan(0);
  });
});

describe("warmup", () => {
  it("is derived from the blocks rather than fixed", () => {
    expect(warmupFor([{ kind: "compare", left: { kind: "sma", period: 20 }, op: ">", right: 0 }])).toBe(21);
    expect(
      warmupFor([{ kind: "compare", left: { kind: "sma", period: 200 }, op: ">", right: 0 }]),
    ).toBe(201);
  });

  it("gives a smoothed indicator three periods rather than one", () => {
    // Wilder's RSI and the MACD's EMAs carry a transient from their seed. Their first *defined*
    // value is not their converged one, and a strategy trading on a settling number is measuring
    // the seed.
    expect(warmupFor([{ kind: "compare", left: { kind: "rsi", period: 14 }, op: ">", right: 0 }])).toBe(42);
    expect(
      warmupFor([
        { kind: "compare", left: { kind: "macd", line: "histogram" }, op: ">", right: 0 },
      ]),
    ).toBe((26 + 9) * 3);
  });

  it("takes the longest requirement in the stack", () => {
    const blocks: Block[] = [
      { kind: "compare", left: { kind: "sma", period: 10 }, op: ">", right: 0 },
      { kind: "compare", left: { kind: "sma", period: 300 }, op: ">", right: 0 },
      { kind: "zone", touching: "support" },
    ];
    expect(warmupFor(blocks)).toBe(301);
  });

  it("is enough that the first signal is not built on a partial window", () => {
    // The whole point: a strategy started at its own warmup must produce a value on its first bar.
    const signals: Signal[] = [
      { kind: "sma", period: 50 },
      { kind: "ema", period: 20 },
      { kind: "rsi", period: 14 },
      { kind: "bollinger", period: 20, deviations: 2, band: "lower" },
      { kind: "macd", line: "macd" },
    ];
    for (const signal of signals) {
      const blocks: Block[] = [{ kind: "compare", left: signal, op: ">", right: -1e9 }];
      const entry = compileEntry(blocks);
      expect(entry(SPY, warmupFor(blocks)), signal.kind).toBe(true);
    }
  });
});

describe("through the engine", () => {
  it("runs a composed strategy end to end and takes real trades", () => {
    const blocks: Block[] = [
      {
        kind: "compare",
        left: { kind: "close" },
        op: ">",
        right: { kind: "sma", period: 200 },
      },
      { kind: "cross", fast: { kind: "sma", period: 20 }, slow: { kind: "sma", period: 50 }, dir: "above" },
    ];
    const run = runStrategy(SPY, {
      entry: compileEntry(blocks),
      side: "long",
      stop: { kind: "atr", multiple: 2 },
      target: { kind: "r", multiple: 2 },
      timeStopBars: 60,
      warmup: warmupFor(blocks),
    });
    expect(run.trades).toBeGreaterThan(5);
    expect(run.outcomes[0]!.entryBar).toBeGreaterThanOrEqual(warmupFor(blocks));
  });

  it("computes each indicator once per series rather than once per bar", () => {
    // Not a micro-optimisation: `rsi(series, i)` builds the whole series per call, so the naive
    // form is 21 million operations on SPY and takes seconds. A backtest a player waits for is a
    // backtest they run once.
    const blocks: Block[] = [
      { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
    ];
    const started = performance.now();
    runStrategy(SPY, {
      entry: compileEntry(blocks),
      side: "long",
      stop: { kind: "atr", multiple: 2 },
      target: { kind: "r", multiple: 2 },
      timeStopBars: 60,
      warmup: warmupFor(blocks),
    });
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
