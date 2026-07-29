import { describe, expect, it } from "vitest";
import {
  anchorQuality,
  countBodyCuts,
  countClosesBeyond,
  countTouches,
  priceAtBar,
  priceTolerance,
  rangeSpan,
  slopeOf,
  type Drawing,
  type Tolerance,
} from "./geometry";
import type { BarRange, Series } from "./types";

const TOL: Tolerance = { priceFracOfRange: 0.02, barSlop: 1 };

/**
 * Ten bars whose lows sit exactly on the line price = 100 + i, so a trendline
 * through them has a known, exact answer.
 */
function risingLows(): Series<string> {
  const n = 10;
  const l = Array.from({ length: n }, (_, i) => 100 + i);
  return {
    id: "TEST-1d",
    tf: "1d",
    t: l.map((_, i) => Date.UTC(2024, 0, 1) + i * 86_400_000),
    o: l.map((low) => low + 2),
    h: l.map((low) => low + 6),
    l,
    c: l.map((low) => low + 4),
    v: l.map(() => 100),
  };
}

const RANGE: BarRange = { from: 0, to: 10 };

describe("rangeSpan and priceTolerance", () => {
  it("spans the window's high to its low", () => {
    // lows 100..109, highs 106..115
    expect(rangeSpan(risingLows(), RANGE)).toBe(15);
  });

  it("scales tolerance by the visible range, not by absolute price", () => {
    // Scale-free is the point: the same config has to work on BTC at 60,000 and
    // EURUSD at 1.09.
    expect(priceTolerance(risingLows(), RANGE, TOL)).toBeCloseTo(0.3, 5);
  });

  it("is zero for an empty range rather than NaN", () => {
    expect(rangeSpan(risingLows(), { from: 5, to: 5 })).toBe(0);
  });
});

describe("priceAtBar", () => {
  const line: Drawing = {
    shape: "trendline",
    a: { bar: 0, price: 100 },
    b: { bar: 9, price: 109 },
  };

  it("interpolates along a trendline", () => {
    expect(priceAtBar(line, 0)).toBe(100);
    expect(priceAtBar(line, 5)).toBe(105);
    expect(priceAtBar(line, 9)).toBe(109);
  });

  it("extrapolates past its anchors", () => {
    // Levels are authored on a window but the line keeps meaning beyond it.
    expect(priceAtBar(line, 12)).toBe(112);
  });

  it("returns the price for a level regardless of bar", () => {
    expect(priceAtBar({ shape: "level", price: 42 }, 7)).toBe(42);
  });

  it("returns null for a zone, which has no single price", () => {
    expect(priceAtBar({ shape: "zone", top: 10, bottom: 5 }, 3)).toBeNull();
  });

  it("returns null for a vertical line rather than dividing by zero", () => {
    expect(
      priceAtBar(
        { shape: "trendline", a: { bar: 3, price: 1 }, b: { bar: 3, price: 9 } },
        3,
      ),
    ).toBeNull();
  });
});

describe("slopeOf", () => {
  it("is positive for a rising line and zero for a level", () => {
    expect(
      slopeOf({ shape: "trendline", a: { bar: 0, price: 100 }, b: { bar: 9, price: 109 } }),
    ).toBe(1);
    expect(slopeOf({ shape: "level", price: 5 })).toBe(0);
  });

  it("is negative for a falling line", () => {
    expect(
      slopeOf({ shape: "trendline", a: { bar: 0, price: 109 }, b: { bar: 9, price: 100 } }),
    ).toBe(-1);
  });
});

describe("countTouches", () => {
  const series = risingLows();
  const onTheLows: Drawing = {
    shape: "trendline",
    a: { bar: 0, price: 100 },
    b: { bar: 9, price: 109 },
  };

  it("counts every bar whose low sits on a support line", () => {
    expect(countTouches(onTheLows, series, RANGE, TOL, "support")).toHaveLength(10);
  });

  it("counts nothing when the line is far from price", () => {
    const adrift: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 50 },
      b: { bar: 9, price: 59 },
    };
    expect(countTouches(adrift, series, RANGE, TOL, "support")).toHaveLength(0);
  });

  it("ignores lows when asked about resistance", () => {
    // A support line scored by highs would let a line drawn through the middle of
    // the data count every bar.
    expect(countTouches(onTheLows, series, RANGE, TOL, "resistance")).toHaveLength(0);
  });

  it("counts highs for a resistance line", () => {
    const onTheHighs: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 106 },
      b: { bar: 9, price: 115 },
    };
    expect(countTouches(onTheHighs, series, RANGE, TOL, "resistance")).toHaveLength(10);
  });

  it("counts touches on either rail of a channel", () => {
    const channel: Drawing = {
      shape: "channel",
      a: { bar: 0, price: 100 },
      b: { bar: 9, price: 109 },
      offset: 6,
    };
    expect(countTouches(channel, series, RANGE, TOL, "both")).toHaveLength(10);
  });

  it("counts touches on both bounds of a zone", () => {
    const zone: Drawing = { shape: "zone", top: 115, bottom: 100 };
    const hits = countTouches(zone, series, RANGE, TOL, "both");
    // Bar 0's low is 100 and bar 9's high is 115.
    expect(hits).toContain(0);
    expect(hits).toContain(9);
  });
});

describe("countBodyCuts", () => {
  const series = risingLows();

  it("finds no cuts for a line riding the lows", () => {
    const support: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 100 },
      b: { bar: 9, price: 109 },
    };
    expect(countBodyCuts(support, series, RANGE, TOL)).toHaveLength(0);
  });

  it("finds a cut for every bar a mid-body line passes through", () => {
    // Bodies run from low+2 to low+4, so low+3 is inside every one of them.
    const through: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 103 },
      b: { bar: 9, price: 112 },
    };
    expect(countBodyCuts(through, series, RANGE, TOL)).toHaveLength(10);
  });

  it("does not count a line grazing a body edge", () => {
    // Anchoring exactly at an open or close is legitimate, so tolerance is applied
    // inward rather than outward.
    const onOpens: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 102 },
      b: { bar: 9, price: 111 },
    };
    expect(countBodyCuts(onOpens, series, RANGE, TOL)).toHaveLength(0);
  });

  it("checks both bounds of a zone", () => {
    const zone: Drawing = { shape: "zone", top: 103, bottom: 50 };
    expect(countBodyCuts(zone, series, RANGE, TOL).length).toBeGreaterThan(0);
  });
});

describe("countClosesBeyond", () => {
  const series = risingLows();

  it("finds no invalidation for a line below every close", () => {
    const support: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 100 },
      b: { bar: 9, price: 109 },
    };
    expect(countClosesBeyond(support, series, RANGE, TOL, "support")).toHaveLength(0);
  });

  it("finds an invalidation where a close is under a support line", () => {
    const tooHigh: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 110 },
      b: { bar: 9, price: 119 },
    };
    expect(countClosesBeyond(tooHigh, series, RANGE, TOL, "support")).toHaveLength(10);
  });

  it("uses the opposite comparison for resistance", () => {
    const tooLow: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 90 },
      b: { bar: 9, price: 99 },
    };
    expect(countClosesBeyond(tooLow, series, RANGE, TOL, "resistance")).toHaveLength(10);
  });
});

describe("anchorQuality", () => {
  const series = risingLows();

  it("recognises an anchor on a wick", () => {
    expect(anchorQuality({ bar: 3, price: 103 }, series, RANGE, TOL)).toBe("wick");
    expect(anchorQuality({ bar: 3, price: 109 }, series, RANGE, TOL)).toBe("wick");
  });

  it("recognises an anchor inside the body", () => {
    // The commonest beginner error, and the one worth naming.
    expect(anchorQuality({ bar: 3, price: 106 }, series, RANGE, TOL)).toBe("body");
  });

  it("recognises an anchor nowhere near the bar", () => {
    expect(anchorQuality({ bar: 3, price: 200 }, series, RANGE, TOL)).toBe("off");
  });

  it("reports off for a bar outside the series", () => {
    expect(anchorQuality({ bar: 999, price: 100 }, series, RANGE, TOL)).toBe("off");
  });
});
