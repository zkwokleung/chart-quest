import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileEntry, warmupFor, type Block } from "@/lib/backtest/blocks";
import { runStrategy, type StrategySpec } from "@/lib/backtest/engine";
import { scoreObjective } from "@/lib/backtest/guards";
import type { Series, SeriesId } from "@/lib/chart/types";
import type { AnyLevel, ExitRule, Level } from "../../schema";
import { ALL_LEVELS, getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 10's levels *claim* against what the engine *does*.
 *
 * Chapter 10 is where the game's own promise gets tested, so its numbers get the same treatment
 * Chapter 9's did — and one more thing besides. **Every figure quoted in a brief or a misconception is
 * recomputed here through the shipped engine**, because the chapter's whole argument is a comparison
 * between two numbers, and a comparison is exactly the kind of claim that rots when code moves.
 *
 * The baseline figures matter most. If entering on every bar ever stops paying +0.27R a trade on the
 * index, then 10.3's objective is measuring something else and the level's prose is wrong — which is a
 * different failure from the code being broken, and this is where the two are told apart.
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

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getAuthoredLevel(id);
  if (!level || level.kind !== kind) {
    throw new Error(`${id} is missing or is not a ${kind} level`);
  }
  return level as unknown as Level<K>;
}

const chapter10 = () => ALL_LEVELS.filter((level) => level.chapter === 10);

const DEFAULT_EXIT: ExitRule = { stopAtr: 2, targetR: 2, timeStopBars: 60 };

function specOf(entry: Block[], exit: ExitRule = DEFAULT_EXIT): StrategySpec {
  return {
    entry: compileEntry(entry),
    side: "long",
    stop: { kind: "atr", multiple: exit.stopAtr },
    target:
      exit.targetR === null ? { kind: "none" } : { kind: "r", multiple: exit.targetR },
    timeStopBars: exit.timeStopBars,
    warmup: warmupFor(entry),
  };
}

/** A rule and its always-enter baseline on one market, over the identical window. */
function measure(id: SeriesId, entry: Block[], exit: ExitRule = DEFAULT_EXIT) {
  const series = load(id);
  const spec = specOf(entry, exit);
  const window = { from: spec.warmup, to: series.c.length };
  const rule = runStrategy(series, spec, window);
  const baseline = runStrategy(series, { ...spec, entry: () => true }, window);
  return { rule, baseline };
}

const DIP: Block[] = [
  {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
];

const BREAKOUT_IN_UPTREND: Block[] = [
  {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  { kind: "structure", event: "bos-up" },
];

describe("the chapter's own invariants", () => {
  it("never names an out-of-sample series in a level's data", () => {
    // **The compile-time guarantee, still intact.** `LevelSlice.series` accepts only `SeriesId`, so
    // this cannot happen — and it is asserted anyway because M10 came close to widening that type to
    // let 10.6 run on the holdback. 10.6 reads it through a component instead, which is why the
    // guarantee survived contact with the level that needed to break it.
    for (const level of chapter10()) {
      for (const slice of level.data) {
        expect(slice.series.endsWith("-oos"), level.id).toBe(false);
      }
    }
  });

  it("grades no level on the store, which Chapter 9 established and this chapter tests hardest", () => {
    // A `build-rules` target holds a strategy, not a reference to a saved one. If a level's target
    // ever mentioned the store, a fresh save could not clear it.
    for (const level of chapter10()) {
      const graded = JSON.stringify({
        target: level.target,
        tolerance: level.tolerance,
      });
      expect(graded, `${level.id} target mentions strategies`).not.toContain("strateg");
      expect(graded, `${level.id} target mentions the journal`).not.toContain("journal");
    }
  });

  it("states every objective over per-asset results rather than a pooled total", () => {
    // 8.5's flawed claim, guarded. An objective with no per-asset requirement would pass a rule that
    // made everything on one market.
    for (const level of chapter10()) {
      if (level.kind !== "build-rules") continue;
      const { objective } = level.config;
      expect(objective.minAssetsPassing ?? 0, level.id).toBeGreaterThanOrEqual(1);
      expect(objective.beatBaseline, level.id).toBe(true);
    }
  });
});

describe("the always-enter baseline, which the chapter rests on", () => {
  it("pays what 10.3 says it pays, on every market the chapter quotes", () => {
    // **The measurement that rewrote the chapter's objective.** If these move, the prose is wrong.
    const expected: [SeriesId, number][] = [
      ["SPY-1d", 0.27],
      ["GC-1d", 0.23],
      ["AAPL-1d", 0.39],
      ["BTCUSDT-1d", 0.32],
    ];
    for (const [id, perTradeR] of expected) {
      const { baseline } = measure(id, DIP);
      expect(baseline.perTradeR, id).toBeCloseTo(perTradeR, 1);
      expect(baseline.trades, id).toBeGreaterThan(100);
    }
  });

  it("is positive on four of six markets, which is why zero was the wrong bar", () => {
    const ids: SeriesId[] = [
      "SPY-1d",
      "GC-1d",
      "AAPL-1d",
      "BTCUSDT-1d",
      "EURUSD-1d",
      "LAKE-1d",
    ];
    const positive = ids.filter((id) => measure(id, DIP).baseline.perTradeR > 0.2);
    expect(positive).toHaveLength(4);
  });
});

describe("10-1 where to build it", () => {
  const level = need("10-1", "classify");

  it("shows the journal without grading on it", () => {
    expect(level.config.artefact).toBe("journal-analytics");
    expect(level.target.correct).toEqual(["history-available"]);
    expect(level.data).toEqual([]);
  });

  it("rests on a bar count the data really has", () => {
    // The level's answer is that history is what decides. The two figures it quotes are the reason.
    expect(load("SPY-1d").c).toHaveLength(4_612);
    expect(load("SPY-15m").c).toHaveLength(1_041);
    const text = [level.brief, ...level.misconceptions.map((m) => m.message)].join(" ");
    expect(text).toContain("4,612");
    expect(text).toContain("1,041");
  });

  it("names the journal's own ceiling rather than a guess at it", () => {
    const messages = level.misconceptions.map((m) => m.message).join(" ");
    expect(messages).toContain("eight trades");
    expect(messages).toContain("four in any one market");
  });
});

describe("10-2 something you could be wrong about", () => {
  const level = need("10-2", "classify");

  it("marks exactly the two the engine could refute", () => {
    expect([...level.target.correct].sort()).toEqual([
      "breakout-30-trades",
      "dip-beats-nothing",
    ]);
    expect(level.config.multiple).toBe(true);
  });

  it("has both testable options be things this engine actually measures", () => {
    // Not a matter of taste: each correct option names a rule, a comparison or a trade count, all of
    // which are `Block`, `Objective` and `runStrategy` terms.
    const testable = level.config.options.filter((o) =>
      level.target.correct.includes(o.id),
    );
    for (const option of testable) {
      expect(option.label, option.id).toMatch(/beats|expectancy|trades/);
    }
  });

  it("keeps the untestable pair untestable rather than merely false", () => {
    const notes = level.config.options
      .filter((o) => !level.target.correct.includes(o.id))
      .map((o) => o.note ?? "")
      .join(" ");
    expect(notes).toContain("probably true");
    expect(notes).toContain("forecast");
  });
});

describe("10-3 build the entry", () => {
  const level = need("10-3", "build-rules");

  it("fixes the exit, so the level asks one question", () => {
    expect(level.config.fixed?.exit).toEqual(DEFAULT_EXIT);
  });

  it("has a reference that beats doing nothing on both markets, with the figures it quotes", () => {
    const spy = measure("SPY-1d", DIP);
    const gold = measure("GC-1d", DIP);

    expect(spy.rule.trades).toBe(49);
    expect(spy.rule.perTradeR).toBeCloseTo(0.478, 2);
    expect(spy.baseline.perTradeR).toBeCloseTo(0.27, 2);
    expect(gold.rule.trades).toBe(34);
    expect(gold.rule.perTradeR).toBeCloseTo(0.407, 2);
    expect(gold.baseline.perTradeR).toBeCloseTo(0.226, 2);

    const text = level.misconceptions.map((m) => m.message).join(" ");
    expect(text).toContain("+0.27R");
    expect(text).toContain("+0.48R");
  });

  it("quotes the rule it beat out, and that rule really is break-even against nothing", () => {
    // The level's whole lesson in one cell: chasing breakouts in an uptrend, 107 trades, and the
    // baseline wins by four thousandths of an R.
    const spy = measure("SPY-1d", BREAKOUT_IN_UPTREND);
    expect(spy.rule.trades).toBe(107);
    expect(spy.rule.perTradeR).toBeCloseTo(0.26, 2);
    expect(spy.rule.perTradeR).toBeLessThan(spy.baseline.perTradeR);
    expect(level.misconceptions.map((m) => m.message).join(" ")).toContain("107 trades");
  });

  it("clears its own objective, which is what makes it winnable", () => {
    const runs = level.data.map((slice) => {
      const { rule, baseline } = measure(slice.series, level.target.reference.entry);
      return { asset: slice.series, run: rule, baseline };
    });
    const result = scoreObjective(runs, level.config.objective);
    expect(result.verdict).toBe("passed");
    expect(result.passing).toEqual(["SPY-1d", "GC-1d"]);
  });
});

describe("10-4 where it is wrong", () => {
  const level = need("10-4", "build-rules");

  it("hands the exit over rather than fixing it", () => {
    expect(level.config.fixed?.exit).toBeUndefined();
  });

  it("has the exit really decide the verdict, which is the level", () => {
    // **The claim the whole level turns on**, recomputed: the same entry beats its baseline on the
    // index at 2 ATR / 2R and loses to it at 1.5 ATR / 3R, while gold goes the other way.
    const tighter: ExitRule = { stopAtr: 1.5, targetR: 3, timeStopBars: 60 };

    const spyAt2 = measure("SPY-1d", DIP);
    expect(spyAt2.rule.perTradeR).toBeGreaterThan(spyAt2.baseline.perTradeR);

    const spyTight = measure("SPY-1d", DIP, tighter);
    expect(spyTight.rule.perTradeR).toBeCloseTo(0.248, 2);
    expect(spyTight.baseline.perTradeR).toBeCloseTo(0.288, 2);
    expect(spyTight.rule.perTradeR).toBeLessThan(spyTight.baseline.perTradeR);

    const goldTight = measure("GC-1d", DIP, tighter);
    expect(goldTight.rule.perTradeR).toBeCloseTo(0.587, 2);
    expect(goldTight.baseline.perTradeR).toBeCloseTo(0.284, 2);
    expect(goldTight.rule.perTradeR).toBeGreaterThan(goldTight.baseline.perTradeR);

    const text = level.misconceptions.map((m) => m.message).join(" ");
    expect(text).toContain("+0.248R");
    expect(text).toContain("+0.587R");
  });

  it("moves the baseline with the exit, or widening the stop would be free marks", () => {
    // The property that makes the exit a decision rather than a knob.
    const wide = measure("SPY-1d", DIP, { stopAtr: 4, targetR: 2, timeStopBars: 60 });
    const narrow = measure("SPY-1d", DIP, { stopAtr: 1, targetR: 2, timeStopBars: 60 });
    expect(wide.baseline.perTradeR).not.toBeCloseTo(narrow.baseline.perTradeR, 2);
  });

  it("clears its own objective", () => {
    const runs = level.data.map((slice) => {
      const { rule, baseline } = measure(
        slice.series,
        level.target.reference.entry,
        level.target.reference.exit,
      );
      return { asset: slice.series, run: rule, baseline };
    });
    expect(scoreObjective(runs, level.config.objective).verdict).toBe("passed");
  });
});
