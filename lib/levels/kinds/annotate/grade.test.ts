import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Drawing } from "@/lib/chart/geometry";
import type { Series } from "@/lib/chart/types";
import type { Attempt, Level } from "../../schema";
import { gradeAnnotate, perfectAnnotate } from "./grade";

/** Lows on the line price = 100 + i, so a support line has an exact answer. */
function risingLows(n = 20): Series<string> {
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

const REFERENCE: Drawing = {
  shape: "trendline",
  a: { bar: 0, price: 100 },
  b: { bar: 19, price: 119 },
};

function level(over: Partial<Level<"annotate">["config"]> = {}): Level<"annotate"> {
  return {
    id: "2-3",
    chapter: 2,
    title: "test",
    kind: "annotate",
    brief: "test",
    data: [{ series: "BTCUSDT-1d", from: 0, to: 20 }],
    config: {
      prompt: "Draw it",
      shape: "trendline",
      side: "support",
      requiredTouches: 3,
      expectSlope: "up",
      ...over,
    },
    target: { reference: REFERENCE },
    tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
    stars: [0.4, 0.7, 0.9],
    misconceptions: [
      {
        id: "cuts-bodies",
        test: () => false,
        message: "Your line runs through candle bodies rather than under them.",
      },
      {
        id: "wrong-way",
        test: () => false,
        message: "A support line under a rising market has to rise with it.",
      },
    ],
    hints: [],
  };
}

function attempt(drawing: Drawing | null, hintsUsed = 0): Attempt["annotate"] {
  return { kind: "annotate", drawing, hintsUsed };
}

const data = [risingLows()];

describe("gradeAnnotate", () => {
  it("gives full marks to a line riding the lows", () => {
    const grade = gradeAnnotate(attempt(REFERENCE), level(), data);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("gives full marks to a valid line that is NOT the reference", () => {
    // The whole point of intrinsic grading. This line is anchored at different
    // bars and has a slightly different slope, but it still rides the lows — and
    // 182 such lines exist on BTC alone.
    const alternative: Drawing = {
      shape: "trendline",
      a: { bar: 4, price: 104 },
      b: { bar: 15, price: 115 },
    };
    const grade = gradeAnnotate(attempt(alternative), level(), data);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("zeroes a line sloping the wrong way rather than part-crediting it", () => {
    // A support line sloping down is not a badly drawn support line; it is a
    // different object. Partial credit would suggest otherwise.
    const backwards: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 119 },
      b: { bar: 19, price: 100 },
    };
    const grade = gradeAnnotate(attempt(backwards), level(), data);
    expect(grade.score).toBe(0);
    expect(grade.stars).toBe(0);
    expect(grade.detail?.slope).toBe("wrong direction");
  });

  it("punishes a line that cuts bodies", () => {
    // Bodies run low+2 to low+4, so low+3 is inside every one of them.
    const through: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 103 },
      b: { bar: 19, price: 122 },
    };
    const grade = gradeAnnotate(attempt(through), level(), data);
    // Reported rather than swallowed by the "never reaches price" gate: a line
    // through the bodies IS near price, and body-cutting is the useful lesson.
    expect(grade.detail?.["body cuts"]).toBe(20);
    expect(grade.score).toBe(0);
  });

  it("counts anchors on a body against the score", () => {
    const onBodies: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 103 },
      b: { bar: 19, price: 122 },
    };
    const grade = gradeAnnotate(attempt(onBodies), level(), data);
    expect(grade.detail?.anchors).toBe("0 of 2 on a wick");
  });

  it("scores a line adrift from price at zero", () => {
    const adrift: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 50 },
      b: { bar: 19, price: 69 },
    };
    expect(gradeAnnotate(attempt(adrift), level(), data).score).toBe(0);
  });

  it("scores nothing when no line was drawn", () => {
    const grade = gradeAnnotate(attempt(null), level(), data);
    expect(grade.score).toBe(0);
    expect(grade.reference).toMatchObject({ kind: "drawing", drawn: null });
  });

  it("reports touched bars and cuts for the overlay", () => {
    const grade = gradeAnnotate(attempt(REFERENCE), level(), data);
    if (grade.reference.kind !== "drawing") throw new Error("wrong overlay kind");
    expect(grade.reference.touched.length).toBeGreaterThan(3);
    expect(grade.reference.cuts).toHaveLength(0);
    expect(grade.reference.reference).toEqual(REFERENCE);
  });

  it("caps stars when hints were taken", () => {
    expect(gradeAnnotate(attempt(REFERENCE, 1), level(), data).stars).toBe(2);
  });

  it("scales the touch requirement from the level's config", () => {
    // The same line scores lower where more touches are demanded.
    const short: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 100 },
      b: { bar: 3, price: 103 },
    };
    const lenient = gradeAnnotate(attempt(short), level({ requiredTouches: 3 }), data);
    const strict = gradeAnnotate(attempt(short), level({ requiredTouches: 40 }), data);
    expect(strict.score).toBeLessThan(lenient.score);
  });

  it("scores a line that never reaches price at zero, not on its lack of cuts", () => {
    // A line far from the chart has no body cuts, which must not earn credit.
    const adrift: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 50 },
      b: { bar: 19, price: 69 },
    };
    const grade = gradeAnnotate(attempt(adrift), level(), data);
    expect(grade.score).toBe(0);
    expect(String(grade.detail?.touches)).toMatch(/never reaches price/);
  });

  it("judges only the span the player drew, not the projection beyond it", () => {
    // Past their anchors the line is a projection: a bar closing through it is an
    // invalidation, not a drawing error.
    const shortLine: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 100 },
      b: { bar: 5, price: 105 },
    };
    const grade = gradeAnnotate(attempt(shortLine), level({ requiredTouches: 3 }), data);
    expect(grade.detail?.["body cuts"]).toBe(0);
  });

  it("accepts a resistance line asked for on the other side", () => {
    const onHighs: Drawing = {
      shape: "trendline",
      a: { bar: 0, price: 106 },
      b: { bar: 19, price: 125 },
    };
    const grade = gradeAnnotate(
      attempt(onHighs),
      level({ side: "resistance" }),
      data,
    );
    expect(grade.score).toBe(1);
  });
});

describe("perfectAnnotate", () => {
  it("reproduces the reference and scores three stars", () => {
    const lvl = level();
    expect(gradeAnnotate(perfectAnnotate(lvl), lvl, data).stars).toBe(3);
  });
});

describe("against the committed data", () => {
  const btc = JSON.parse(
    readFileSync("public/data/series/BTCUSDT-1d.json", "utf8"),
  ) as Series<string>;

  /** The line the content search found: bars 1012 and 1058 on their lows. */
  const real: Drawing = {
    shape: "trendline",
    a: { bar: 1012, price: btc.l[1012] ?? 0 },
    b: { bar: 1058, price: btc.l[1058] ?? 0 },
  };

  const realLevel: Level<"annotate"> = {
    ...level(),
    data: [{ series: "BTCUSDT-1d", from: 1000, to: 1090 }],
    target: { reference: real },
  };

  it("gives the researched line full marks by the grader's own measure", () => {
    // Content-claims discipline: the reference has to survive the same grader a
    // player faces, or level 2.3 would be unwinnable.
    const grade = gradeAnnotate(attempt(real), realLevel, [btc]);
    expect(grade.detail?.["body cuts"]).toBe(0);
    expect(grade.stars).toBe(3);
  });

  it("marks a plausible but body-cutting line down on the same window", () => {
    const mid = (i: number) => ((btc.o[i] ?? 0) + (btc.c[i] ?? 0)) / 2;
    const sloppy: Drawing = {
      shape: "trendline",
      a: { bar: 1012, price: mid(1012) },
      b: { bar: 1058, price: mid(1058) },
    };
    const grade = gradeAnnotate(attempt(sloppy), realLevel, [btc]);
    expect(Number(grade.detail?.["body cuts"])).toBeGreaterThan(0);
    expect(grade.score).toBeLessThan(1);
  });
});
