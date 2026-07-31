import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { bollingerSeries } from "@/lib/ta/bollinger";
import { macdCrosses } from "@/lib/ta/macd";
import { rsiSeries } from "@/lib/ta/rsi";
import { atr } from "@/lib/ta/atr";
import { simulate } from "@/lib/trade/simulate";
import { barIndexOf } from "../../mark";
import type { AnyLevel, Level } from "../../schema";
import { getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 5's levels *claim* against what the data *shows*.
 *
 * Across M3 to M5 this pattern caught eleven real problems that the generic guards
 * structurally cannot — those prove a level is winnable, not that its answer is
 * right. Chapter 5 leans on it harder than any chapter so far, because almost every
 * level here quotes a number.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
}

const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = load(id);
  cache.set(id, loaded);
  return loaded;
}

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getAuthoredLevel(id);
  if (!level || level.kind !== kind)
    throw new Error(`${id} is not a ${kind} level`);
  return level as unknown as Level<K>;
}

/** Share of closes inside the bands, the figure 5.2 turns on. */
function containment(
  s: Series<string>,
  from: number,
  to: number,
  period: number,
  deviations: number,
): number {
  const bands = bollingerSeries(s, period, deviations);
  let inside = 0;
  let counted = 0;
  for (let i = from; i < to; i += 1) {
    const band = bands[i];
    const close = s.c[i];
    if (!band || close === undefined) continue;
    counted += 1;
    if (close <= band.upper && close >= band.lower) inside += 1;
  }
  return counted === 0 ? 0 : inside / counted;
}

describe("5-1 the moving average has no right answer", () => {
  const level = need("5-1", "tune-param");

  it("is scored on exploration, not on a target", () => {
    // The whole reason this level exists in this form. If someone later "fixes" it
    // by adding a correct period, this fails — and it should, because the measured
    // surface (see 5-2's file) has no defensible winner.
    expect(level.config.scoring).toBe("exploration");
  });

  it("offers a range wide enough for the lag to be visible", () => {
    // At the short end the average sits on top of price; the lesson only appears
    // once the period is long enough to arrive visibly late.
    expect(level.config.max / level.config.min).toBeGreaterThanOrEqual(20);
  });
});

describe("5-2 two sigma is not ninety-five percent", () => {
  const level = need("5-2", "tune-param");
  const eur = series("EURUSD-1d");
  const slice = level.data[0]!;

  it("shows that the textbook figure is wrong on this window", () => {
    // The claim the brief makes. Two sigma is sold as ~95%; here it is not.
    const atTwo = containment(eur, slice.from, slice.to, 20, 2);
    expect(atTwo).toBeLessThan(0.92);
    expect(atTwo).toBeGreaterThan(0.85);
  });

  it("really does reach 95% at the authored answer", () => {
    const target = level.target.value;
    expect(
      containment(eur, slice.from, slice.to, 20, target),
    ).toBeGreaterThanOrEqual(0.95);
  });

  it("does not reach it meaningfully before then", () => {
    // Otherwise "the smallest multiple that works" would have a different answer and
    // the tolerance would be hiding it.
    const justBelow = level.target.value - level.tolerance.slop - 0.1;
    expect(containment(eur, slice.from, slice.to, 20, justBelow)).toBeLessThan(
      0.95,
    );
  });

  it("is not a quirk of one market", () => {
    // The lesson is about fat tails, not about the euro. If two sigma held on the
    // others, the level would be teaching a coincidence.
    for (const id of ["BTCUSDT-1d", "SPY-1d"] as const) {
      const s = series(id);
      const from = 1000;
      const to = 1800;
      expect(containment(s, from, to, 20, 2), id).toBeLessThan(0.95);
    }
  });
});

describe("5-3 overbought is not a sell signal", () => {
  const level = need("5-3", "classify");
  const btc = series("BTCUSDT-1d");
  const slice = level.data[0]!;

  it("holds RSI above 70 for a long stretch inside the window shown", () => {
    // The claim has to be visible on the chart the level displays, not merely true
    // of the series somewhere — the failure that moved 3.3 and 3.6 to new windows.
    const rsi = rsiSeries(btc, 14);
    let best = 0;
    let run = 0;
    for (let i = slice.from; i < slice.to; i += 1) {
      const value = rsi[i];
      if (value !== null && value !== undefined && value > 70) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    expect(best).toBeGreaterThanOrEqual(15);
  });

  it("rises materially across that stretch", () => {
    // "Overbought for weeks" is only a lesson if price went up while it happened.
    const rsi = rsiSeries(btc, 14);
    let best = { length: 0, start: 0, end: 0 };
    let run = 0;
    let start = 0;
    for (let i = slice.from; i < slice.to; i += 1) {
      const value = rsi[i];
      if (value !== null && value !== undefined && value > 70) {
        if (run === 0) start = i;
        run += 1;
        if (run > best.length) best = { length: run, start, end: i };
      } else {
        run = 0;
      }
    }
    const gain = (btc.c[best.end]! / btc.c[best.start]! - 1) * 100;
    expect(gain).toBeGreaterThan(15);
  });

  it("marks the answer that describes strength, not the one predicting reversal", () => {
    expect(level.target.correct).toEqual(["strength"]);
  });
});

describe("5-4 MACD is two averages", () => {
  const level = need("5-4", "mark-bars");
  const eur = series("EURUSD-1d");
  const slice = level.data[0]!;

  it("targets bars that really are MACD crossings", () => {
    // Re-derived through the shipped implementation rather than the scan that chose
    // them, so a change to macdCrosses fails here instead of silently moving the
    // answer under a player.
    const crosses = new Set(
      macdCrosses(eur)
        .filter((c) => c.bar >= slice.from && c.bar < slice.to)
        .map((c) => c.bar),
    );
    for (const mark of level.target.marks) {
      const bar = barIndexOf(mark);
      expect(bar).not.toBeNull();
      expect(crosses.has(bar ?? -1), `bar ${bar} is not a MACD cross`).toBe(
        true,
      );
    }
  });

  it("targets exactly the crossings that went nowhere", () => {
    const crosses = macdCrosses(eur).filter(
      (c) => c.bar >= slice.from && c.bar < slice.to,
    );
    const wentNowhere = crosses.filter((c) => {
      const now = eur.c[c.bar]!;
      const after = eur.c[Math.min(c.bar + 10, eur.c.length - 1)]!;
      const move = ((after - now) / now) * 100;
      return c.direction === "up" ? move < 0.3 : move > -0.3;
    });
    expect(new Set(level.target.marks.map((m) => barIndexOf(m)))).toEqual(
      new Set(wentNowhere.map((c) => c.bar)),
    );
  });

  it("leaves genuine distractors — some crossings did lead somewhere", () => {
    // Without a cross that worked, "click the ones that went nowhere" is the same
    // question as "click every cross", and the level teaches nothing.
    const crosses = macdCrosses(eur).filter(
      (c) => c.bar >= slice.from && c.bar < slice.to,
    );
    expect(crosses.length).toBeGreaterThan(level.target.marks.length);
  });

  it("keeps most of them noise, which is the claim the brief makes", () => {
    const crosses = macdCrosses(eur).filter(
      (c) => c.bar >= slice.from && c.bar < slice.to,
    );
    expect(level.target.marks.length / crosses.length).toBeGreaterThan(0.5);
  });
});

describe("5-5 big for which market", () => {
  const level = need("5-5", "classify");

  it("starts in ATR units, or the comparison is invisible", () => {
    expect(level.yAxis).toBe("atr");
  });

  it("marks exactly the markets where a 3% day is rare", () => {
    // Re-derived per asset rather than trusted: the answer set has to follow from
    // the data, and if a refetch ever moved these the level would quietly be wrong.
    const rare = (id: string) => {
      const s = series(id);
      let over = 0;
      let counted = 0;
      for (let i = 20; i < s.t.length; i += 1) {
        const value = atr(s, i, 14);
        const close = s.c[i];
        if (value <= 0 || close === undefined) continue;
        counted += 1;
        if ((value / close) * 100 > 3) over += 1;
      }
      return over / counted < 0.1;
    };
    expect(rare("BTCUSDT-1d")).toBe(false);
    expect(rare("SPY-1d")).toBe(true);
    expect(rare("EURUSD-1d")).toBe(true);
    expect(level.target.correct.sort()).toEqual(["b", "c"]);
  });

  it("shows the three markets the options name", () => {
    expect(level.data.map((d) => d.series)).toEqual([
      "BTCUSDT-1d",
      "SPY-1d",
      "EURUSD-1d",
    ]);
  });
});

describe("5-6 indicator soup", () => {
  const level = need("5-6", "classify");

  it("marks the answer about shared input", () => {
    // The level's claim is true by construction — every indicator on the chart is a
    // function of the same closes — so what is worth pinning is that the level says
    // so rather than rewarding a majority vote.
    expect(level.target.correct).toEqual(["same-input"]);
  });

  it("offers the two tempting wrong answers", () => {
    const ids = level.config.options.map((o) => o.id);
    expect(ids).toContain("majority");
    expect(ids).toContain("add-more");
  });
});

describe("5-B the boss", () => {
  const level = need("5-B", "composite");
  const spy15 = series("SPY-15m");

  it("runs on a market and a timeframe no Chapter 5 level taught on", () => {
    const taught = new Set(
      ["5-1", "5-2", "5-3", "5-4", "5-5", "5-6"]
        .map((id) => getAuthoredLevel(id))
        .filter((l): l is AnyLevel => l !== undefined)
        .flatMap((l) => l.data.map((d) => d.series)),
    );
    expect(taught.has("SPY-1d")).toBe(true);
    for (const slice of level.data)
      expect(taught.has(slice.series)).toBe(false);
  });

  it("marks a bar that really is the pullback low", () => {
    const step = level.config.steps.find((s) => s.kind === "mark-bars");
    if (!step || step.kind !== "mark-bars") throw new Error("missing stage");
    const bar = barIndexOf(step.target.marks[0]!) ?? 0;
    const window = [bar - 3, bar - 2, bar - 1, bar, bar + 1, bar + 2, bar + 3];
    const lows = window.map((i) => spy15.l[i] ?? Infinity);
    expect(spy15.l[bar]).toBe(Math.min(...lows));
  });

  it("holds back the outcome until the replay reaches it", () => {
    const step = level.config.steps.find((s) => s.kind === "replay-trade");
    if (!step || step.kind !== "replay-trade") throw new Error("missing stage");
    const slice = level.data[0]!;
    expect(step.config.primeBars).toBeLessThan(slice.to - slice.from);
    expect(slice.from + step.config.primeBars - 1).toBe(step.target.triggerBar);
  });

  it("offers a trade that works with a defensible stop", () => {
    const step = level.config.steps.find((s) => s.kind === "replay-trade");
    if (!step || step.kind !== "replay-trade") throw new Error("missing stage");
    const structure = step.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");

    const entry = spy15.c[step.target.triggerBar]!;
    const volatility = atr(spy15, step.target.triggerBar, 14);
    const stop = structure.price - volatility * 0.4;
    const outcome = simulate(
      {
        side: "long",
        stop,
        target: entry + (entry - stop) * step.config.minRR,
      },
      spy15,
      step.target.triggerBar,
      step.config.maxBars,
    );
    expect(outcome?.reason).toBe("target");
    // At least 2R rather than exactly: a gap through the target fills at the open,
    // which is better than asked for and must not read as a failure.
    expect(outcome?.r ?? 0).toBeGreaterThanOrEqual(1.9);
  });

  it("makes the ATR band's upper bound mean something", () => {
    // Unlike 3.B, a stop on the low survives here — so the lower bound does not
    // discriminate and the level does not pretend it does. What the window punishes
    // is a stop so wide the 2R target moves out of reach, and that is measured.
    const step = level.config.steps.find((s) => s.kind === "replay-trade");
    if (!step || step.kind !== "replay-trade") throw new Error("missing stage");
    const entry = spy15.c[step.target.triggerBar]!;
    const volatility = atr(spy15, step.target.triggerBar, 14);
    const stop = entry - volatility * (step.tolerance.maxAtr + 0.4);
    const outcome = simulate(
      {
        side: "long",
        stop,
        target: entry + (entry - stop) * step.config.minRR,
      },
      spy15,
      step.target.triggerBar,
      step.config.maxBars,
    );
    expect(outcome?.reason).not.toBe("target");
  });

  it("weights the trade heaviest, because it is the one that costs money", () => {
    const trade = level.config.steps.find((s) => s.kind === "replay-trade");
    for (const step of level.config.steps) {
      if (step.kind === "replay-trade") continue;
      expect(step.weight).toBeLessThan(trade?.weight ?? 0);
    }
  });
});
