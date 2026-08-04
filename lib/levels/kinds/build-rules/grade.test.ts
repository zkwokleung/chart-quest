import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Block } from "@/lib/backtest/blocks";
import type { Series, SeriesId } from "@/lib/chart/types";
import type { Attempt, Level } from "../../schema";
import { gradeBuildRules, perfectBuildRules, runsFor, specFrom } from "./grade";

/**
 * The kind whose attempt is a strategy.
 *
 * What has to hold, and each of these would be a real defect:
 *
 * - **The grader reads nothing ambient.** It is handed the blocks and the series and returns a
 *   verdict, so it can run inside the authoring guards over every level at once.
 * - **`perfectAttempt` clears the level's own objective**, or the level is unwinnable and the
 *   winnability guard is the only thing between that and a stuck player.
 * - **A strategy that loses honestly scores above zero.** Stating a rule and reading its result is
 *   most of Chapter 10; only the second half went wrong.
 * - **The objective is per asset.** A rule that makes everything on one market and loses on the rest
 *   must not pass a cross-asset level, which is 10.7's entire reason for existing.
 */

const cache = new Map<string, Series<string>>();
function load(id: SeriesId): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

/**
 * A rule that genuinely beats doing nothing, measured on this spine.
 *
 * Buy the dip inside an uptrend. Against the always-enter baseline it wins on five of six markets:
 * the index (+0.48 against +0.265), gold (+0.41 against +0.232), Apple (+0.47 against +0.395), the
 * euro (+0.64 against +0.044) and the small-cap (+0.13 against −0.032). It loses on Bitcoin, on 18
 * trades — which the objective reports as too few to say rather than as a failure.
 *
 * Worth recording what it beat out: `close > sma200 + bos-up` — chasing breakouts in an uptrend —
 * makes +0.26R on the index against a baseline of +0.265R. Break-even against doing nothing, on 107
 * trades. That is the level's whole lesson sitting in one cell.
 */
const TRENDING: Block[] = [
  {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
];

function levelWith(
  overrides: Partial<Level<"build-rules">> = {},
): Level<"build-rules"> {
  return {
    id: "10-3",
    chapter: 10,
    title: "Compose the entry",
    kind: "build-rules",
    brief: "Build a rule that makes money on more than one market.",
    data: [
      { series: "SPY-1d", from: 210, to: 4_612, label: "the index" },
      { series: "GC-1d", from: 210, to: 4_607, label: "gold" },
    ],
    config: {
      prompt: "Compose the entry.",
      palette: "unlocked",
      objective: { minTrades: 30, minAssetsPassing: 2, beatBaseline: true },
      fixed: { exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 } },
    },
    target: {
      reference: {
        entry: TRENDING,
        exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 },
        risk: { perTradePct: 0.01 },
      },
    },
    tolerance: {},
    stars: [0.5, 0.7, 0.85],
    misconceptions: [
      { id: "a", test: () => false, message: "A placeholder long enough to pass the guard." },
      { id: "b", test: () => false, message: "Another placeholder long enough to pass." },
    ],
    hints: [],
    ...overrides,
  } as Level<"build-rules">;
}

const dataFor = (level: Level<"build-rules">) =>
  level.data.map((slice) => load(slice.series));

function attemptOf(entry: Block[]): Attempt["build-rules"] {
  return {
    kind: "build-rules",
    entry,
    exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 },
    risk: { perTradePct: 0.01 },
    variants: 1,
    hintsUsed: 0,
  };
}

describe("the contract", () => {
  it("grades from the attempt and the data, reading nothing else", () => {
    // The whole reason the strategy lives on the attempt. If this ever needed a store, Chapter 10
    // would be ungradeable on a fresh save — which is what CONVENTIONS forbids.
    const level = levelWith();
    const grade = gradeBuildRules(attemptOf(TRENDING), level, dataFor(level));
    expect(grade.score).toBeGreaterThan(0);
    expect(grade.reference.kind).toBe("run");
  });

  it("is deterministic, so the same strategy always scores the same", () => {
    const level = levelWith();
    const data = dataFor(level);
    const first = gradeBuildRules(attemptOf(TRENDING), level, data);
    const second = gradeBuildRules(attemptOf(TRENDING), level, data);
    expect(first.score).toBe(second.score);
    expect(first.reference).toEqual(second.reference);
  });

  it("runs one window per slice, so a level can hold data back by not naming it", () => {
    const level = levelWith();
    const whole = runsFor(attemptOf(TRENDING), level, dataFor(level));
    const half = runsFor(
      attemptOf(TRENDING),
      levelWith({
        data: [
          { series: "SPY-1d", from: 210, to: 2_000 },
          { series: "GC-1d", from: 210, to: 2_000 },
        ],
      }),
      [load("SPY-1d"), load("GC-1d")],
    );
    expect(whole).toHaveLength(2);
    expect(half[0]!.run.trades).toBeLessThan(whole[0]!.run.trades);
  });

  it("honours an exit the level fixed over one the player sent", () => {
    // 10.3 asks about the entry only. A player's exit arriving from an earlier level's state must
    // not silently change what is being graded.
    const level = levelWith({
      config: {
        ...levelWith().config,
        fixed: { exit: { stopAtr: 1, targetR: 3, timeStopBars: 20 } },
      },
    });
    const spec = specFrom(attemptOf(TRENDING), level);
    expect(spec.stop.multiple).toBe(1);
    expect(spec.target).toEqual({ kind: "r", multiple: 3 });
    expect(spec.timeStopBars).toBe(20);
  });
});

describe("perfectAttempt", () => {
  it("returns the author's own strategy, and it clears the objective", () => {
    // **What the winnability guard runs.** A reference that does not clear its own objective is an
    // unwinnable level, and this is where that is found rather than by a stuck player.
    const level = levelWith();
    const perfect = perfectBuildRules(level);
    expect(perfect.entry).toEqual(TRENDING);

    const grade = gradeBuildRules(perfect, level, dataFor(level));
    expect(grade.reference.kind === "run" && grade.reference.verdict).toBe("passed");
    expect(grade.stars).toBe(3);
  });
});

describe("what a run is worth", () => {
  it("scores a rule that traded honestly and found nothing above zero, but not near the top", () => {
    // Stating a rule and reading its result is most of Chapter 10. A zero here would tell a player
    // who built a real rule the same thing it tells one who built nothing.
    //
    // **And this is the case that proves the baseline objective earns its place.** Buying breakdowns
    // below the 200-bar average makes a *positive* +0.03R a trade on the index over 55 trades — it
    // clears the specified "expectancy > 0" bar comfortably, and it is worse than entering at
    // random, which pays +0.265R. Scored against zero this rule passed with three stars.
    const level = levelWith();
    const foundNothing: Block[] = [
      {
        kind: "compare",
        left: { kind: "close" },
        op: "<",
        right: { kind: "sma", period: 200 },
      },
      { kind: "structure", event: "bos-down" },
    ];
    const grade = gradeBuildRules(attemptOf(foundNothing), level, dataFor(level));
    const run = grade.reference.kind === "run" ? grade.reference : null;

    expect(grade.score).toBeGreaterThan(0.1);
    expect(grade.stars).toBeLessThan(3);
    expect(run!.verdict).toBe("refuted");
    // Positive expectancy, and beaten by its own market's baseline on every market.
    for (const asset of run!.perAsset) {
      expect(asset.expectancy!, asset.asset).toBeLessThan(asset.baselineR!);
    }
  });

  it("scores an empty rule at the floor, because it never traded", () => {
    const level = levelWith();
    const grade = gradeBuildRules(attemptOf([]), level, dataFor(level));
    expect(grade.reference.kind === "run" && grade.reference.perAsset.every((a) => a.trades === 0)).toBe(
      true,
    );
    expect(grade.stars).toBe(0);
  });

  it("refuses a one-market strategy on a cross-asset objective", () => {
    // 10.7's premise. Scored over per-asset results, so "profitable pooled" cannot carry it.
    const level = levelWith({
      config: {
        ...levelWith().config,
        objective: { minTrades: 20, minAssetsPassing: 2, minClassesPassing: 2 },
      },
    });
    const grade = gradeBuildRules(attemptOf(TRENDING), level, dataFor(level));
    const run = grade.reference.kind === "run" ? grade.reference : null;
    expect(run).not.toBeNull();
    // Whatever the verdict, it rests on how many *classes* cleared rather than on the pooled total.
    expect(run!.classesPassing.length).toBeLessThanOrEqual(2);
  });

  it("reports every market with its trade count, never a figure alone", () => {
    const level = levelWith();
    const grade = gradeBuildRules(attemptOf(TRENDING), level, dataFor(level));
    const run = grade.reference.kind === "run" ? grade.reference : null;
    expect(run!.perAsset).toHaveLength(2);
    for (const asset of run!.perAsset) {
      expect(asset.trades).toBeGreaterThan(0);
      expect(typeof asset.underpowered).toBe("boolean");
    }
    expect(grade.detail).toHaveProperty("trades");
    expect(grade.detail).toHaveProperty("markets passing");
  });

  it("caps stars by hints taken, like every other kind", () => {
    const level = levelWith();
    const withHint = { ...perfectBuildRules(level), hintsUsed: 1 };
    expect(gradeBuildRules(withHint, level, dataFor(level)).stars).toBeLessThan(3);
  });
});
