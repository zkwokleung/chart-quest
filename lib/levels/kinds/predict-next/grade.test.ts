import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import type { Attempt, Direction, Level } from "../../schema";
import { actualDirection, gradePredictNext, perfectPredictNext } from "./grade";

const DAY = 86_400_000;

/** A series whose closes are exactly `closes`, so direction is unambiguous. */
function series(closes: number[]): Series<string> {
  return {
    id: "BTCUSDT-1d",
    tf: "1d",
    t: closes.map((_, i) => Date.UTC(2024, 0, 1) + i * DAY),
    o: closes.map((c) => c),
    h: closes.map((c) => c + 1),
    l: closes.map((c) => c - 1),
    c: [...closes],
    v: closes.map(() => 100),
  };
}

function level(rounds: number, horizon = 3): Level<"predict-next"> {
  return {
    id: "1-B",
    chapter: 1,
    title: "Coin flip",
    kind: "predict-next",
    brief: "test",
    data: Array.from({ length: rounds }, (_, i) => ({
      series: "BTCUSDT-1d" as const,
      from: i * 10,
      to: i * 10 + 5,
    })),
    config: { prompt: "Up or down?", horizon },
    target: {},
    tolerance: {},
    stars: [0.6, 0.8, 1],
    misconceptions: [
      { id: "a", test: () => false, message: "a" },
      { id: "b", test: () => false, message: "b" },
    ],
    hints: [],
  };
}

function attempt(calls: (Direction | null)[], hintsUsed = 0): Attempt["predict-next"] {
  return { kind: "predict-next", calls, hintsUsed };
}

describe("actualDirection", () => {
  const rising = series([10, 11, 12, 13, 14, 15, 16, 17]);

  it("reads up when the later close is higher", () => {
    expect(actualDirection(rising, 2, 3)).toBe("up");
  });

  it("reads down when the later close is lower", () => {
    const falling = series([20, 19, 18, 17, 16, 15]);
    expect(actualDirection(falling, 1, 3)).toBe("down");
  });

  it("treats an unchanged close as up", () => {
    expect(actualDirection(series([10, 10, 10, 10]), 0, 3)).toBe("up");
  });

  it("returns null when the horizon runs past the data", () => {
    expect(actualDirection(rising, 6, 5)).toBeNull();
  });

  it("returns null with no series", () => {
    expect(actualDirection(undefined, 0, 1)).toBeNull();
  });
});

describe("gradePredictNext", () => {
  // 30 rising closes: every round's true direction is "up".
  const data = [series(Array.from({ length: 30 }, (_, i) => 10 + i))];
  const lvl = level(3);
  const perRound = [data[0]!, data[0]!, data[0]!];

  it("awards three stars for answering every round, however wrong", () => {
    // The load-bearing property. 1.B is designed so the player scores near 50%;
    // grading accuracy would lock the game behind a coin flip.
    const allWrong = gradePredictNext(
      attempt(["down", "down", "down"]),
      lvl,
      perRound,
    );
    expect(allWrong.score).toBe(1);
    expect(allWrong.stars).toBe(3);
    expect(allWrong.detail?.right).toBe("0 of 3");
    expect(allWrong.detail?.accuracy).toBe(0);
  });

  it("gives the same stars for a perfect run as for a hopeless one", () => {
    const allRight = gradePredictNext(attempt(["up", "up", "up"]), lvl, perRound);
    const allWrong = gradePredictNext(
      attempt(["down", "down", "down"]),
      lvl,
      perRound,
    );
    expect(allRight.stars).toBe(allWrong.stars);
    expect(allRight.detail?.accuracy).toBe(100);
  });

  it("scores partial for an unfinished run", () => {
    const grade = gradePredictNext(attempt(["up", null, null]), lvl, perRound);
    expect(grade.score).toBeCloseTo(1 / 3, 5);
    expect(grade.stars).toBe(0);
  });

  it("reaches two stars only once most rounds are answered", () => {
    const grade = gradePredictNext(attempt(["up", "down", null]), lvl, perRound);
    expect(grade.score).toBeCloseTo(2 / 3, 5);
    expect(grade.stars).toBe(1);
  });

  it("caps stars when hints were taken", () => {
    const grade = gradePredictNext(attempt(["up", "up", "up"], 1), lvl, perRound);
    expect(grade.stars).toBe(2);
  });

  it("reports the actual directions for the reveal", () => {
    const grade = gradePredictNext(attempt(["up", "down", "up"]), lvl, perRound);
    expect(grade.reference).toMatchObject({ kind: "calls" });
    if (grade.reference.kind !== "calls") throw new Error("wrong overlay kind");
    expect(grade.reference.actual).toEqual(["up", "up", "up"]);
    expect(grade.reference.called).toEqual(["up", "down", "up"]);
  });

  it("ignores rounds whose horizon runs past the data when measuring accuracy", () => {
    const short = [series([10, 11, 12])];
    const grade = gradePredictNext(attempt(["up"]), level(1, 99), [short[0]!]);
    // Participation still counts, so the level stays completable.
    expect(grade.score).toBe(1);
    expect(grade.detail?.right).toBe("0 of 0");
  });
});

describe("perfectPredictNext", () => {
  it("answers every round and scores three stars", () => {
    const data = [series(Array.from({ length: 30 }, (_, i) => 10 + i))];
    const lvl = level(3);
    const perRound = [data[0]!, data[0]!, data[0]!];
    const grade = gradePredictNext(perfectPredictNext(lvl, perRound), lvl, perRound);
    expect(grade.stars).toBe(3);
    expect(grade.detail?.accuracy).toBe(100);
  });
});
