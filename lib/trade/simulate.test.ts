import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { rewardRisk, simulate, type TradePlan } from "./simulate";

/**
 * Bars are written out longhand rather than generated, because every test here is
 * about one specific shape of bar and a generator would hide it.
 */
function build(
  bars: [o: number, h: number, l: number, c: number][],
): Series<string> {
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: bars.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: bars.map((b) => b[0]),
    h: bars.map((b) => b[1]),
    l: bars.map((b) => b[2]),
    c: bars.map((b) => b[3]),
    v: bars.map(() => 1000),
  };
}

const long = (stop: number, target: number | null): TradePlan => ({
  side: "long",
  stop,
  target,
});

describe("entry", () => {
  it("fills at the close of the bar the trade was committed on", () => {
    // Not at a price the player nominated. A fill better than what was on screen
    // is the other classic way a backtest flatters itself.
    const series = build([
      [100, 105, 99, 104],
      [104, 110, 103, 109],
    ]);
    const outcome = simulate(long(100, 120), series, 0, 10);
    expect(outcome?.entryPrice).toBe(104);
    expect(outcome?.risk).toBe(4);
  });

  it("refuses a plan whose stop is on the wrong side of entry", () => {
    const series = build([
      [100, 105, 99, 104],
      [104, 110, 103, 109],
    ]);
    // A "long" stopping above entry is not a badly-placed stop, it is not a trade.
    expect(simulate(long(110, 120), series, 0, 10)).toBeNull();
    expect(simulate(long(104, 120), series, 0, 10)).toBeNull();
  });

  it("refuses a bar that does not exist", () => {
    const series = build([[100, 105, 99, 104]]);
    expect(simulate(long(100, 120), series, 99, 10)).toBeNull();
  });
});

describe("intrabar ambiguity", () => {
  it("scores a bar containing both stop and target as a stop", () => {
    // Entry 100, stop 95, target 110, and one bar that reaches both. OHLC cannot
    // order the two events; assuming the good one is how a backtest lies.
    const series = build([
      [100, 101, 99, 100],
      [100, 111, 94, 105],
    ]);
    const outcome = simulate(long(95, 110), series, 0, 10);
    expect(outcome?.reason).toBe("stop");
    expect(outcome?.exitPrice).toBe(95);
    expect(outcome?.r).toBeCloseTo(-1);
  });

  it("flags that bar as ambiguous, so the score card can say why", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 111, 94, 105],
    ]);
    expect(simulate(long(95, 110), series, 0, 10)?.ambiguous).toBe(true);
  });

  it("does not flag an ordinary stop as ambiguous", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 102, 94, 96],
    ]);
    const outcome = simulate(long(95, 110), series, 0, 10);
    expect(outcome?.reason).toBe("stop");
    expect(outcome?.ambiguous).toBe(false);
  });
});

describe("gaps", () => {
  it("fills a stop gapped through at the open, worse than −1R", () => {
    const series = build([
      [100, 101, 99, 100],
      [90, 92, 88, 89],
    ]);
    const outcome = simulate(long(95, 110), series, 0, 10);
    expect(outcome?.gapped).toBe(true);
    expect(outcome?.exitPrice).toBe(90);
    // Risked 5, lost 10.
    expect(outcome?.r).toBeCloseTo(-2);
  });

  it("is honest in the player's favour too", () => {
    const series = build([
      [100, 101, 99, 100],
      [115, 118, 114, 117],
    ]);
    const outcome = simulate(long(95, 110), series, 0, 10);
    expect(outcome?.reason).toBe("target");
    expect(outcome?.gapped).toBe(true);
    expect(outcome?.exitPrice).toBe(115);
    // Better than the 3R the target asked for, because the gap overshot it.
    expect(outcome?.r).toBeCloseTo(3);
  });

  it("prices a real gap from the spine, not an invented one", () => {
    // SPY 2020-03-16: previous close 269.32, opened 241.18 — a 10.45% gap down on
    // the Monday after the rate cut. A stop anywhere in between never traded.
    const spy = JSON.parse(
      readFileSync("public/data/series/SPY-1d.json", "utf8"),
    ) as Series<string>;
    const entryBar = 3824;
    expect(spy.c[entryBar]).toBeCloseTo(269.32, 2);
    expect(spy.o[entryBar + 1]).toBeCloseTo(241.18, 2);

    // A textbook 2% stop. The market skipped it by twenty-eight dollars.
    const stop = 264;
    const outcome = simulate(long(stop, 290), spy, entryBar, 20);
    expect(outcome?.gapped).toBe(true);
    expect(outcome?.exitPrice).toBeCloseTo(241.18, 2);
    expect(outcome?.reason).toBe("stop");
    // Risked 5.32 and lost 28.14: more than five times the intended risk, from a
    // stop that was correctly placed and simply not honoured by the market.
    expect(outcome?.r ?? 0).toBeLessThan(-5);
  });
});

describe("running out of bars", () => {
  it("closes at the last close available", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 102, 99, 101],
      [101, 103, 100, 102],
    ]);
    const outcome = simulate(long(95, 200), series, 0, 2);
    expect(outcome?.reason).toBe("time");
    expect(outcome?.exitBar).toBe(2);
    expect(outcome?.exitPrice).toBe(102);
    expect(outcome?.r).toBeCloseTo(0.4);
  });

  it("stops at the end of the series rather than past it", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 102, 99, 101],
    ]);
    const outcome = simulate(long(95, 200), series, 0, 500);
    expect(outcome?.exitBar).toBe(1);
  });

  it("runs to the time limit when there is no target", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 105, 99, 104],
      [104, 108, 103, 107],
    ]);
    const outcome = simulate(long(95, null), series, 0, 10);
    expect(outcome?.reason).toBe("time");
    expect(outcome?.r).toBeCloseTo(1.4);
  });

  it("ignores a target on the wrong side instead of exiting instantly", () => {
    // Scoring the plan is the grader's job; the simulation still has to run so the
    // player sees what the trade did.
    const series = build([
      [100, 101, 99, 100],
      [100, 102, 99, 101],
    ]);
    const outcome = simulate(long(95, 90), series, 0, 10);
    expect(outcome?.reason).toBe("time");
  });
});

describe("shorts", () => {
  it("mirrors the stop and target sides", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 102, 89, 90],
    ]);
    const outcome = simulate(
      { side: "short", stop: 105, target: 90 },
      series,
      0,
      10,
    );
    expect(outcome?.reason).toBe("target");
    expect(outcome?.r).toBeCloseTo(2);
  });

  it("stops out when price rises through the stop", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 106, 99, 105],
    ]);
    const outcome = simulate(
      { side: "short", stop: 105, target: 90 },
      series,
      0,
      10,
    );
    expect(outcome?.reason).toBe("stop");
    expect(outcome?.r).toBeCloseTo(-1);
  });

  it("takes the stop on an ambiguous bar, same as a long", () => {
    const series = build([
      [100, 101, 99, 100],
      [100, 106, 89, 95],
    ]);
    const outcome = simulate(
      { side: "short", stop: 105, target: 90 },
      series,
      0,
      10,
    );
    expect(outcome?.reason).toBe("stop");
    expect(outcome?.ambiguous).toBe(true);
  });
});

describe("rewardRisk", () => {
  it("is the ratio of the two distances from entry", () => {
    expect(rewardRisk(long(95, 115), 100)).toBeCloseTo(3);
    expect(
      rewardRisk({ side: "short", stop: 105, target: 85 }, 100),
    ).toBeCloseTo(3);
  });

  it("is null when there is no target or the geometry is impossible", () => {
    expect(rewardRisk(long(95, null), 100)).toBeNull();
    expect(rewardRisk(long(95, 90), 100)).toBeNull();
    expect(rewardRisk(long(105, 115), 100)).toBeNull();
  });
});

/**
 * Trailing stops and partials, added in M7c for level 7.7.
 *
 * The interesting risk is not the arithmetic, it is the ordering. A trail that reads the
 * current bar's high, moves the stop, and then tests that stop against the current bar's low
 * has assumed price reached the high first — which OHLC cannot say. It would make almost every
 * trade look protected, and it is the same ambiguity Rule 2 exists for.
 */
describe("trailing stops", () => {
  /** Rises steadily, then collapses in one bar. */
  const rally = build([
    [100, 100, 100, 100],
    [100, 104, 100, 104],
    [104, 108, 104, 108],
    [108, 112, 108, 112],
    // The collapse: opens at 111 and trades down to 95.
    [111, 111, 95, 96],
  ]);

  it("leaves an untrailed trade exactly as it was", () => {
    // 1,518 tests depend on the default path being untouched.
    const plain = simulate({ side: "long", stop: 90, target: null }, rally, 0, 10);
    expect(plain?.finalStop).toBe(90);
    expect(plain?.partial).toBeUndefined();
  });

  it("moves the stop up behind price once the trade is far enough ahead", () => {
    // Entry 100, stop 90, so 1R is 10 points. Trail once 1R ahead, 0.5R behind the high.
    const out = simulate(
      { side: "long", stop: 90, target: null, trail: { afterR: 1, distanceR: 0.5 } },
      rally,
      0,
      10,
    );
    // The high before the collapse is 112, so the stop should sit at 112 - 5 = 107.
    expect(out?.finalStop).toBe(107);
    expect(out?.reason).toBe("stop");
    // And it exited at the trailed stop rather than the original one.
    expect(out?.exitPrice).toBe(107);
    expect(out?.r).toBeCloseTo(0.7, 6);
  });

  it("never uses a bar's own extreme to set the stop that bar is tested against", () => {
    // The look-ahead trap, and the most valuable test here. This bar runs 100 → 130 → 100: an
    // intra-bar trail 0.5R behind the high would claim a fill near 125 for **+2.5R**, having
    // assumed the high arrived before the low. Six OHLC numbers cannot say that.
    //
    // What this returns instead: the stop was still 90 while the bar traded, so the bar did not
    // stop the trade out. The trail then moves to 125 at the bar's end, and the next bar opens
    // at 101 — under the stop, so it fills there as a gap. **+0.1R.**
    //
    // A 2.4R difference on a single trade, and the smaller number is the defensible one.
    const spike = build([
      [100, 100, 100, 100],
      [100, 130, 100, 101],
      [101, 101, 101, 101],
    ]);
    const out = simulate(
      { side: "long", stop: 90, target: null, trail: { afterR: 1, distanceR: 0.5 } },
      spike,
      0,
      5,
    );
    expect(out?.finalStop).toBe(125);
    expect(out?.exitBar).toBe(2);
    expect(out?.exitPrice).toBe(101);
    expect(out?.gapped).toBe(true);
    expect(out?.r).toBeCloseTo(0.1, 6);
    // Emphatically not the 2.5R a peeking trail would have booked.
    expect(out!.r).toBeLessThan(0.5);
  });

  it("does not move the stop before the trade has earned it", () => {
    const out = simulate(
      { side: "long", stop: 90, target: null, trail: { afterR: 3, distanceR: 0.5 } },
      rally,
      0,
      10,
    );
    // The best this trade reached is +1.2R, short of the 3R the trail waits for.
    expect(out?.finalStop).toBe(90);
  });

  it("only ever tightens", () => {
    // A stop that can loosen is not a stop. Price rises, pulls back, and rises again: the stop
    // must never retreat with the pullback.
    const wobble = build([
      [100, 100, 100, 100],
      [100, 115, 100, 115],
      [115, 115, 105, 106],
      [106, 108, 105, 107],
    ]);
    const out = simulate(
      { side: "long", stop: 90, target: null, trail: { afterR: 1, distanceR: 0.5 } },
      wobble,
      0,
      10,
    );
    // 115 set the stop to 110, and nothing after it may take that back.
    expect(out?.finalStop).toBe(110);
  });

  it("trails a short in the other direction", () => {
    const fall = build([
      [100, 100, 100, 100],
      [100, 100, 92, 92],
      [92, 93, 88, 88],
      [88, 96, 88, 96],
    ]);
    const out = simulate(
      { side: "short", stop: 110, target: null, trail: { afterR: 1, distanceR: 0.5 } },
      fall,
      0,
      10,
    );
    // Entry 100, stop 110, 1R is 10. Low of 88 puts the stop at 88 + 5 = 93.
    expect(out?.finalStop).toBe(93);
    expect(out?.reason).toBe("stop");
  });
});

describe("partial exits", () => {
  const rally = build([
    [100, 100, 100, 100],
    [100, 110, 100, 110],
    [110, 112, 108, 109],
    [109, 109, 88, 89],
  ]);

  it("blends the two exits by the fraction each closed", () => {
    // Half off at +1R, the rest stopped out at -1R: (1 * 0.5) + (-1 * 0.5) = 0.
    const out = simulate(
      { side: "long", stop: 90, target: null, partial: { atR: 1, fraction: 0.5 } },
      rally,
      0,
      10,
    );
    expect(out?.partial?.r).toBeCloseTo(1, 6);
    expect(out?.partial?.fraction).toBe(0.5);
    expect(out?.r).toBeCloseTo(0, 6);
  });

  it("never credits a partial on a bar that also stopped the trade out", () => {
    // Rule 2's logic carried into partials: one bar containing both the partial level and the
    // stop is resolved as a stop, because OHLC cannot order them. Crediting the partial would
    // be the optimistic reading, which is how a backtest quietly inflates every result.
    const both = build([
      [100, 100, 100, 100],
      [100, 112, 88, 89],
    ]);
    const out = simulate(
      { side: "long", stop: 90, target: null, partial: { atR: 1, fraction: 0.5 } },
      both,
      0,
      10,
    );
    expect(out?.partial).toBeUndefined();
    expect(out?.r).toBeCloseTo(-1, 6);
  });

  it("ignores a fraction that is not a fraction", () => {
    for (const fraction of [0, 1, -0.5, 2]) {
      const out = simulate(
        { side: "long", stop: 90, target: null, partial: { atR: 1, fraction } },
        rally,
        0,
        10,
      );
      expect(out?.partial, `fraction ${fraction}`).toBeUndefined();
    }
  });

  it("takes the partial only once", () => {
    const out = simulate(
      { side: "long", stop: 90, target: null, partial: { atR: 1, fraction: 0.5 } },
      rally,
      0,
      10,
    );
    expect(out?.partial?.bar).toBe(1);
  });

  it("combines with a trail", () => {
    // Half off at +1R, the rest trailed out. Both mechanisms on one trade, which is what 7.7
    // asks the player to compare against holding for the full target.
    const out = simulate(
      {
        side: "long",
        stop: 90,
        target: null,
        partial: { atR: 1, fraction: 0.5 },
        trail: { afterR: 1, distanceR: 0.5 },
      },
      rally,
      0,
      10,
    );
    expect(out?.partial?.r).toBeCloseTo(1, 6);
    // 112 was the best, so the stop trailed to 107 and the remainder exited there. Entry was
    // 100 with 10 points of risk, so that leg is +0.7R, not +1.7R.
    expect(out?.finalStop).toBe(107);
    expect(out?.r).toBeCloseTo(1 * 0.5 + 0.7 * 0.5, 6);
  });
});
