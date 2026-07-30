import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { atr } from "@/lib/ta/atr";
import { findSwings } from "@/lib/ta/swings";
import { simulate } from "@/lib/trade/simulate";
import { gradeAnnotate } from "../../kinds/annotate/grade";
import { measurePlan } from "../../kinds/replay-trade/grade";
import { barIndexOf } from "../../mark";
import { getLevel } from "../../registry";
import type { AnyLevel, Level } from "../../schema";

/**
 * Checks what Chapter 3's levels *claim* against what the data *shows*.
 *
 * The generic guards prove a level is winnable but derive the perfect attempt from
 * the target, so they cannot tell a right answer from a confidently wrong one. These
 * can. In Chapter 1 the same discipline caught two real bugs, in Chapter 2 three, and
 * here it is carrying the load for 3.4 — a level that would otherwise teach the
 * inverse of its own lesson.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
}

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getLevel(id);
  if (!level || level.kind !== kind)
    throw new Error(`${id} is not a ${kind} level`);
  return level as unknown as Level<K>;
}

const spy = load("SPY-1d");
const btc4 = load("BTCUSDT-4h");

/** Swing reversals whose price falls inside a band. */
function reversalsIn(
  series: Series<string>,
  from: number,
  to: number,
  low: number,
  high: number,
): number[] {
  return findSwings(series, { from, to }, 4)
    .filter((swing) => swing.price >= low && swing.price <= high)
    .map((swing) => swing.price);
}

describe("3-1 a level worth the name", () => {
  const level = need("3-1", "annotate");

  it("gives its reference full marks by the grader's own measure", () => {
    const grade = gradeAnnotate(
      { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 },
      level,
      [spy],
    );
    expect(grade.stars).toBe(3);
  });

  it("sits away from both extremes, where a level has to be", () => {
    const ref = level.target.reference;
    if (ref.shape !== "level") throw new Error("expected a level");
    const slice = level.data[0]!;
    const high = Math.max(...spy.h.slice(slice.from, slice.to));
    const low = Math.min(...spy.l.slice(slice.from, slice.to));
    const span = high - low;
    expect(ref.price).toBeLessThan(high - span * 0.15);
    expect(ref.price).toBeGreaterThan(low + span * 0.15);
  });

  it("does not claim a single price is the answer, because 3.2 refutes that", () => {
    // The two levels have to agree about the world. 3.1 teaches the tool; 3.2 shows
    // its limit. If 3.1's brief promised an exact price they would contradict.
    const text = `${level.brief} ${level.config.prompt}`.toLowerCase();
    expect(text).not.toContain("exact");
    expect(text).not.toContain("precise");
  });
});

describe("3-2 a line is too thin", () => {
  const level = need("3-2", "annotate");

  it("gives its reference full marks by the grader's own measure", () => {
    const grade = gradeAnnotate(
      { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 },
      level,
      [spy],
    );
    expect(grade.stars).toBe(3);
  });

  it("catches reversals no thin line could, which is the entire lesson", () => {
    // Measured as dispersion, not visit count. Counting visits appeared to refute
    // this level's premise, because widening a band merges adjacent touches into
    // single visits and the count mechanically falls.
    const ref = level.target.reference;
    if (ref.shape !== "zone") throw new Error("expected a zone");
    const slice = level.data[0]!;

    const caught = reversalsIn(spy, slice.from, slice.to, ref.bottom, ref.top);
    expect(caught.length).toBeGreaterThanOrEqual(10);

    // A 0.2%-wide line at the best price it can find catches far fewer.
    const high = Math.max(...spy.h.slice(slice.from, slice.to));
    const low = Math.min(...spy.l.slice(slice.from, slice.to));
    let bestThin = 0;
    for (let step = 0; step <= 400; step += 1) {
      const centre = low + ((high - low) * step) / 400;
      const band = centre * 0.002;
      const n = reversalsIn(
        spy,
        slice.from,
        slice.to,
        centre - band,
        centre + band,
      ).length;
      if (n > bestThin) bestThin = n;
    }
    expect(bestThin).toBeLessThan(caught.length / 2);

    // And they spread wider than any thin line could ever span, which is the claim
    // the level actually rests on.
    const spread = Math.max(...caught) - Math.min(...caught);
    const mid = (ref.top + ref.bottom) / 2;
    expect(spread / mid).toBeGreaterThan(0.02);
  });

  it("is wider than 1% of price and narrower than half the window", () => {
    const ref = level.target.reference;
    if (ref.shape !== "zone") throw new Error("expected a zone");
    const slice = level.data[0]!;
    const mid = (ref.top + ref.bottom) / 2;
    const height = ref.top - ref.bottom;
    const windowSpan =
      Math.max(...spy.h.slice(slice.from, slice.to)) -
      Math.min(...spy.l.slice(slice.from, slice.to));
    expect(height / mid).toBeGreaterThan(0.01);
    expect(height / windowSpan).toBeLessThan(0.5);
  });
});

describe("3-3 the retest", () => {
  const level = need("3-3", "mark-bars");
  const LEVEL_PRICE = 129.43;
  const BREAK_BAR = 410;

  it("shows the level being tested three times, inside the window", () => {
    // The failure this exists for: the first version of this level pointed at a
    // window where price was already above its level throughout, so the "break" the
    // brief describes had no counterpart on the chart at all.
    const slice = level.data[0]!;
    const tol = LEVEL_PRICE * 0.004;
    const hits: number[] = [];
    for (let bar = slice.from; bar < BREAK_BAR; bar += 1) {
      if (
        spy.l[bar]! - tol <= LEVEL_PRICE &&
        spy.h[bar]! + tol >= LEVEL_PRICE
      ) {
        hits.push(bar);
      }
    }
    const visits: number[][] = [];
    for (const hit of hits) {
      const last = visits.at(-1);
      if (last && hit - last.at(-1)! <= 8) last.push(hit);
      else visits.push([hit]);
    }
    expect(visits.length).toBeGreaterThanOrEqual(3);
  });

  it("spends most of the window below the level before breaking it", () => {
    // Otherwise it is not resistance, just a price the chart wandered through.
    const slice = level.data[0]!;
    let below = 0;
    for (let bar = slice.from; bar < BREAK_BAR; bar += 1) {
      if (spy.c[bar]! < LEVEL_PRICE * 0.99) below += 1;
    }
    expect(below / (BREAK_BAR - slice.from)).toBeGreaterThan(0.5);
  });

  it("breaks decisively at the bar the misconceptions key off", () => {
    expect(spy.c[BREAK_BAR]!).toBeGreaterThan(LEVEL_PRICE * 1.008);
    expect(spy.c[BREAK_BAR - 1]!).toBeLessThan(LEVEL_PRICE * 1.008);
  });

  it("targets a bar that traded through the level and closed above it", () => {
    const bar = barIndexOf(level.target.marks[0]!);
    expect(bar).not.toBeNull();
    if (bar === null) return;
    expect(bar).toBeGreaterThan(BREAK_BAR);
    expect(spy.l[bar]!).toBeLessThan(LEVEL_PRICE);
    expect(spy.c[bar]!).toBeGreaterThan(LEVEL_PRICE);
  });

  it("targets the deepest bar of the retest cluster", () => {
    const bar = barIndexOf(level.target.marks[0]!) ?? 0;
    const slop = level.tolerance.barSlop;
    const cluster: number[] = [];
    for (let i = bar - slop; i <= bar + slop; i += 1) cluster.push(i);
    expect(spy.l[bar]!).toBe(Math.min(...cluster.map((i) => spy.l[i]!)));
  });

  it("really held, and kept holding", () => {
    // Measured from the target bar, not from the break: +1.9% at twenty bars and
    // +5.7% at forty. The retest was slow rather than explosive, which is worth the
    // level being honest about — the drift for the first ten bars is only 0.4%.
    const bar = barIndexOf(level.target.marks[0]!) ?? 0;
    expect(spy.c[bar + 20]! / LEVEL_PRICE - 1).toBeGreaterThan(0.015);
    expect(spy.c[bar + 40]! / LEVEL_PRICE - 1).toBeGreaterThan(0.05);
    // And it never closed back below the level in between, which is what "held" means.
    for (let i = bar + 1; i <= bar + 40; i += 1) {
      expect(spy.c[i]!, `bar ${i} closed back below the level`).toBeGreaterThan(
        LEVEL_PRICE * 0.99,
      );
    }
  });
});

describe("3-4 breakout or fakeout", () => {
  const level = need("3-4", "classify");

  /**
   * The level each chart broke, measured when the content was chosen.
   *
   * Recorded here rather than re-derived from the slice, because "the level" is a
   * judgement — which swing high, over what lookback, with how many visits — and a
   * test that guesses differently from the author is testing its own guess. These are
   * the prices the six charts were selected on, and if a slice moves the assertions
   * below stop holding.
   */
  const LEVELS: Record<string, number> = {
    a: 134.0,
    b: 167.3,
    c: 139.14,
    d: 302.23,
    e: 143.09,
    f: 354.02,
  };

  function magnitudes(): { id: string; mag: number; real: boolean }[] {
    return level.data.map((slice, i) => {
      const option = level.config.options[i]!;
      const price = LEVELS[option.id]!;
      return {
        id: option.id,
        mag: (spy.c[slice.to - 1]! / price - 1) * 100,
        real: level.target.correct.includes(option.id),
      };
    });
  }

  it("names a level each chart really did break on its final bar", () => {
    for (const [i, slice] of level.data.entries()) {
      const option = level.config.options[i]!;
      const price = LEVELS[option.id]!;
      const breakBar = slice.to - 1;
      expect(spy.c[breakBar]!, `${slice.label}`).toBeGreaterThan(price * 1.004);
      expect(spy.c[breakBar - 1]!, `${slice.label}`).toBeLessThanOrEqual(
        price * 1.004,
      );
    }
  });

  it("shows each level being tested at least three times before it breaks", () => {
    // The failure this prevents: a 60-bar window displayed only two tests, so the
    // chart could not show the structure the question is about.
    for (const [i, slice] of level.data.entries()) {
      const price = LEVELS[level.config.options[i]!.id]!;
      const tol = price * 0.004;
      const hits: number[] = [];
      for (let bar = slice.from; bar < slice.to - 1; bar += 1) {
        if (spy.l[bar]! - tol <= price && spy.h[bar]! + tol >= price)
          hits.push(bar);
      }
      const visits: number[][] = [];
      for (const hit of hits) {
        const last = visits.at(-1);
        if (last && hit - last.at(-1)! <= 10) last.push(hit);
        else visits.push([hit]);
      }
      expect(visits.length, `${slice.label}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("shows exactly three that held and three that failed", () => {
    expect(level.target.correct).toHaveLength(3);
    expect(level.data).toHaveLength(6);
  });

  it("cannot be solved by how decisive the breakout candle was", () => {
    // The level's whole payload. Across SPY the *failed* breaks closed further above
    // their level than the real ones, so a player winning by candle size would be
    // learning something false. The six are chosen as magnitude-matched pairs, and
    // this asserts the pairing rather than trusting it.
    const sorted = magnitudes().sort((a, b) => b.mag - a.mag);
    const pairs: [(typeof sorted)[number], (typeof sorted)[number]][] = [
      [sorted[0]!, sorted[1]!],
      [sorted[2]!, sorted[3]!],
      [sorted[4]!, sorted[5]!],
    ];
    for (const [a, b] of pairs) {
      expect(
        Math.abs(a.mag - b.mag),
        `${a.id} at ${a.mag.toFixed(2)}% and ${b.id} at ${b.mag.toFixed(2)}% are not matched`,
      ).toBeLessThan(0.12);
      expect(
        a.real === b.real,
        `${a.id} and ${b.id} are matched on magnitude but both ${a.real ? "real" : "fake"}`,
      ).toBe(false);
    }
  });

  it("really held or really failed, twenty bars past each break", () => {
    for (const [i, slice] of level.data.entries()) {
      const option = level.config.options[i]!;
      const price = LEVELS[option.id]!;
      const after = spy.c[slice.to - 1 + 20]!;
      if (level.target.correct.includes(option.id)) {
        expect(
          after / price - 1,
          `${slice.label} should have held`,
        ).toBeGreaterThan(0.02);
      } else {
        expect(after, `${slice.label} should have failed`).toBeLessThan(price);
      }
    }
  });

  it("reveals the outcome only after committing, and only as far as it claims", () => {
    expect(level.config.revealBars).toBe(20);
  });
});

describe("3-5 where the stops are", () => {
  const level = need("3-5", "mark-bars");
  const ROUND = 200;

  it("targets bars that dipped below the round number and closed above it", () => {
    for (const mark of level.target.marks) {
      const bar = barIndexOf(mark)!;
      expect(spy.l[bar]!).toBeLessThan(ROUND);
      expect(spy.c[bar]!).toBeGreaterThan(ROUND);
    }
  });

  it("targets the four deepest such probes in the window", () => {
    const slice = level.data[0]!;
    const probes: { bar: number; depth: number }[] = [];
    for (let i = slice.from; i < slice.to; i += 1) {
      if (spy.l[i]! < ROUND && spy.c[i]! > ROUND) {
        probes.push({ bar: i, depth: ROUND - spy.l[i]! });
      }
    }
    const deepest = probes
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 4)
      .map((p) => p.bar)
      .sort((a, b) => a - b);
    expect(
      level.target.marks.map((m) => barIndexOf(m)).sort((a, b) => a! - b!),
    ).toEqual(deepest);
  });

  it("backs the brief's claim that this happened many times over", () => {
    // The brief says nineteen months of argument; the level's teaching rests on the
    // count being large, so it is measured rather than asserted.
    const slice = level.data[0]!;
    let count = 0;
    for (let i = slice.from; i < slice.to; i += 1) {
      if (spy.l[i]! < ROUND && spy.c[i]! > ROUND) count += 1;
    }
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("keeps the four targets far enough apart to be told apart", () => {
    const bars = level.target.marks
      .map((m) => barIndexOf(m)!)
      .sort((a, b) => a - b);
    for (let i = 1; i < bars.length; i += 1) {
      expect(bars[i]! - bars[i - 1]!).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("3-6 the clean break that wasn't", () => {
  const level = need("3-6", "predict-next");
  const LEVEL_PRICE = 402.31;

  it("breaks a level that had been tested several times", () => {
    const slice = level.data[0]!;
    const breakBar = slice.to - 1;
    const tol = LEVEL_PRICE * 0.004;
    const hits: number[] = [];
    for (let i = slice.from; i < breakBar; i += 1) {
      if (spy.l[i]! - tol <= LEVEL_PRICE && spy.h[i]! + tol >= LEVEL_PRICE)
        hits.push(i);
    }
    const visits: number[][] = [];
    for (const hit of hits) {
      const last = visits.at(-1);
      if (last && hit - last.at(-1)! <= 10) last.push(hit);
      else visits.push([hit]);
    }
    expect(visits.length).toBeGreaterThanOrEqual(3);
  });

  it("breaks decisively, so the trap is a fair one", () => {
    const breakBar = level.data[0]!.to - 1;
    expect(spy.c[breakBar]! / LEVEL_PRICE - 1).toBeGreaterThan(0.01);
  });

  it("fails, and stays failed over the horizon it asks about", () => {
    const breakBar = level.data[0]!.to - 1;
    const horizon = level.config.horizon;
    let backBelow = false;
    for (let i = breakBar + 1; i <= breakBar + 5; i += 1) {
      if (spy.c[i]! < LEVEL_PRICE * 0.996) backBelow = true;
    }
    expect(backBelow).toBe(true);
    expect(spy.c[breakBar + horizon]!).toBeLessThan(LEVEL_PRICE);
  });

  it("has the bars its horizon needs", () => {
    const slice = level.data[0]!;
    expect(slice.to - 1 + level.config.horizon).toBeLessThan(spy.t.length);
  });
});

describe("3-B your first trade", () => {
  const level = need("3-B", "replay-trade");

  it("runs on a market no Chapter 3 level taught on", () => {
    const taught = new Set(
      ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"]
        .map((id) => getLevel(id))
        .filter((l): l is AnyLevel => l !== undefined)
        .flatMap((l) => l.data.map((d) => d.series)),
    );
    expect(taught.has("SPY-1d")).toBe(true);
    for (const slice of level.data)
      expect(taught.has(slice.series)).toBe(false);
  });

  it("holds back the outcome until the replay reaches it", () => {
    // The slice must contain the outcome for the grader, so primeBars is the only
    // thing standing between the player and the answer at load.
    const slice = level.data[0]!;
    expect(level.config.primeBars).toBeLessThan(slice.to - slice.from);
    expect(slice.from + level.config.primeBars - 1).toBe(
      level.target.triggerBar,
    );
  });

  it("punishes a stop placed on the obvious low, through the simulator", () => {
    // The measured claim the whole boss rests on. Bar 4822 trades to 23,896.95 —
    // 79 points under the pullback low — so a stop on the low is taken out three
    // bars later while a stop with room survives to 2R.
    const structure = level.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");
    const entry = btc4.c[level.target.triggerBar]!;
    const onTheLow = simulate(
      {
        side: "long",
        stop: structure.price,
        target: entry + (entry - structure.price) * 2,
      },
      btc4,
      level.target.triggerBar,
      level.config.maxBars,
    );
    expect(onTheLow?.reason).toBe("stop");
    expect(onTheLow?.r).toBeCloseTo(-1, 1);
    expect(
      (onTheLow?.exitBar ?? 0) - level.target.triggerBar,
    ).toBeLessThanOrEqual(5);
  });

  it("rewards a stop given room beyond the low", () => {
    const structure = level.target.structure;
    if (structure.shape !== "level") throw new Error("expected a level");
    const volatility = atr(
      btc4,
      level.target.triggerBar,
      level.config.atrPeriod ?? 14,
    );
    const entry = btc4.c[level.target.triggerBar]!;
    const stop = structure.price - volatility * 0.15;
    const outcome = simulate(
      { side: "long", stop, target: entry + (entry - stop) * 2 },
      btc4,
      level.target.triggerBar,
      level.config.maxBars,
    );
    expect(outcome?.reason).toBe("target");
    expect(outcome?.r).toBeCloseTo(2, 1);
  });

  it("makes the ATR band's upper bound mean something", () => {
    // A stop wider than the band cannot reach its own 2R target inside the window,
    // because the target moves out with the risk. Without this the upper bound would
    // be decoration.
    const volatility = atr(
      btc4,
      level.target.triggerBar,
      level.config.atrPeriod ?? 14,
    );
    const entry = btc4.c[level.target.triggerBar]!;
    const stop = entry - volatility * (level.tolerance.maxAtr + 0.5);
    const outcome = simulate(
      { side: "long", stop, target: entry + (entry - stop) * 2 },
      btc4,
      level.target.triggerBar,
      level.config.maxBars,
    );
    expect(outcome?.reason).not.toBe("target");
  });

  it("has a reference trade that satisfies every plan component", () => {
    const reference = {
      kind: "replay-trade" as const,
      entryBar: level.target.triggerBar,
      stop: 0,
      target: null as number | null,
      reason: "check",
      hintsUsed: 0,
    };
    const volatility = atr(
      btc4,
      level.target.triggerBar,
      level.config.atrPeriod ?? 14,
    );
    const entry = btc4.c[level.target.triggerBar]!;
    reference.stop = entry - volatility * 1.5;
    reference.target = entry + (entry - reference.stop) * level.config.minRR;

    const plan = measurePlan(reference, level, btc4);
    expect(plan?.beyondStructure).toBe(true);
    expect(plan?.roomOk).toBe(true);
    expect(plan?.rrOk).toBe(true);
    expect(plan?.onTime).toBe(true);
  });
});
