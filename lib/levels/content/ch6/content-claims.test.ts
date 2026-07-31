import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { barContaining, barEnd } from "@/lib/replay/linked";
import { atr } from "@/lib/ta/atr";
import {
  correlationMatrix,
  redundantSignals,
  type SignalId,
} from "@/lib/ta/correlation";
import { findPatterns } from "@/lib/ta/patterns";
import { findSwings, readStructure } from "@/lib/ta/swings";
import { simulate } from "@/lib/trade/simulate";
import { barIndexOf } from "../../mark";
import type { AnyLevel, Level, LevelSlice } from "../../schema";
import { getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 6's levels *claim* against what the data *shows*.
 *
 * Fourteen real problems across M3–M7, and this chapter contributed several of its own
 * before shipping: two levels named a higher-timeframe level that was not inside the pane
 * they display, one structure reading contradicted its own window by 35 percentage points,
 * and 6.4's first confluence definition counted two things the charts do not draw.
 *
 * So the assertions here are deliberately about *premises* rather than outputs: that a pane
 * contains what the level says it contains, that a structure label agrees with the prices
 * under it, and that the confirmations a player is asked to count are visible.
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

/**
 * A structure reading, with the two checks that stop it lying.
 *
 * `readStructure` answers "what have the recent swings done", which on a short window is
 * its tail rather than the window. Daily 1752-1782 fell 35.3% and reads as an uptrend
 * because its only four swings sit in the closing bounce — so a level claiming a structural
 * bias has to show enough swings to have one, and a label that agrees with the net move.
 */
function reading(s: Series<string>, from: number, to: number) {
  const swings = findSwings(s, { from, to }, 3);
  const highs = swings.filter((w) => w.kind === "high").length;
  const lows = swings.filter((w) => w.kind === "low").length;
  const label = readStructure(swings);
  const net = s.c[to - 1]! / s.c[from]! - 1;
  return { label, net, highs, lows };
}

/**
 * The two panes of a multi-timeframe level, low timeframe first.
 *
 * Takes the slices rather than the level: `Level<K>` is not assignable to
 * `Level<LevelKind>` because a misconception's `test` accepts that kind's own attempt, and
 * function parameters are contravariant. Passing `level.data` sidesteps the variance
 * instead of casting around it — see the note in `lib/levels/kinds/index.ts`.
 */
function panes(slices: readonly LevelSlice[]) {
  const [low, high] = slices;
  if (!low || !high) throw new Error("not a two-pane level");
  return { low, high, lowSeries: series(low.series), highSeries: series(high.series) };
}

describe("every multi-timeframe level", () => {
  const ids = ["6-1", "6-2", "6-3", "6-B"];

  it.each(ids)("%s shows the same instrument at two different bar sizes", (id) => {
    const { lowSeries, highSeries } = panes(getAuthoredLevel(id)!.data);
    const instrument = (sid: string) => sid.replace(/-(1d|4h|1h|15m)$/, "");
    expect(instrument(lowSeries.id)).toBe(instrument(highSeries.id));
    expect(lowSeries.tf).not.toBe(highSeries.tf);
  });

  it.each(ids)("%s lists the lower timeframe first", (id) => {
    // `ReplayTrade` trades slice 0 and `simulate` scores it there, so a level listing the
    // higher timeframe first would grade a trade on the wrong bars. Uniform across the
    // chapter so the convention is not a per-level detail.
    const order = ["15m", "1h", "4h", "1d"];
    const level = getAuthoredLevel(id)!;
    const { lowSeries, highSeries } = panes(level.data);
    expect(order.indexOf(lowSeries.tf)).toBeLessThan(order.indexOf(highSeries.tf));
  });

  it.each(ids)("%s has both panes covering the same period", (id) => {
    // The failure that makes a multi-timeframe level meaningless: two views of periods
    // that do not overlap. It is why EURUSD-4h and SPY-1h had to be derived at all.
    const { low, high, lowSeries, highSeries } = panes(getAuthoredLevel(id)!.data);
    const lowSpan = [lowSeries.t[low.from]!, lowSeries.t[low.to - 1]!] as const;
    const highSpan = [highSeries.t[high.from]!, highSeries.t[high.to - 1]!] as const;
    const overlap =
      Math.min(lowSpan[1], highSpan[1]) - Math.max(lowSpan[0], highSpan[0]);
    const lowLength = lowSpan[1] - lowSpan[0];
    // The higher pane may reach further back for context, but it must contain most of what
    // the lower pane shows.
    expect(overlap / lowLength).toBeGreaterThan(0.8);
  });
});

describe("6-1 two clocks, one market", () => {
  const level = need("6-1", "classify");
  const { low, high, lowSeries, highSeries } = panes(level.data);

  it("has a corroborated uptrend on the higher pane", () => {
    const r = reading(highSeries, high.from, high.to);
    expect(r.label).toBe("uptrend");
    expect(r.net).toBeGreaterThan(0.02);
    expect(r.highs).toBeGreaterThanOrEqual(3);
    expect(r.lows).toBeGreaterThanOrEqual(3);
  });

  it("has a genuine pause on the lower pane, not a trend", () => {
    const r = reading(lowSeries, low.from, low.to);
    expect(r.label).toBe("range");
    expect(Math.abs(r.net)).toBeLessThan(0.15);
    expect(r.highs).toBeGreaterThanOrEqual(3);
    expect(r.lows).toBeGreaterThanOrEqual(3);
  });

  it("quotes a higher-timeframe move the brief can support", () => {
    // The brief says "up twelve percent".
    expect(reading(highSeries, high.from, high.to).net * 100).toBeCloseTo(12, 0);
  });
});

describe("6-3 a fortnight against a quarter", () => {
  const level = need("6-3", "classify");
  const { low, high, lowSeries, highSeries } = panes(level.data);

  it("really does have the two timeframes disagreeing", () => {
    const fast = reading(lowSeries, low.from, low.to);
    const slow = reading(highSeries, high.from, high.to);
    expect(fast.label).toBe("uptrend");
    expect(slow.label).toBe("downtrend");
  });

  it("corroborates both readings against their own prices", () => {
    // The check that would have caught the 35%-fall-reads-as-uptrend artefact.
    const fast = reading(lowSeries, low.from, low.to);
    const slow = reading(highSeries, high.from, high.to);
    expect(fast.net).toBeGreaterThan(0.02);
    expect(slow.net).toBeLessThan(-0.02);
    for (const r of [fast, slow]) {
      expect(r.highs).toBeGreaterThanOrEqual(3);
      expect(r.lows).toBeGreaterThanOrEqual(3);
    }
  });

  it("quotes the two figures the brief uses", () => {
    // "up eight percent" and "down thirty-four".
    expect(reading(lowSeries, low.from, low.to).net * 100).toBeCloseTo(8, 0);
    expect(reading(highSeries, high.from, high.to).net * 100).toBeCloseTo(-34, 0);
  });

  it("keeps no unbroken lower high on the daily pane, as the answer claims", () => {
    // The correct option says the quarter-long sequence of lower highs is intact. If a
    // daily high had been exceeded, the level would be teaching the opposite of its answer.
    const highs = findSwings(highSeries, { from: high.from, to: high.to }, 3).filter(
      (w) => w.kind === "high",
    );
    const rising = highs.slice(1).filter((w, i) => w.price > highs[i]!.price).length;
    expect(rising / (highs.length - 1)).toBeLessThan(0.5);
  });
});

describe("6-4 stacking the deck", () => {
  const level = need("6-4", "sort-rank");
  const data = series("BTCUSDT-4h");

  /** The three confirmations the level asks about — all visible in price. */
  function ticksAt(bar: number) {
    const window = { from: bar - 60, to: bar + 1 };
    const swings = findSwings(data, window, 3);
    const lows = swings.filter((w) => w.kind === "low");
    const a = atr(data, bar);
    return {
      atSupport: lows.some(
        (w) => w.bar < bar - 2 && Math.abs(data.l[bar]! - w.price) < a * 0.6,
      ),
      bullishCandle:
        findPatterns(data, "pin-bar", { from: bar, to: bar + 1 }).some(
          (p) => p.direction === "bullish",
        ) ||
        findPatterns(data, "engulfing", { from: bar, to: bar + 1 }).some(
          (p) => p.direction === "bullish",
        ),
      risingStructure: readStructure(swings) === "uptrend",
    };
  }

  it("has one chart per item, and four distinct confirmation counts", () => {
    expect(level.data).toHaveLength(4);
    const counts = level.config.items.map((item) => {
      const slice = level.data[item.slice!]!;
      return Object.values(ticksAt(slice.to - 1)).filter(Boolean).length;
    });
    expect([...counts].sort()).toEqual([0, 1, 2, 3]);
  });

  it("orders the items by their measured confirmation count", () => {
    const counted = level.config.items.map((item) => ({
      id: item.id,
      count: Object.values(ticksAt(level.data[item.slice!]!.to - 1)).filter(Boolean).length,
    }));
    const byCount = [...counted].sort((a, b) => b.count - a.count).map((c) => c.id);
    expect(level.target.order).toEqual(byCount);
  });

  it("describes each item's confirmations accurately in its note", () => {
    // The notes name which of the three each setup shows; a wrong note would make the
    // ranking unfair in the one place a player would trust it.
    for (const item of level.config.items) {
      const ticks = ticksAt(level.data[item.slice!]!.to - 1);
      const note = item.note ?? "";
      expect(note.includes("at a level"), `${item.id} atSupport`).toBe(ticks.atSupport);
      expect(note.includes("reversal candle"), `${item.id} candle`).toBe(
        ticks.bullishCandle,
      );
      expect(note.includes("higher lows"), `${item.id} structure`).toBe(
        ticks.risingStructure,
      );
    }
  });

  it("uses four windows that do not overlap each other", () => {
    const sorted = [...level.data].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.from).toBeGreaterThan(sorted[i - 1]!.to);
    }
  });

  it("confirms that confluence bought nothing, which is the whole reveal", () => {
    // Recomputed here rather than trusted: if this ever separates, the level's answer text
    // is wrong and needs rewriting rather than this assertion relaxing.
    const outcomes = new Map<number, number[]>();
    for (let bar = 200; bar < data.t.length - 100; bar += 1) {
      const structure = findSwings(data, { from: bar - 40, to: bar + 1 }, 3)
        .filter((w) => w.kind === "low" && w.price < data.c[bar]!)
        .at(-1);
      const a = atr(data, bar);
      if (!structure || a <= 0) continue;
      const stop = structure.price - a * 0.25;
      const entry = data.c[bar]!;
      const risk = entry - stop;
      if (risk <= 0 || risk / a > 4) continue;
      const sim = simulate(
        { side: "long", stop, target: entry + risk * 2 },
        data,
        bar,
        90,
      );
      if (!sim) continue;
      const count = Object.values(ticksAt(bar)).filter(Boolean).length;
      if (!outcomes.has(count)) outcomes.set(count, []);
      outcomes.get(count)!.push(sim.r);
    }

    const hitRates = [0, 1, 2, 3].map((n) => {
      const rs = outcomes.get(n) ?? [];
      return rs.filter((r) => r >= 1.9).length / Math.max(1, rs.length);
    });
    // Every count within five points of every other: flat, not merely non-monotone.
    expect(Math.max(...hitRates) - Math.min(...hitRates)).toBeLessThan(0.05);
    // And the sample is large enough for that to mean something.
    expect([...outcomes.values()].reduce((t, rs) => t + rs.length, 0)).toBeGreaterThan(3000);
  });
});

describe("6-5 seven reasons, three facts", () => {
  const level = need("6-5", "spot-the-flaw");
  const slice = level.data[0]!;

  it("marks exactly the claims that duplicate another, recomputed", () => {
    const signals = level.config.claims
      .map((claim) => claim.signal)
      .filter((id): id is SignalId => id !== undefined);
    const matrix = correlationMatrix(series(slice.series), signals, {
      from: slice.from,
      to: slice.to,
    });
    expect([...redundantSignals(matrix)].sort()).toEqual([...level.target.flawed].sort());
  });

  it("gives every flawed claim a measurable signal", () => {
    // A claim cannot be graded as redundant unless there is something to correlate.
    const withSignals = new Set(
      level.config.claims.filter((c) => c.signal).map((c) => c.id),
    );
    for (const id of level.target.flawed) expect(withSignals.has(id)).toBe(true);
  });

  it("includes claims that are genuinely independent, so the answer is not 'all of them'", () => {
    const sound = level.config.claims
      .filter((c) => c.signal && !level.target.flawed.includes(c.id))
      .map((c) => c.signal!) as SignalId[];
    expect(sound.length).toBeGreaterThanOrEqual(2);
    const matrix = correlationMatrix(series(slice.series), sound, {
      from: slice.from,
      to: slice.to,
    });
    expect(redundantSignals(matrix)).toEqual([]);
  });

  it("leaves MACD out of the claims entirely", () => {
    // Whether it is redundant depends on the market — 0.42 against RSI on Bitcoin, 0.80
    // against the ten-bar return on SPY — so it cannot carry a graded answer.
    const signals = level.config.claims.map((c) => c.signal);
    expect(signals).not.toContain("macd-histogram");
  });
});

describe("6-6 the first half hour", () => {
  const level = need("6-6", "classify");
  const slice = level.data[0]!;
  const data = series(slice.series);

  /** Sessions inside the level's own window. */
  const sessions = (() => {
    const byDay = new Map<string, number[]>();
    for (let i = slice.from; i < slice.to; i += 1) {
      const key = new Date(data.t[i]!).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(i);
    }
    return [...byDay.values()].filter((idx) => idx.length >= 24);
  })();

  it("shows three whole sessions", () => {
    expect(sessions).toHaveLength(3);
  });

  it("has the opening range broken in every session shown", () => {
    // The level's answer. If one of these three held, the brief's claim would be shakier
    // than the wording admits.
    for (const idx of sessions) {
      const open = idx.slice(0, 2);
      const high = Math.max(...open.map((i) => data.h[i]!));
      const low = Math.min(...open.map((i) => data.l[i]!));
      const broke = idx.slice(2).some((i) => data.h[i]! > high || data.l[i]! < low);
      expect(broke).toBe(true);
    }
  });

  it("quotes each session's share of its day correctly", () => {
    // The brief says 37%, 28% and 78%, which the guard cannot check because they are a
    // ratio between two spans rather than one bar's move.
    const shares = sessions.map((idx) => {
      const open = idx.slice(0, 2);
      const openRange =
        Math.max(...open.map((i) => data.h[i]!)) - Math.min(...open.map((i) => data.l[i]!));
      const dayRange =
        Math.max(...idx.map((i) => data.h[i]!)) - Math.min(...idx.map((i) => data.l[i]!));
      return Math.round((openRange / dayRange) * 100);
    });
    expect(shares).toEqual([37, 28, 78]);
  });

  it("supports the 1.7x concentration the misconception quotes, over all sessions", () => {
    const all = (() => {
      const byDay = new Map<string, number[]>();
      data.t.forEach((t, i) => {
        const key = new Date(t).toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(i);
      });
      return [...byDay.values()].filter((idx) => idx.length >= 24);
    })();
    const shares = all.map((idx) => {
      const widths = idx.map((i) => data.h[i]! - data.l[i]!);
      const total = widths.reduce((t, w) => t + w, 0);
      return (widths[0]! + widths[1]!) / total;
    });
    const median = [...shares].sort((a, b) => a - b)[Math.floor(shares.length / 2)]!;
    // 13.1% of the summed range from 7.7% of the bars.
    expect(median * 100).toBeCloseTo(13.1, 0);
    expect(median / (2 / 26)).toBeGreaterThan(1.5);
  });

  it("finds the opening range holding all day on almost no session", () => {
    const all = (() => {
      const byDay = new Map<string, number[]>();
      data.t.forEach((t, i) => {
        const key = new Date(t).toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(i);
      });
      return [...byDay.values()].filter((idx) => idx.length >= 24);
    })();
    const held = all.filter((idx) => {
      const open = idx.slice(0, 2);
      const high = Math.max(...open.map((i) => data.h[i]!));
      const low = Math.min(...open.map((i) => data.l[i]!));
      return !idx.slice(2).some((i) => data.h[i]! > high || data.l[i]! < low);
    });
    expect(all.length).toBe(40);
    expect(held.length).toBe(1);
  });
});

/**
 * The trade assertions, shared by 6.2 (a standalone replay) and 6.B's third stage.
 *
 * Written as a function over explicit values rather than a `describe.each` over the two
 * level shapes: a composite step and a whole level are different types, and unifying them
 * needs casts that would hide exactly the kind of mismatch these checks exist to find.
 */
function checkTrade(
  label: string,
  spec: {
    low: LevelSlice;
    high: LevelSlice;
    structure: number;
    triggerBar: number;
    side: "long" | "short";
    minRR: number;
    maxBars: number;
    primeBars: number;
    atrPeriod: number;
    minAtr: number;
    maxAtr: number;
  },
) {
  describe(label, () => {
    const lowSeries = series(spec.low.series);
    const highSeries = series(spec.high.series);
    const short = spec.side === "short";
    const entry = () => lowSeries.c[spec.triggerBar]!;
    const volatility = () => atr(lowSeries, spec.triggerBar, spec.atrPeriod);

    const run = (stop: number) =>
      simulate(
        {
          side: spec.side,
          stop,
          target: short
            ? entry() - (stop - entry()) * spec.minRR
            : entry() + (entry() - stop) * spec.minRR,
        },
        lowSeries,
        spec.triggerBar,
        spec.maxBars,
      );
    const beyond = (atrs: number) =>
      short ? spec.structure + volatility() * atrs : spec.structure - volatility() * atrs;

    it("puts the structure on a swing inside the pane that displays it", () => {
      // The defect both of these shipped with in draft: a level found forty bars back
      // while the pane showed twenty, so the premise sat off the left edge.
      const swings = findSwings(highSeries, { from: spec.high.from, to: spec.high.to }, 3);
      const match = swings.find((w) => Math.abs(w.price - spec.structure) < 1e-9);
      expect(match, `${spec.structure} is not a swing in that pane`).toBeDefined();
      // And not on the first bars, or there is no history showing price turned there.
      expect(match!.bar - spec.high.from).toBeGreaterThan(2);
    });

    it("puts the structure on the side of price the trade needs", () => {
      expect(short ? spec.structure > entry() : spec.structure < entry()).toBe(true);
    });

    it("primes exactly up to the trigger bar", () => {
      expect(spec.low.from + spec.primeBars - 1).toBe(spec.triggerBar);
    });

    it("reaches its target inside the window it shows", () => {
      const outcome = run(beyond(spec.minAtr));
      expect(outcome?.r ?? 0).toBeGreaterThanOrEqual(spec.minRR);
      expect(outcome!.exitBar).toBeLessThan(spec.low.to);
    });

    it("punishes a stop inside the level", () => {
      const stop = entry() + (spec.structure - entry()) * 0.45;
      expect(run(stop)?.r ?? 0).toBeLessThan(-0.9);
    });

    it("still reaches the target at the tolerance ceiling", () => {
      // 6.2 never punishes width and 6.B does, so the ceilings differ on purpose. What
      // must hold either way: a stop the tolerance accepts is a stop that works.
      expect(run(beyond(spec.maxAtr))?.r ?? 0).toBeGreaterThanOrEqual(spec.minRR);
    });
  });
}

{
  const level = need("6-2", "replay-trade");
  checkTrade("6-2: the trade", {
    low: level.data[0]!,
    high: level.data[1]!,
    structure:
      level.target.structure.shape === "level" ? level.target.structure.price : NaN,
    triggerBar: level.target.triggerBar,
    side: level.config.side,
    minRR: level.config.minRR,
    maxBars: level.config.maxBars,
    primeBars: level.config.primeBars,
    atrPeriod: level.config.atrPeriod ?? 14,
    minAtr: level.tolerance.minAtr,
    maxAtr: level.tolerance.maxAtr,
  });
}

{
  const level = need("6-B", "composite");
  const step = level.config.steps[2];
  if (!step || step.kind !== "replay-trade") throw new Error("6-B step 3 is not a trade");
  checkTrade("6-B: the trade", {
    low: level.data[0]!,
    high: level.data[1]!,
    structure: step.target.structure.shape === "level" ? step.target.structure.price : NaN,
    triggerBar: step.target.triggerBar,
    side: step.config.side,
    minRR: step.config.minRR,
    maxBars: step.config.maxBars,
    primeBars: step.config.primeBars,
    atrPeriod: step.config.atrPeriod ?? 14,
    minAtr: step.tolerance.minAtr,
    maxAtr: step.tolerance.maxAtr,
  });
}

describe("6-B find it then trade it", () => {
  const level = need("6-B", "composite");
  const marks = level.config.steps[0];

  it("runs on a market no Chapter 6 level teaches on", () => {
    const taught = new Set(
      ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6"]
        .flatMap((id) => getAuthoredLevel(id)?.data ?? [])
        .map((slice) => slice.series),
    );
    for (const slice of level.data) expect(taught.has(slice.series)).toBe(false);
  });

  it("marks three hourly bars that really do test the level", () => {
    if (!marks || marks.kind !== "mark-bars") throw new Error("expected mark-bars first");
    const trade = level.config.steps[2];
    if (!trade || trade.kind !== "replay-trade") throw new Error("expected a trade");
    if (trade.target.structure.shape !== "level") throw new Error("expected a level");

    const data = series(level.data[0]!.series);
    const price = trade.target.structure.price;
    const volatility = atr(data, trade.target.triggerBar);
    const bars = marks.target.marks.map((mark) => barIndexOf(mark)!);
    expect(bars).toHaveLength(3);
    for (const bar of bars) {
      expect(Math.abs(data.h[bar]! - price), `bar ${bar}`).toBeLessThan(volatility * 0.2);
    }
  });

  it("keeps the marking stage blind to the outcome", () => {
    if (!marks || marks.kind !== "mark-bars") throw new Error("expected mark-bars first");
    const trade = level.config.steps[2];
    if (!trade || trade.kind !== "replay-trade") throw new Error("expected a trade");
    const stepWindow = marks.data?.[0];
    expect(stepWindow).toBeDefined();
    expect(stepWindow!.to).toBeLessThanOrEqual(trade.target.triggerBar + 1);
  });
});

describe("the chapter as a whole", () => {
  const ids = ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "6-B"];

  it("authors every level the chapter declares", () => {
    for (const id of ids) expect(getAuthoredLevel(id), id).toBeDefined();
  });

  it("teaches on two instruments and bosses on a third", () => {
    const instrument = (sid: string) => sid.replace(/-(1d|4h|1h|15m)$/, "");
    const taught = new Set(
      ids
        .slice(0, 6)
        .flatMap((id) => getAuthoredLevel(id)?.data ?? [])
        .map((slice) => instrument(slice.series)),
    );
    expect([...taught].sort()).toEqual(["BTCUSDT", "SPY"]);
    const boss = new Set(
      (getAuthoredLevel("6-B")?.data ?? []).map((slice) => instrument(slice.series)),
    );
    expect([...boss]).toEqual(["EURUSD"]);
  });

  it("never shows a higher-timeframe bar that has not closed", () => {
    // The seal across timeframes, asserted on the authored windows rather than only on
    // synthetic ones. A 4h bar whose open is behind the driver still closes ahead of it.
    for (const id of ["6-1", "6-2", "6-3", "6-B"]) {
      const { low, high, lowSeries, highSeries } = panes(getAuthoredLevel(id)!.data);
      const lastLow = low.to - 1;
      const reached = barEnd(lowSeries, lastLow);
      const shownHigh = barContaining(highSeries, reached);
      // Whatever the higher pane's window says, nothing past this point may be revealed.
      expect(high.from).toBeLessThanOrEqual(shownHigh + 1);
    }
  });
});
