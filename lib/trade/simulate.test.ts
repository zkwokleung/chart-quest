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
