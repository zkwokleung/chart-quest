import { describe, expect, it } from "vitest";
import { barMark, partMark } from "../../mark";
import type { Attempt, Level, Mark } from "../../schema";
import { gradeMarkBars, perfectMarkBars } from "./grade";

function level(
  targets: Mark[],
  barSlop = 1,
  mode: "bars" | "candle-anatomy" = "bars",
): Level<"mark-bars"> {
  return {
    id: "1-4",
    chapter: 1,
    title: "test",
    kind: "mark-bars",
    brief: "test",
    data: [{ series: "SPY-1d", from: 900, to: 1000 }],
    config: { prompt: "?", mode },
    target: { marks: targets },
    tolerance: { barSlop },
    stars: [0.4, 0.7, 0.9],
    misconceptions: [
      { id: "a", test: () => false, message: "a" },
      { id: "b", test: () => false, message: "b" },
    ],
    hints: [],
  };
}

function attempt(marks: Mark[], hintsUsed = 0): Attempt["mark-bars"] {
  return { kind: "mark-bars", marks, hintsUsed };
}

describe("gradeMarkBars", () => {
  const targets = [barMark(950), barMark(979), barMark(934)];

  it("scores an exact match perfectly", () => {
    const grade = gradeMarkBars(attempt(targets), level(targets), []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("accepts a mark within barSlop", () => {
    const grade = gradeMarkBars(
      attempt([barMark(951), barMark(978), barMark(935)]),
      level(targets, 1),
      [],
    );
    expect(grade.score).toBe(1);
  });

  it("rejects a mark outside barSlop", () => {
    const grade = gradeMarkBars(attempt([barMark(960)]), level(targets, 1), []);
    expect(grade.score).toBe(0);
  });

  it("scores near zero when everything is marked", () => {
    // The load-bearing property: without precision in the score, "mark every
    // bar" would be a winning strategy on every mark-bars level.
    const all = Array.from({ length: 100 }, (_, i) => barMark(900 + i));
    const grade = gradeMarkBars(attempt(all), level(targets), []);
    expect(grade.score).toBeLessThan(0.1);
    expect(grade.stars).toBe(0);
  });

  it("does not let a cluster claim one target several times", () => {
    // Three marks on one target is one hit, not three, so shotgunning a region
    // cannot manufacture a score.
    const grade = gradeMarkBars(
      attempt([barMark(949), barMark(950), barMark(951)]),
      level([barMark(950)], 1),
      [],
    );
    expect(grade.detail?.found).toBe("1 of 1");
    expect(grade.detail?.incorrect).toBe(2);
    expect(grade.score).toBeLessThan(1);
  });

  it("ignores duplicate marks", () => {
    const grade = gradeMarkBars(
      attempt([barMark(950), barMark(950)]),
      level([barMark(950)], 0),
      [],
    );
    expect(grade.score).toBe(1);
  });

  it("reports missed and wrong marks for the overlay", () => {
    const grade = gradeMarkBars(
      attempt([barMark(950), barMark(700)]),
      level(targets, 0),
      [],
    );
    expect(grade.reference).toMatchObject({ kind: "marks" });
    if (grade.reference.kind !== "marks") throw new Error("wrong overlay kind");
    expect(grade.reference.hit).toEqual([barMark(950)]);
    expect(grade.reference.wrong).toEqual([barMark(700)]);
    expect(grade.reference.missed).toEqual([barMark(979), barMark(934)]);
  });

  it("caps stars when hints were taken", () => {
    const grade = gradeMarkBars(attempt(targets, 1), level(targets), []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(2);
  });

  it("matches candle parts exactly, with no slop", () => {
    const parts = [partMark("upper-wick")];
    expect(
      gradeMarkBars(attempt(parts), level(parts, 2, "candle-anatomy"), []).score,
    ).toBe(1);
    expect(
      gradeMarkBars(
        attempt([partMark("body")]),
        level(parts, 2, "candle-anatomy"),
        [],
      ).score,
    ).toBe(0);
  });

  it("scores zero for an empty attempt when marks were expected", () => {
    expect(gradeMarkBars(attempt([]), level(targets), []).score).toBe(0);
  });
});

describe("perfectMarkBars", () => {
  it("reproduces the target and scores three stars", () => {
    const targets = [barMark(950), barMark(979)];
    const lvl = level(targets);
    const grade = gradeMarkBars(perfectMarkBars(lvl), lvl, []);
    expect(grade.stars).toBe(3);
  });

  it("does not alias the level's target array", () => {
    const lvl = level([barMark(1)]);
    perfectMarkBars(lvl).marks.push(barMark(2));
    expect(lvl.target.marks).toHaveLength(1);
  });
});
