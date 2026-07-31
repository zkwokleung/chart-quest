import { describe, expect, it } from "vitest";
import type { Attempt, Level } from "../../schema";
import { gradeSpotTheFlaw, perfectSpotTheFlaw } from "./grade";

const CLAIMS = ["a", "b", "c", "d", "e"];

const level: Level<"spot-the-flaw"> = {
  id: "6-5",
  chapter: 6,
  title: "fixture",
  kind: "spot-the-flaw",
  brief: "fixture",
  data: [{ series: "BTCUSDT-1d", from: 200, to: 1400 }],
  config: {
    prompt: "which add nothing?",
    claims: CLAIMS.map((id) => ({ id, label: id.toUpperCase() })),
  },
  target: { flawed: ["a", "b", "c"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    { id: "flagged-none", test: () => false, message: "x" },
    { id: "flagged-all", test: () => false, message: "y" },
  ],
  hints: [],
};

const attemptOf = (flagged: string[]): Attempt["spot-the-flaw"] => ({
  kind: "spot-the-flaw",
  flagged,
  hintsUsed: 0,
});

describe("grading", () => {
  it("gives full marks for exactly the redundant claims", () => {
    const grade = gradeSpotTheFlaw(attemptOf(["a", "b", "c"]), level, []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("gives partial credit for most of them", () => {
    // The reason this is set overlap rather than a single choice: finding two of three
    // while wrongly flagging one is most of the way there, and a pass/fail grader would
    // teach that most of the way is worth nothing.
    const grade = gradeSpotTheFlaw(attemptOf(["a", "b", "d"]), level, []);
    expect(grade.score).toBeGreaterThan(0.6);
    expect(grade.score).toBeLessThan(1);
  });

  it("scores flagging everything below flagging the right three", () => {
    // The over-confluence trap turned on the player: marking every claim is not a reading.
    const everything = gradeSpotTheFlaw(attemptOf(CLAIMS), level, []).score;
    const right = gradeSpotTheFlaw(attemptOf(["a", "b", "c"]), level, []).score;
    expect(everything).toBeLessThan(right);
    expect(everything).toBeCloseTo(0.75);
  });

  it("scores flagging nothing at zero", () => {
    expect(gradeSpotTheFlaw(attemptOf([]), level, []).score).toBe(0);
  });

  it("scores flagging only sound claims at zero", () => {
    expect(gradeSpotTheFlaw(attemptOf(["d", "e"]), level, []).score).toBe(0);
  });

  it("separates a near miss from a wild guess", () => {
    // The discrimination check every grader here has to pass.
    const near = gradeSpotTheFlaw(attemptOf(["a", "b"]), level, []).score;
    const wild = gradeSpotTheFlaw(attemptOf(["a", "d", "e"]), level, []).score;
    expect(near).toBeGreaterThan(wild + 0.3);
  });

  it("ignores a duplicate mark rather than double-counting it", () => {
    const once = gradeSpotTheFlaw(attemptOf(["a", "b", "c"]), level, []).score;
    const twice = gradeSpotTheFlaw(attemptOf(["a", "a", "b", "c"]), level, []).score;
    expect(twice).toBe(once);
  });

  it("ignores a claim the level does not offer", () => {
    // Not reachable through the component, which renders only what the config declares —
    // but a grader should not be gameable by submitting ids that do not exist.
    const grade = gradeSpotTheFlaw(attemptOf(["a", "b", "c", "zzz"]), level, []);
    expect(grade.score).toBe(1);
  });

  it("reports what was found and what was wrongly flagged", () => {
    const grade = gradeSpotTheFlaw(attemptOf(["a", "b", "d"]), level, []);
    expect(grade.detail?.found).toBe("2 of 3");
    expect(grade.detail?.["wrongly flagged"]).toBe(1);
    expect(grade.reference.kind === "claims" && grade.reference.hit).toEqual(["a", "b"]);
  });

  it("caps stars by hints taken, like every other kind", () => {
    const grade = gradeSpotTheFlaw(
      { ...attemptOf(["a", "b", "c"]), hintsUsed: 2 },
      level,
      [],
    );
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(1);
  });

  it("builds a perfect attempt that does not alias the target", () => {
    // The winnability guard grades this; mutating it would corrupt the level.
    const perfect = perfectSpotTheFlaw(level);
    expect(perfect.flagged).toEqual(level.target.flawed);
    expect(perfect.flagged).not.toBe(level.target.flawed);
  });
});
