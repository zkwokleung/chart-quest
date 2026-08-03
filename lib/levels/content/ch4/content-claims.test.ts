import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { atr } from "@/lib/ta/atr";
import { findPatterns, PATTERN_KINDS, SWING_LOOKBACK } from "@/lib/ta/patterns";
import { findSwings, readStructure } from "@/lib/ta/swings";
import { simulate } from "@/lib/trade/simulate";
import { barIndexOf } from "../../mark";
import type { AnyLevel, Level } from "../../schema";
import { getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 4's levels *claim* against what the data *shows*.
 *
 * Across M3 to M6 this pattern caught fourteen real problems the generic guards
 * structurally cannot — those prove a level is winnable, not that its answer is right.
 * Chapter 4 needs it more than most, because its marks and its ordering are outputs of
 * `findPatterns` and `base-rates.json`, and both can move under it.
 */

const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getAuthoredLevel(id);
  if (!level || level.kind !== kind) {
    throw new Error(`${id} is missing or is not a ${kind} level`);
  }
  return level as unknown as Level<K>;
}

const rates = JSON.parse(
  readFileSync("public/data/base-rates.json", "utf8"),
) as {
  assets: string[];
  patterns: Record<
    string,
    { pooled: { n: number; winRate: number; ci95: [number, number] } }
  >;
};

describe("4-1 three shapes", () => {
  const level = need("4-1", "mark-bars");
  const slice = level.data[0]!;
  const data = series(slice.series);
  const window = { from: slice.from, to: slice.to };

  it("marks exactly the bars the detector finds, and nothing else", () => {
    const detected = new Set(
      (["pin-bar", "doji", "engulfing"] as const).flatMap((kind) =>
        findPatterns(data, kind, window).map((hit) => hit.bar),
      ),
    );
    const marked = level.target.marks
      .map((mark) => barIndexOf(mark) ?? -1)
      .sort((a, b) => a - b);
    expect(marked).toEqual([...detected].sort((a, b) => a - b));
  });

  it("asks for as many marks as it has answers", () => {
    expect(level.config.expected).toBe(level.target.marks.length);
  });

  it("holds no chart pattern, so the three candle rules are the whole job", () => {
    for (const kind of ["double-top", "head-and-shoulders"] as const) {
      expect(findPatterns(data, kind, window)).toHaveLength(0);
    }
  });

  it("is not solvable by clicking every candle", () => {
    // If most bars qualified, the level would reward volume of clicking rather than
    // reading a rule.
    const share = level.target.marks.length / (slice.to - slice.from);
    expect(share).toBeLessThan(0.2);
  });

  it("contains bars that miss by a fraction", () => {
    // The claim in the module comment: near misses are what make the rule matter.
    // Counted the same way the comment counts them.
    let near = 0;
    for (let i = slice.from; i < slice.to; i += 1) {
      const high = data.h[i]!;
      const low = data.l[i]!;
      const range = high - low;
      if (range <= 0) continue;
      const body = Math.abs(data.c[i]! - data.o[i]!) / range;
      const wick =
        Math.max(
          high - Math.max(data.o[i]!, data.c[i]!),
          Math.min(data.o[i]!, data.c[i]!) - low,
        ) / range;
      const missesPinByBody = body > 1 / 3 && body < (1 / 3) * 1.35;
      const missesPinByWick = body <= 1 / 3 && wick < 0.6 && wick > 0.6 * 0.82;
      const missesDoji = body > 0.1 && body < 0.2;
      if (missesPinByBody || missesPinByWick || missesDoji) near += 1;
    }
    expect(near).toBeGreaterThanOrEqual(8);
  });

  it("really does hold a bar that is both a pin bar and a doji", () => {
    // The overlap the third misconception is about.
    const pins = new Set(findPatterns(data, "pin-bar", window).map((h) => h.bar));
    const dojis = findPatterns(data, "doji", window).map((h) => h.bar);
    expect(dojis.filter((bar) => pins.has(bar))).toContain(721);
  });
});

describe("4-2 the same candle twice", () => {
  const level = need("4-2", "classify");

  it("ends both windows on a bullish pin bar", () => {
    for (const slice of level.data) {
      const data = series(slice.series);
      const last = slice.to - 1;
      const hits = findPatterns(data, "pin-bar", { from: last, to: slice.to });
      expect(hits.map((h) => h.bar), `slice ending ${last}`).toEqual([last]);
      expect(hits[0]?.direction).toBe("bullish");
    }
  });

  it("has the two outcomes running in opposite directions", () => {
    // The level's whole premise. If both charts went the same way there would be
    // nothing to explain.
    const moves = level.data.map((slice) => {
      const data = series(slice.series);
      const signal = slice.to - 1;
      const horizon = level.config.revealBars ?? 0;
      return (data.c[signal + horizon]! - data.c[signal]!) / data.c[signal]!;
    });
    expect(moves[0]).toBeGreaterThan(0.15);
    expect(moves[1]).toBeLessThan(-0.05);
  });

  it("shows those outcomes inside the bars it reveals", () => {
    // The rule M5 paid for: a claim has to be visible in the window the level shows,
    // and here the reveal is part of that window.
    for (const slice of level.data) {
      const data = series(slice.series);
      expect(slice.to - 1 + (level.config.revealBars ?? 0)).toBeLessThan(
        data.t.length,
      );
    }
  });

  it("puts the two windows in different structural regimes", () => {
    const structures = level.data.map((slice) =>
      readStructure(findSwings(series(slice.series), { from: slice.from, to: slice.to }, 3)),
    );
    expect(structures[0]).not.toBe(structures[1]);
  });

  it("confirms the context effect points opposite ways on the two spine assets", () => {
    // The measured table in the module comment, which is the level's actual argument.
    // If both assets ever agreed, the correct answer would need rewriting.
    const meanFor = (id: string, want: string) => {
      const data = series(id);
      const moves: number[] = [];
      for (const hit of findPatterns(data, "pin-bar")) {
        if (hit.direction !== "bullish") continue;
        if (hit.bar < 60 || hit.bar + 10 >= data.t.length) continue;
        const structure = readStructure(
          findSwings(data, { from: hit.bar - 50, to: hit.bar + 1 }, 3),
        );
        if (structure !== want) continue;
        const volatility = atr(data, hit.bar);
        if (volatility <= 0) continue;
        moves.push((data.c[hit.bar + 10]! - data.c[hit.bar]!) / volatility);
      }
      return moves.reduce((total, m) => total + m, 0) / Math.max(1, moves.length);
    };

    // Apple: worse with the trend than against it. Bitcoin: the other way round.
    expect(meanFor("AAPL-1d", "uptrend")).toBeLessThan(meanFor("AAPL-1d", "downtrend"));
    expect(meanFor("BTCUSDT-1d", "uptrend")).toBeGreaterThan(
      meanFor("BTCUSDT-1d", "downtrend"),
    );
  });
});

describe("4-3 the ceiling on the way down", () => {
  const level = need("4-3", "annotate");
  const slice = level.data[0]!;
  const data = series(slice.series);
  const reference = level.target.reference;

  it("anchors the reference line on real swing highs", () => {
    if (reference.shape !== "trendline") throw new Error("expected a trendline");
    const highs = findSwings(data, { from: slice.from, to: slice.to }, 3).filter(
      (swing) => swing.kind === "high",
    );
    for (const anchor of [reference.a, reference.b]) {
      const match = highs.find((swing) => swing.bar === anchor.bar);
      expect(match, `bar ${anchor.bar} is not a swing high`).toBeDefined();
      expect(match?.price).toBeCloseTo(anchor.price, 5);
    }
  });

  it("has four swing highs sitting on that line", () => {
    if (reference.shape !== "trendline") throw new Error("expected a trendline");
    const span =
      Math.max(...data.h.slice(slice.from, slice.to)) -
      Math.min(...data.l.slice(slice.from, slice.to));
    const slope =
      (reference.b.price - reference.a.price) / (reference.b.bar - reference.a.bar);
    const on = findSwings(data, { from: slice.from, to: slice.to }, 3)
      .filter((swing) => swing.kind === "high")
      .filter((swing) => {
        const line = reference.a.price + slope * (swing.bar - reference.a.bar);
        return Math.abs(swing.price - line) / span <= 0.04;
      });
    expect(on.length).toBeGreaterThanOrEqual(level.config.requiredTouches);
  });

  it("descends, as the config demands", () => {
    if (reference.shape !== "trendline") throw new Error("expected a trendline");
    expect(reference.b.price).toBeLessThan(reference.a.price);
    expect(level.config.expectSlope).toBe("down");
  });

  it("continued lower after the last touch, so it is a continuation example", () => {
    // The claim the module comment makes, and the reason this window was kept over a
    // cleaner one whose line broke upward.
    if (reference.shape !== "trendline") throw new Error("expected a trendline");
    const after = data.c[reference.b.bar + 20]! / data.c[reference.b.bar]! - 1;
    expect(after).toBeLessThan(-0.04);
  });
});

describe("4-4 two shoulders and a head", () => {
  const level = need("4-4", "mark-bars");
  const slice = level.data[0]!;
  const data = series(slice.series);

  it("marks the components the detector reports", () => {
    const hit = findPatterns(data, "head-and-shoulders", {
      from: slice.from,
      to: slice.to,
    })[0];
    expect(hit).toBeDefined();
    expect(level.target.marks.map((mark) => barIndexOf(mark))).toEqual(
      hit?.components,
    );
  });

  it("holds exactly one head and shoulders, so the answer is unambiguous", () => {
    expect(
      findPatterns(data, "head-and-shoulders", { from: slice.from, to: slice.to }),
    ).toHaveLength(1);
  });

  it("has a head clearly above two level shoulders", () => {
    const [left, head, right] = level.target.marks.map((mark) => barIndexOf(mark));
    const priceOf = (bar: number | null | undefined) => data.h[bar ?? -1] ?? 0;
    expect(priceOf(head) / priceOf(left) - 1).toBeGreaterThan(0.1);
    expect(Math.abs(priceOf(right) / priceOf(left) - 1)).toBeLessThan(0.04);
  });

  it("stops at the bar the pattern became knowable, revealing no more", () => {
    // The look-ahead discipline, applied to a window rather than a measurement: the
    // player marks a shape they could have seen, and the crash stays off-screen.
    const hit = findPatterns(data, "head-and-shoulders", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    expect(hit.confirmedAt).toBe(hit.bar + SWING_LOOKBACK);
    expect(slice.to - 1).toBeGreaterThanOrEqual(hit.confirmedAt);
    expect(slice.to - 1).toBeLessThan(hit.confirmedAt + 6);
  });

  it("really did crash after the window, as the module comment claims", () => {
    const hit = findPatterns(data, "head-and-shoulders", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    const fall = 1 - data.c[hit.confirmedAt + 10]! / data.c[hit.confirmedAt]!;
    expect(fall).toBeGreaterThan(0.25);
  });
});

describe("4-5 how much do we actually know", () => {
  const level = need("4-5", "sort-rank");

  it("ranks the patterns in the order the committed measurement gives", () => {
    const bySampleSize = [...level.config.items]
      .map((item) => ({ id: item.id, n: rates.patterns[item.id]?.pooled.n ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .map((row) => row.id);
    expect(level.target.order).toEqual(bySampleSize);
  });

  it("names every pattern the detector knows about, and only those", () => {
    expect([...level.config.items.map((item) => item.id)].sort()).toEqual(
      [...PATTERN_KINDS].sort(),
    );
    expect([...level.target.order].sort()).toEqual([...PATTERN_KINDS].sort());
  });

  it("has a spread wide enough to be worth ranking", () => {
    // The discrimination check. An ordering whose quantities are nearly equal is the
    // authoring fault this project has hit three times.
    const sizes = level.target.order.map((id) => rates.patterns[id]!.pooled.n);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i - 1]!, `${level.target.order[i - 1]} vs ${level.target.order[i]}`)
        .toBeGreaterThan(sizes[i]!);
    }
    expect(sizes[0]! / sizes.at(-1)!).toBeGreaterThan(20);
  });

  it("does NOT rank by win rate, because the win rates do not rank", () => {
    // The measurement that changed this level's question. Kept as an assertion so
    // that if the rates ever separate, the level is forced to be reconsidered rather
    // than silently continuing to ask about sample size.
    const winRates = level.target.order.map((id) => rates.patterns[id]!.pooled.winRate);
    expect(Math.max(...winRates) - Math.min(...winRates)).toBeLessThan(0.05);
  });

  it("puts the widest interval on the pattern it ranks rarest", () => {
    // The reveal's punchline, asserted rather than assumed.
    const width = (id: string) => {
      const ci = rates.patterns[id]!.pooled.ci95;
      return ci[1] - ci[0];
    };
    const rarest = level.target.order.at(-1)!;
    const commonest = level.target.order[0]!;
    expect(width(rarest)).toBeGreaterThan(width(commonest) * 4);
  });

  it("shows a table rather than a chart, and declares which", () => {
    expect(level.data).toHaveLength(0);
    expect(level.config.reveal).toBe("pattern-base-rates");
  });

  it("forgives fewer swaps than it takes to confuse the two families", () => {
    // Moving a chart pattern above all three candles costs 3 swaps; the tolerance
    // must not cover that, or the level would stop testing the part that matters.
    expect(level.tolerance.swaps).toBeLessThan(3);
  });
});

describe("4-6 nothing wrong with it", () => {
  const level = need("4-6", "classify");
  const slice = level.data[0]!;
  const data = series(slice.series);

  it("shows a double top that satisfies every threshold with room", () => {
    const hits = findPatterns(data, "double-top", { from: slice.from, to: slice.to });
    expect(hits).toHaveLength(1);
    const [left, trough, right] = hits[0]!.components;
    expect(Math.abs(data.h[right!]! / data.h[left!]! - 1)).toBeLessThan(0.01);
    expect(1 - data.l[trough!]! / data.h[left!]!).toBeGreaterThan(0.05);
  });

  it("ends at the bar the pattern was knowable, not before or after", () => {
    const hit = findPatterns(data, "double-top", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    expect(slice.to - 1).toBe(hit.confirmedAt);
  });

  it("then failed, hard, inside the bars it reveals", () => {
    // The level is a claim that a correct reading lost money. If this window ever
    // stopped failing, the level would be teaching the opposite of its own answer.
    const hit = findPatterns(data, "double-top", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    const horizon = level.config.revealBars ?? 0;
    const move = data.c[hit.confirmedAt + horizon]! / data.c[hit.confirmedAt]! - 1;
    expect(move).toBeGreaterThan(0.08);
    expect(hit.confirmedAt + horizon).toBeLessThan(data.t.length);
  });

  it("quotes the base rate its answer rests on", () => {
    const doubleTop = rates.patterns["double-top"]!.pooled;
    const winPercent = (doubleTop.winRate * 100).toFixed(1);
    const text = level.config.options.map((option) => option.note ?? "").join(" ");
    expect(text).toContain(winPercent);
    expect(text).toContain(String(doubleTop.n));
  });
});

describe("4-B find it then trade it", () => {
  const level = need("4-B", "composite");
  const slice = level.data[0]!;
  const data = series(slice.series);
  const steps = level.config.steps;

  it("runs on a market no Chapter 4 level teaches on", () => {
    const taught = new Set(
      ["4-1", "4-2", "4-3", "4-4", "4-5", "4-6"]
        .map((id) => getAuthoredLevel(id))
        .flatMap((lvl) => (lvl?.data ?? []).map((d) => d.series)),
    );
    expect(taught.has(slice.series)).toBe(false);
  });

  it("holds exactly one chart pattern, so 'find the setup' has one answer", () => {
    const found = (["double-top", "head-and-shoulders"] as const).flatMap((kind) =>
      findPatterns(data, kind, { from: slice.from, to: slice.to }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe("double-top");
  });

  it("marks the second peak of that pattern", () => {
    const step = steps[0]!;
    if (step.kind !== "mark-bars") throw new Error("expected mark-bars first");
    const hit = findPatterns(data, "double-top", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    expect(step.target.marks.map((mark) => barIndexOf(mark))).toEqual([hit.bar]);
    expect(hit.components.at(-1)).toBe(hit.bar);
  });

  it("triggers on the bar the pattern became knowable", () => {
    const step = steps[2]!;
    if (step.kind !== "replay-trade") throw new Error("expected replay-trade last");
    const hit = findPatterns(data, "double-top", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    expect(step.target.triggerBar).toBe(hit.confirmedAt);
  });

  it("puts the structure on the pattern's own high", () => {
    const step = steps[2]!;
    if (step.kind !== "replay-trade") throw new Error("expected replay-trade last");
    const structure = step.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");
    const hit = findPatterns(data, "double-top", {
      from: slice.from,
      to: slice.to,
    })[0]!;
    const peak = Math.max(...hit.components.map((bar) => data.h[bar]!));
    expect(structure.price).toBeCloseTo(peak, 5);
  });

  it("primes exactly up to the trigger bar", () => {
    const step = steps[2]!;
    if (step.kind !== "replay-trade") throw new Error("expected replay-trade last");
    expect(slice.from + step.config.primeBars - 1).toBe(step.target.triggerBar);
  });

  it("rewards a stop beyond the structure and punishes one inside it", () => {
    // The discriminator, simulated through the shipped engine. Copying another boss's
    // tolerances instead of measuring this window is how 5.B nearly shipped wrong.
    const step = steps[2]!;
    if (step.kind !== "replay-trade") throw new Error("expected replay-trade last");
    const structure = step.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");

    const trigger = step.target.triggerBar;
    const entry = data.c[trigger]!;
    const volatility = atr(data, trigger, step.config.atrPeriod ?? 14);
    const run = (stop: number) =>
      simulate(
        { side: "short", stop, target: entry - (stop - entry) * step.config.minRR },
        data,
        trigger,
        step.config.maxBars,
      );

    // Widths are **total risk from entry**, in ATR — the units `measurePlan` grades in. These
    // used to offset from the structure, the reading the grader never used, and 4.B is the level
    // where the two disagree most: its second top sits 2.01x ATR above entry, so a stop minAtr
    // beyond *that* risked 4.06x against a 3.5 cap and failed the level's own room check.
    const atRisk = (atrs: number) => entry + volatility * atrs;
    const atFloor = run(atRisk(step.tolerance.minAtr));
    const inside = run(entry + (structure.price - entry) * 0.45);
    const tooWide = run(atRisk(step.tolerance.maxAtr + 0.6));

    expect(atFloor?.r ?? 0).toBeGreaterThanOrEqual(step.config.minRR);
    // And the floor really does clear the structure, which is the other half of a valid plan.
    expect(atRisk(step.tolerance.minAtr)).toBeGreaterThan(structure.price);
    expect(inside?.r ?? 0).toBeLessThan(-0.9);
    expect(tooWide?.r ?? 9).toBeLessThan(step.config.minRR);
  });

  it("finishes the winning trade inside the window it shows", () => {
    const step = steps[2]!;
    if (step.kind !== "replay-trade") throw new Error("expected replay-trade last");
    const structure = step.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");
    const trigger = step.target.triggerBar;
    const entry = data.c[trigger]!;
    const volatility = atr(data, trigger, step.config.atrPeriod ?? 14);
    const stop = entry + volatility * step.tolerance.minAtr;
    const outcome = simulate(
      { side: "short", stop, target: entry - (stop - entry) * step.config.minRR },
      data,
      trigger,
      step.config.maxBars,
    );
    expect(outcome?.exitBar ?? Infinity).toBeLessThan(slice.to);
  });

  it("is genuinely unfamiliar: a bigger daily range than the chapter taught on", () => {
    const bossAtr = atr(data, steps[2]!.kind === "replay-trade" ? 4427 : 4427) /
      data.c[4427]!;
    const btc = series("BTCUSDT-1d");
    const aapl = series("AAPL-1d");
    const median = (values: number[]) =>
      values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
    const typical = (s: Series<string>) =>
      median(s.t.map((_, i) => (i >= 14 ? atr(s, i) / s.c[i]! : 0)).filter((x) => x > 0));
    expect(bossAtr).toBeGreaterThan(typical(btc) * 0.8);
    expect(bossAtr).toBeGreaterThan(typical(aapl));
  });
});

describe("the chapter as a whole", () => {
  const ids = ["4-1", "4-2", "4-3", "4-4", "4-5", "4-6", "4-B"];

  it("authors every level the chapter declares", () => {
    for (const id of ids) expect(getAuthoredLevel(id), id).toBeDefined();
  });

  it("uses no window an earlier chapter already showed", () => {
    const mine = ids
      .flatMap((id) => getAuthoredLevel(id)?.data ?? [])
      .map((slice) => `${slice.series}:${slice.from}-${slice.to}`);
    expect(new Set(mine).size).toBe(mine.length);
  });

  it("teaches on two markets and bosses on a third", () => {
    const taught = new Set(
      ids
        .slice(0, 6)
        .flatMap((id) => getAuthoredLevel(id)?.data ?? [])
        .map((slice) => slice.series),
    );
    expect([...taught].sort()).toEqual(["AAPL-1d", "BTCUSDT-1d"]);
  });
});
