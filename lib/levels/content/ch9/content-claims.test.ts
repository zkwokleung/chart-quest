import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EdgeSweepFile } from "@/lib/ta/edge-sweep";
import { answersFor } from "../../kinds/sizing-calc/grade";
import type { AnyLevel, Level } from "../../schema";
import { ALL_LEVELS, getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 9's levels *claim* against what the data *shows*.
 *
 * The chapter is about not accepting a number without its sample size, so its own numbers get
 * the strictest treatment in the project. Four of its seven specified kinds could not hold, and
 * the reasons are recorded in the level files; these tests are what keep the replacements
 * honest.
 */

const sweep = JSON.parse(
  readFileSync("public/data/edge-sweep.json", "utf8"),
) as EdgeSweepFile;

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getAuthoredLevel(id);
  if (!level || level.kind !== kind) {
    throw new Error(`${id} is missing or is not a ${kind} level`);
  }
  return level as unknown as Level<K>;
}

const chapter9 = () => ALL_LEVELS.filter((level) => level.chapter === 9);
const forAsset = (id: string) => sweep.assets.find((a) => a.asset === id)!;
const bestCell = (id: string) => {
  const asset = forAsset(id);
  return asset.cells.find((c) => c.n === asset.bestInSample)!;
};

describe("the chapter's own invariants", () => {
  it("is completable with an empty store, every level", () => {
    // **The rule that made 9.2 change kind.** A grader cannot read the store, `predictions` is
    // absent on a fresh save and after `resetProgress`, and in private mode storage degrades to
    // memory. So no Chapter 9 level's graded answer may depend on the player's history — the
    // journal and the recalled scores are evidence shown beside the question, never the answer.
    for (const level of chapter9()) {
      const graded = JSON.stringify({
        target: level.target,
        tolerance: level.tolerance,
      });
      expect(graded, `${level.id} target mentions the journal`).not.toContain("journal");
      expect(graded, `${level.id} target mentions predictions`).not.toContain(
        "prediction",
      );
    }
  });

  it("references no out-of-sample data, which is Chapter 10's", () => {
    for (const level of chapter9()) {
      for (const slice of level.data) {
        expect(slice.series.endsWith("-oos"), level.id).toBe(false);
      }
    }
  });
});

describe("9-5 tune it until it looks brilliant", () => {
  const level = need("9-5", "probe");

  it("scores the sweep rather than the answer, which is the level", () => {
    // A target would award three stars for finding the overfit parameter and print it as the
    // answer — teaching the habit the level exists to break, in the level CONVENTIONS.md calls
    // load-bearing.
    expect(level.config.scoring).toBe("exploration");
    expect(level.target.value).toBe(0);
  });

  it("puts its control on the sweep's own grid", () => {
    expect(level.config.min).toBe(sweep.lookbacks[0]);
    expect(level.config.max).toBe(sweep.lookbacks.at(-1));
    // Every reachable value is a measured cell, so no reading is interpolated.
    for (let v = level.config.min; v <= level.config.max; v += level.config.step) {
      expect(sweep.lookbacks, `${v} is off the grid`).toContain(v);
    }
  });

  it("holds the later window back until the answer is committed", () => {
    expect(level.config.revealOnCommit).toBe(true);
  });

  it("shows all four markets, including the counter-example", () => {
    expect([...level.config.assets].sort()).toEqual(
      [...sweep.assets.map((a) => a.asset)].sort(),
    );
    // Apple's optimum held up, which is what stops the level teaching that optimums always
    // collapse. Without it in the table the level would be replacing one false rule with another.
    expect(forAsset("AAPL-1d").bestInSampleRankLater).toBeLessThanOrEqual(5);
  });

  it("quotes the ranks its misconceptions name", () => {
    const messages = level.misconceptions.map((m) => m.message).join(" ");
    expect(forAsset("SPY-1d").bestInSampleRankLater).toBe(25);
    expect(forAsset("GC-1d").bestInSampleRankLater).toBe(21);
    expect(forAsset("BTCUSDT-1d").bestInSampleRankLater).toBe(13);
    expect(forAsset("AAPL-1d").bestInSampleRankLater).toBe(3);
    for (const rank of ["25th of 26", "21st of 26", "3rd of 26"]) {
      expect(messages, rank).toContain(rank);
    }
  });

  it("never says out-of-sample, which is Chapter 10's phrase", () => {
    // A game with two meanings for its most load-bearing term has none. 10.6 uses it for bars
    // nobody has seen; this level splits a series Chapters 1-8 already taught on.
    const text = [
      level.brief,
      level.config.prompt,
      ...level.misconceptions.map((m) => m.message),
      ...level.hints,
    ].join(" ");
    expect(text.toLowerCase()).not.toContain("out-of-sample");
    expect(text.toLowerCase()).not.toContain("out of sample");
  });
});

describe("9-3 how deep does a good year get", () => {
  const level = need("9-3", "probe");
  const apple = bestCell("AAPL-1d");

  it("targets the measured drawdown of the curve it shows", () => {
    expect(apple.inSample.maxDrawdownR).toBeCloseTo(8.2, 1);
    expect(Math.abs(apple.inSample.maxDrawdownR - level.target.value)).toBeLessThanOrEqual(
      level.tolerance.slop,
    );
  });

  it("shows the tidiest of the four curves, so a low guess is wrong everywhere", () => {
    // Apple gives back the smallest share of its total. A player who guesses low here has
    // understated every other market in the chapter too, which is the point of choosing it.
    const shares = sweep.assets.map((a) => {
      const cell = a.cells.find((c) => c.n === a.bestInSample)!;
      return { asset: a.asset, share: cell.inSample.maxDrawdownR / cell.inSample.totalR };
    });
    const gentlest = [...shares].sort((a, b) => a.share - b.share)[0]!;
    expect(gentlest.asset).toBe("AAPL-1d");
    expect(level.config.focus).toBe("AAPL-1d");
  });

  it("quotes the curve's real total and trade count in its brief", () => {
    expect(apple.inSample.totalR).toBeCloseTo(51.7, 1);
    expect(apple.inSample.trades).toBe(116);
    expect(level.brief).toContain("hundred and sixteen");
    expect(level.brief).toContain("fifty-one and a half");
  });

  it("asks in R rather than in percent, because there is no account", () => {
    expect(level.config.label).toContain("R");
    expect(level.brief).toContain("in R");
  });

  it("gives a tolerance wide enough to be about the order of magnitude", () => {
    // A player who guesses 2R has the wrong model of a good year; one who guesses 7R has the
    // right one. The slop is what encodes that this is not a decimal-precision question.
    expect(level.tolerance.slop).toBeGreaterThan(1.5);
    expect(level.tolerance.slop).toBeLessThan(4);
  });

  it("holds the answer back until the guess is committed", () => {
    expect(level.config.revealOnCommit).toBe(true);
    expect(level.config.initial).toBe(0);
  });
});

describe("9-1 was it worth taking", () => {
  const level = need("9-1", "sizing-calc");
  const rs = (level.config.outcomes ?? []).map((o) => o.r);

  it("derives its answer rather than authoring it", () => {
    // `answersFor` is the single source the grader, `perfectAttempt` and this test all call, so
    // the expectancy cannot be typed into the level file and then disagree with the grader.
    expect(level.target).toEqual({});
    expect(answersFor(level)[0]!.correct).toBeCloseTo(
      rs.reduce((t, r) => t + r, 0) / rs.length,
      10,
    );
  });

  it("has the expectancy be the mean, which is what it is when every trade risks 1R", () => {
    const wins = rs.filter((r) => r > 0);
    const losses = rs.filter((r) => r < 0);
    const winRate = wins.length / rs.length;
    const textbook =
      winRate * (wins.reduce((t, r) => t + r, 0) / wins.length) -
      (1 - winRate) * Math.abs(losses.reduce((t, r) => t + r, 0) / losses.length);
    expect(answersFor(level)[0]!.correct).toBeCloseTo(textbook, 10);
  });

  it("looks like a losing list and is not, which is the level", () => {
    const wins = rs.filter((r) => r > 0).length;
    expect(rs).toHaveLength(24);
    expect(wins).toBe(9);
    // A hit rate a player would call a failure, and a positive expectancy anyway.
    expect(wins / rs.length).toBeCloseTo(0.375, 3);
    expect(answersFor(level)[0]!.correct).toBeGreaterThan(0);
    expect(answersFor(level)[0]!.correct).toBeCloseTo(0.146, 2);
  });

  it("keeps two losses past the 1R the stop promised, and labels them", () => {
    // 1.6 taught that a stop does not protect across a gap. Here it costs money in arithmetic
    // rather than on a chart, so the list must actually contain them.
    const gapped = (level.config.outcomes ?? []).filter((o) => o.r < -1.0001);
    expect(gapped).toHaveLength(2);
    for (const o of gapped) expect(o.label).toContain("gapped");
  });

  it("names the win rate its misconception warns against", () => {
    const messages = level.misconceptions.map((m) => m.message).join(" ");
    expect(messages).toContain("37.5%");
    expect(messages).toContain("nine of twenty-four");
  });
});
