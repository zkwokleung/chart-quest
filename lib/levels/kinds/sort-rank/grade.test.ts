import { describe, expect, it } from "vitest";
import type { Attempt, Level } from "../../schema";
import { gradeSortRank, maxSwaps, perfectSortRank, swapDistance } from "./grade";

const ITEMS = ["a", "b", "c", "d", "e"];

const level: Level<"sort-rank"> = {
  id: "4-5",
  chapter: 4,
  title: "fixture",
  kind: "sort-rank",
  brief: "fixture",
  data: [{ series: "SPY-1d", from: 0, to: 100 }],
  config: {
    prompt: "order them",
    items: ITEMS.map((id) => ({ id, label: id.toUpperCase() })),
    topLabel: "most",
    bottomLabel: "least",
  },
  target: { order: ITEMS },
  tolerance: { swaps: 1 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    { id: "reversed", test: () => false, message: "x" },
    { id: "untouched", test: () => false, message: "y" },
  ],
  hints: [],
};

const attemptOf = (order: string[]): Attempt["sort-rank"] => ({
  kind: "sort-rank",
  order,
  hintsUsed: 0,
});

describe("swap distance", () => {
  it("is zero for the same ordering", () => {
    expect(swapDistance(ITEMS, ITEMS)).toBe(0);
  });

  it("counts one for a single adjacent transposition", () => {
    expect(swapDistance(["b", "a", "c", "d", "e"], ITEMS)).toBe(1);
  });

  it("counts every pair for a full reversal", () => {
    expect(swapDistance([...ITEMS].reverse(), ITEMS)).toBe(maxSwaps(5));
    expect(maxSwaps(5)).toBe(10);
  });

  it("charges a distant move more than a neighbouring one", () => {
    // Moving the first item to last disagrees with four pairs; swapping two
    // neighbours disagrees with one. This is the property that makes the measure
    // worth using — "nearly right" and "inside out" must not score alike.
    expect(swapDistance(["b", "c", "d", "e", "a"], ITEMS)).toBe(4);
    expect(swapDistance(["a", "b", "c", "e", "d"], ITEMS)).toBe(1);
  });

  it("treats unranked ids as tied at the end, which is why the grader checks", () => {
    // Ties are concordant, so on distance alone the first two of five rows look
    // perfect. `gradeSortRank` rejects an incomplete list before it gets here.
    expect(swapDistance(["a", "b"], ITEMS)).toBe(0);
  });
});

describe("grading", () => {
  it("gives full marks to the measured ordering", () => {
    const grade = gradeSortRank(attemptOf(ITEMS), level, []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("gives full marks inside the swap tolerance", () => {
    // The forgiveness the tolerance exists for: 4.5's three candle patterns differ
    // in frequency by well under 2x and no player could order them by reasoning.
    const grade = gradeSortRank(attemptOf(["a", "b", "c", "e", "d"]), level, []);
    expect(grade.score).toBe(1);
    expect(grade.reference.kind === "ranking" && grade.reference.swaps).toBe(1);
  });

  it("scores zero for a fully reversed ordering", () => {
    expect(gradeSortRank(attemptOf([...ITEMS].reverse()), level, []).score).toBe(0);
  });

  it("separates a near miss from a wild guess", () => {
    // The discrimination check every grader in this project has to pass, since a
    // metric that is flat across the answer space is the recurring authoring fault.
    const near = gradeSortRank(attemptOf(["a", "c", "b", "d", "e"]), level, []).score;
    const wild = gradeSortRank(attemptOf(["e", "c", "a", "d", "b"]), level, []).score;
    expect(near).toBeGreaterThan(wild + 0.3);
  });

  it("reports which rows landed in the right place", () => {
    const grade = gradeSortRank(attemptOf(["a", "b", "c", "e", "d"]), level, []);
    expect(grade.reference.kind === "ranking" && grade.reference.inPlace).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("caps stars by hints taken, like every other kind", () => {
    const grade = gradeSortRank({ ...attemptOf(ITEMS), hintsUsed: 2 }, level, []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(1);
  });

  it("does not divide by zero on a single-item list", () => {
    const single: Level<"sort-rank"> = {
      ...level,
      config: { ...level.config, items: [{ id: "a", label: "A" }] },
      target: { order: ["a"] },
    };
    expect(gradeSortRank(attemptOf(["a"]), single, []).score).toBe(1);
  });

  it("scores an incomplete ranking zero rather than perfect", () => {
    // Without the completeness check this scored 1.0: the three unplaced rows tie at
    // the end, and a tie is concordant.
    const grade = gradeSortRank(attemptOf(["a", "b"]), level, []);
    expect(grade.score).toBe(0);
    expect(grade.detail?.["out of order"]).toMatch(/incomplete/);
  });

  it("rejects a ranking with a duplicated row", () => {
    expect(gradeSortRank(attemptOf(["a", "a", "c", "d", "e"]), level, []).score).toBe(0);
  });

  it("rejects a ranking naming a row the level does not have", () => {
    expect(gradeSortRank(attemptOf(["a", "b", "c", "d", "z"]), level, []).score).toBe(0);
  });

  it("builds a perfect attempt that does not alias the target", () => {
    // The winnability guard grades this; mutating it would corrupt the level.
    const perfect = perfectSortRank(level);
    expect(perfect.order).toEqual(level.target.order);
    expect(perfect.order).not.toBe(level.target.order);
  });
});
