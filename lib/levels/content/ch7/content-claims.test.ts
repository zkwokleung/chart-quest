import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { afterLosses, recoveryNeeded } from "@/lib/instruments/sizing";
import { specFor } from "@/lib/instruments/specs";
import { atr } from "@/lib/ta/atr";
import { findPatterns } from "@/lib/ta/patterns";
import { findSwings } from "@/lib/ta/swings";
import { simulate, type TradePlan } from "@/lib/trade/simulate";
import { answersFor } from "../../kinds/sizing-calc/grade";
import { runSequence } from "../../kinds/trade-sequence/grade";
import type { AnyLevel, Level } from "../../schema";
import { getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 7's levels *claim* against what the data *shows*.
 *
 * The chapter is unusual in that half of it is arithmetic over contract specifications rather
 * than measurement over price — 7.1 to 7.3 name no series at all. Those levels still get claims
 * tests, because the failure mode is the same: a brief that states a number the grader does not
 * produce. `answersFor` is the grader's own function, so a level whose prose disagrees with it
 * fails here rather than in front of a player.
 *
 * The measured half is heavier. 7.5, 7.6, 7.7 and 7.B all quote figures from one mechanical rule
 * traded sequentially, so that rule is written once below and every claim recomputed through it.
 * Chapter 7 has already had two claims fail this way: 7.4 said every stop inside the structure
 * lost, and the window's low was never actually retested; 7.6's spec said six consecutive losses
 * and the data holds thirteen.
 */

const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
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

export type Setup = { bar: number; entry: number; stop: number; risk: number };

/**
 * The chapter's rule: a bullish reversal candle at a prior swing low, stop a quarter ATR beyond
 * that low, taken **in sequence with no overlapping positions**.
 *
 * The sequencing is the part that matters and the part that made Chapter 6 and Chapter 7 report
 * different hit rates for what looks like the same rule. 6.4 counted every qualifying bar,
 * overlaps included, and got 24-28%. This counts a run a trader could actually have taken —
 * entering only when flat — and gets 43-46% on the same assets. Both are honest answers to
 * different questions, and 7.5's docstring says so explicitly because a reader meeting both
 * without the explanation would conclude one of them is a bug.
 *
 * The 90-bar probe that advances the cursor is a *nominal* holding period, not the level's
 * `maxBars`. It exists to place the next entry, so every variant compared below sees exactly the
 * same entries and the same initial stops — which is what makes the comparison mean anything.
 */
function setups(s: Series<string>): Setup[] {
  const out: Setup[] = [];
  let cursor = 60;
  while (cursor < s.t.length - 100) {
    const a = atr(s, cursor);
    if (a <= 0) {
      cursor += 1;
      continue;
    }
    const lows = findSwings(s, { from: cursor - 60, to: cursor + 1 }, 3).filter(
      (w) => w.kind === "low",
    );
    const atSupport = lows.some(
      (w) => w.bar < cursor - 2 && Math.abs(s.l[cursor]! - w.price) < a * 0.6,
    );
    const candle =
      findPatterns(s, "pin-bar", { from: cursor, to: cursor + 1 }).some(
        (p) => p.direction === "bullish",
      ) ||
      findPatterns(s, "engulfing", { from: cursor, to: cursor + 1 }).some(
        (p) => p.direction === "bullish",
      );
    const structure = lows.filter((w) => w.price < s.c[cursor]!).at(-1);
    if (!atSupport || !candle || !structure) {
      cursor += 1;
      continue;
    }
    const stop = structure.price - a * 0.25;
    const entry = s.c[cursor]!;
    const risk = entry - stop;
    if (risk <= 0 || risk / a > 4) {
      cursor += 1;
      continue;
    }
    out.push({ bar: cursor, entry, stop, risk });
    cursor += 1;
    const probe = simulate(
      { side: "long", stop, target: entry + risk * 2 },
      s,
      out.at(-1)!.bar,
      90,
    );
    if (probe) cursor = probe.exitBar + 1;
  }
  return out;
}

/** Every setup on one asset run through one plan, pooled. */
function run(
  id: string,
  plan: (setup: Setup) => TradePlan,
): { rs: number[]; total: number; hitRate: number } {
  const s = series(id);
  const rs: number[] = [];
  for (const setup of setups(s)) {
    const outcome = simulate(plan(setup), s, setup.bar, 90);
    if (outcome) rs.push(outcome.r);
  }
  const total = rs.reduce((t, r) => t + r, 0);
  // "Hit rate" is trades that reached the 2R target, which is what 7.5 quotes. `positive` in
  // 7.7 is a different question and computed separately there, because a trailed trade can exit
  // above water without ever reaching a target.
  const hitRate = rs.length === 0 ? 0 : rs.filter((r) => r >= 1.9).length / rs.length;
  return { rs, total, hitRate };
}

const fixed2R = (setup: Setup): TradePlan => ({
  side: "long",
  stop: setup.stop,
  target: setup.entry + setup.risk * 2,
});

describe("7-1 what one R costs", () => {
  const level = need("7-1", "sizing-calc");

  it("prices each row from the contract spec, not from the level file", () => {
    expect(level.target).toEqual({});
    const answers = answersFor(level);
    // 100 shares four dollars away, and one gold contract four dollars away, both risk 400 —
    // 100 x 1 and 1 x 100. That coincidence is the level's design: same money, and the reason
    // is entirely the multiplier. The euro row is the one that has to differ.
    const expected = [400, 400, 40];
    answers.forEach((answer, i) => expect(answer.correct).toBeCloseTo(expected[i]!, 6));
  });

  it("makes the multiplier the only thing separating the rows", () => {
    const [aapl, gold, euro] = level.config.positions;
    expect(Math.abs(aapl!.entry - aapl!.stop)).toBeCloseTo(4, 10);
    expect(Math.abs(gold!.entry - gold!.stop)).toBeCloseTo(4, 10);
    expect(specFor(gold!.instrument).valuePerPoint).toBe(
      specFor(aapl!.instrument).valuePerPoint * 100,
    );
    expect(specFor(euro!.instrument).valuePerPoint).toBe(100_000);
  });

  it("does not fire its own misconceptions on a correct answer", () => {
    // `risk-same-answer-everywhere` fires when every value matches, and two of the three answers
    // here are 400. Worth asserting rather than assuming: a third row at 400 would have made the
    // correct answer trip a misconception, which is the kind of thing that ships unnoticed.
    const values = answersFor(level).map((a) => a.correct);
    const attempt = { kind: "sizing-calc" as const, values, hintsUsed: 0 };
    for (const m of level.misconceptions) {
      expect(m.test(attempt, level, []), `${m.id} fired on the right answer`).toBe(false);
    }
  });
});

describe("7-2 how much is one percent", () => {
  const level = need("7-2", "sizing-calc");

  it("halves the stop distance and doubles the size, exactly", () => {
    const answers = answersFor(level).map((a) => a.correct);
    // 1% of 25,000 is 250; the distances are 2,000, 1,000 and 500.
    expect(answers).toEqual([0.125, 0.25, 0.5]);
    expect(answers[1]! / answers[0]!).toBeCloseTo(2, 10);
    expect(answers[2]! / answers[1]!).toBeCloseTo(2, 10);
  });

  it("answers in fractions, which is the reason the level is on Bitcoin", () => {
    for (const answer of answersFor(level)) {
      expect(Number.isInteger(answer.correct)).toBe(false);
      expect(answer.risked).toBeCloseTo(250, 6);
    }
  });
});

describe("7-3 the same trade, four markets", () => {
  const level = need("7-3", "sizing-calc");
  const answers = answersFor(level);

  it("gives four different answers to one formula", () => {
    expect(new Set(answers.map((a) => a.correct)).size).toBe(4);
  });

  it("answers zero on gold, which is the level's whole point", () => {
    // A 2% stop on a 1,900-dollar contract of 100 ounces risks 3,800 against a 500 budget, so
    // the smallest tradeable position is already more than the account may lose. Not a rounding
    // artefact — asserted alongside the arithmetic that produces it.
    const gold = answers[2]!;
    expect(gold.correct).toBe(0);
    expect(gold.riskPerUnit).toBeCloseTo(3_800, 6);
    expect(level.config.equity * level.config.riskPct).toBe(500);
  });

  it("puts every row on the same account, the same risk and a 2% stop", () => {
    for (const position of level.config.positions) {
      const distance = Math.abs(position.entry - position.stop);
      expect(distance / position.entry).toBeCloseTo(0.02, 6);
    }
    expect(level.config.equity).toBe(50_000);
    expect(level.config.riskPct).toBe(0.01);
  });

  it("makes 13 the wrong gold answer the misconception says it is", () => {
    // The message claims 13 contracts risks 49,400. Recomputed rather than trusted.
    const gold = level.config.positions[2]!;
    const spec = specFor(gold.instrument);
    const distance = Math.abs(gold.entry - gold.stop);
    expect(Math.round(distance * spec.valuePerPoint * 13)).toBe(49_400);
    // And that 13 really is what a player gets by pricing ounces instead of contracts.
    expect(Math.floor(500 / distance)).toBe(13);
  });
});

describe("7-4 where the stop belongs", () => {
  const level = need("7-4", "replay-trade");
  const s = series("BTCUSDT-1d");
  const trigger = level.target.triggerBar;
  const entry = s.c[trigger]!;
  const volatility = atr(s, trigger, 14);
  const low = level.target.structure.shape === "level" ? level.target.structure.price : NaN;

  const at = (totalAtr: number) => {
    const stop = entry - volatility * totalAtr;
    return simulate(
      { side: "long", stop, target: entry + (entry - stop) * 2 },
      s,
      trigger,
      level.config.maxBars,
    );
  };

  it("states the entry, the ATR and the low the trade rests on", () => {
    expect(entry).toBeCloseTo(3462.07, 2);
    expect(volatility).toBeCloseTo(110.72, 2);
    expect(low).toBe(3349.92);
    expect((entry - low) / volatility).toBeCloseTo(1.013, 3);
  });

  it("has a tolerance band whose ends are both measured", () => {
    // minAtr is the first width clearing the low; maxAtr is the last that still reaches 2R.
    expect(entry - volatility * level.tolerance.minAtr).toBeLessThan(low);
    expect(at(level.tolerance.minAtr)?.r).toBeCloseTo(2, 2);
    expect(at(level.tolerance.maxAtr)?.r).toBeCloseTo(2, 2);
    expect(at(level.tolerance.maxAtr + 0.1)?.r).toBeLessThan(2);
    expect(at(level.tolerance.maxAtr + 0.1)?.reason).toBe("time");
  });

  it("loses a full R at every width the docstring says loses", () => {
    for (const width of [0.3, 0.5, 0.7, 0.8]) {
      expect(at(width)?.r, `${width}x ATR`).toBeCloseTo(-1, 2);
    }
  });

  it("never retested the low, which is the claim the level had to be corrected to make", () => {
    // The original docstring said every stop inside the low lost. It does not: price bottomed
    // above the low entirely, so the boundary sits at 0.80x rather than at the structure's 1.01x.
    let lowest = Infinity;
    for (let i = trigger + 1; i <= trigger + level.config.maxBars; i += 1) {
      lowest = Math.min(lowest, s.l[i]!);
    }
    expect(lowest).toBeGreaterThan(low);
    expect(lowest).toBeCloseTo(3373.1, 1);
    expect((entry - lowest) / volatility).toBeCloseTo(0.804, 3);

    // And the honest boundary: the first width that survives is below the deepest bar, not
    // below the structure.
    expect(at(0.8)?.r).toBeCloseTo(-1, 2);
    expect(at(0.81)?.r).toBeCloseTo(2, 2);
  });
});

describe("7-5 the win rate your target demands", () => {
  const level = need("7-5", "classify");

  /** The six assets 7.5 tabulates, measured through the chapter's rule. */
  const MEASURED = [
    { id: "GC-1d", hitRate: 0.463, trades: 108, total: 43.47 },
    { id: "AAPL-1d", hitRate: 0.431, trades: 102, total: 34.99 },
    { id: "SPY-1d", hitRate: 0.426, trades: 101, total: 33.1 },
    { id: "BTCUSDT-1d", hitRate: 0.316, trades: 76, total: 0.01 },
    { id: "LAKE-1d", hitRate: 0.303, trades: 155, total: -7.48 },
    { id: "EURUSD-1d", hitRate: 0.253, trades: 178, total: -34.41 },
  ];

  it.each(MEASURED)(
    "reproduces $id at $hitRate over $trades trades",
    ({ id, hitRate, trades, total }) => {
      const result = run(id, fixed2R);
      expect(result.rs.length).toBe(trades);
      expect(result.hitRate).toBeCloseTo(hitRate, 3);
      expect(result.total).toBeCloseTo(total, 2);
    },
  );

  it("separates the markets by the 33.3% line, with Bitcoin sitting on it", () => {
    // 1/(1+2) = 33.3%. The formula is arithmetic and needs no defending; what the level claims is
    // that *this dataset's* money changes hands at the line, and it very nearly does. Bitcoin is
    // the exception and the reason the docstring stopped saying "exactly where profit stops":
    // 1.7 points below the line and +0.01R, which is on the line rather than either side of it.
    const breakEven = 1 / (1 + 2);
    for (const { id } of MEASURED) {
      const measured = run(id, fixed2R);
      if (id === "BTCUSDT-1d") {
        expect(measured.hitRate).toBeLessThan(breakEven);
        expect(Math.abs(measured.total)).toBeLessThan(0.5);
        continue;
      }
      expect(measured.total > 0, `${id} sign`).toBe(measured.hitRate > breakEven);
    }

    // And the separation is not marginal for anyone else: above the line is worth tens of R.
    const above = MEASURED.filter((m) => m.hitRate > breakEven);
    expect(above).toHaveLength(3);
    for (const market of above) expect(run(market.id, fixed2R).total).toBeGreaterThan(30);
  });

  it("says a quarter on the euro, which is the number the brief quotes", () => {
    const euro = run("EURUSD-1d", fixed2R);
    expect(euro.hitRate).toBeCloseTo(0.25, 2);
    expect(euro.rs.length).toBe(178);
    expect(level.brief).toContain("quarter");
    // The option text promises 178 trades and −34.4R.
    const correct = level.config.options.find((o) => o.id === "loses");
    expect(correct?.note).toContain("178");
    expect(correct?.note).toContain("34.4");
  });
});

describe("7-6 thirteen in a row", () => {
  const level = need("7-6", "classify");
  const s = series("SPY-1d");

  /** The longest run of consecutive losses, and the trades in it. */
  const streak = (() => {
    const list = setups(s);
    let best = { start: 0, rs: [] as number[] };
    let current: { start: number; rs: number[] } = { start: 0, rs: [] };
    list.forEach((setup, i) => {
      const outcome = simulate(fixed2R(setup), s, setup.bar, 90);
      const r = outcome?.r ?? 0;
      if (r < 0) {
        if (current.rs.length === 0) current = { start: i, rs: [] };
        current.rs.push(r);
        if (current.rs.length > best.rs.length) best = { start: current.start, rs: [...current.rs] };
      } else {
        current = { start: i, rs: [] };
      }
    });
    return { ...best, list };
  })();

  it("holds thirteen consecutive losses, not the six the spec asked for", () => {
    expect(streak.rs.length).toBe(13);
    expect(level.brief).toContain("thirteen");
  });

  it("loses more than a full R on exactly two of them, both gapping", () => {
    // 1.6 taught that a stop does not protect across a gap. This is where it costs money. The
    // level first said three; the data holds two, and asserting the count is what caught it.
    const worse = streak.rs.filter((r) => r < -1.0001);
    expect(worse.length).toBe(2);
    expect(worse.map((r) => Number(r.toFixed(4)))).toEqual([-1.0605, -1.029]);
    for (const r of streak.rs) expect(r).toBeLessThanOrEqual(-1 + 1e-9);
    expect(streak.rs.reduce((t, r) => t + r, 0)).toBeCloseTo(-13.09, 2);
  });

  it("runs from October 2007 to November 2008, inside the window the level displays", () => {
    const slice = level.data[0]!;
    const first = streak.list[streak.start]!.bar;
    const last = streak.list[streak.start + streak.rs.length - 1]!.bar;
    expect(first).toBeGreaterThanOrEqual(slice.from);
    expect(last).toBeLessThanOrEqual(slice.to);
    expect(new Date(s.t[first]!).toISOString().slice(0, 10)).toBe("2007-10-23");
    expect(new Date(s.t[last]!).toISOString().slice(0, 10)).toBe("2008-11-26");
  });

  it("leaves what the docstring says it leaves, compounded on the real thirteen", () => {
    const QUOTED = [
      { risk: 0.01, left: 0.877, recover: 0.141 },
      { risk: 0.02, left: 0.768, recover: 0.303 },
      { risk: 0.05, left: 0.511, recover: 0.957 },
      { risk: 0.1, left: 0.252, recover: 2.974 },
    ];
    for (const { risk, left, recover } of QUOTED) {
      // Compounded over the actual R values rather than via `afterLosses`, which assumes every
      // loss is exactly one R. Two of these are not, and the level quotes the real figures — a
      // difference of a fifth of a point at 1% and four points of recovery at 10%.
      let remaining = 1;
      for (const r of streak.rs) remaining *= 1 + r * risk;
      expect(remaining, `${risk * 100}% left`).toBeCloseTo(left, 3);
      expect(recoveryNeeded(remaining), `${risk * 100}% recovery`).toBeCloseTo(recover, 2);
    }
  });

  it("is worse than the tidy thirteen-times-one-R version, which is why it is quoted", () => {
    // The reason not to reach for `afterLosses` here, asserted rather than left as a comment:
    // the gaps make every size strictly worse than the clean arithmetic suggests.
    for (const risk of [0.01, 0.02, 0.05, 0.1]) {
      let real = 1;
      for (const r of streak.rs) real *= 1 + r * risk;
      expect(real, `${risk * 100}%`).toBeLessThan(afterLosses(risk, streak.rs.length));
    }
  });
});

describe("7-7 what trailing costs", () => {
  const ASSETS = ["GC-1d", "SPY-1d", "AAPL-1d", "BTCUSDT-1d", "EURUSD-1d", "LAKE-1d"];

  /** Pooled across the six assets: total R and the share of trades that ended above water. */
  function pooled(plan: (setup: Setup) => TradePlan) {
    let total = 0;
    let n = 0;
    let positive = 0;
    for (const id of ASSETS) {
      const s = series(id);
      for (const setup of setups(s)) {
        const outcome = simulate(plan(setup), s, setup.bar, 90);
        if (!outcome) continue;
        total += outcome.r;
        n += 1;
        if (outcome.r > 0) positive += 1;
      }
    }
    return { total, n, positive: positive / n };
  }

  const VARIANTS = [
    {
      name: "fixed 2R target",
      total: 69.7,
      positive: 0.37,
      plan: fixed2R,
    },
    {
      name: "trail 1R behind by 0.5R",
      total: 41.6,
      positive: 0.49,
      plan: (s: Setup): TradePlan => ({
        side: "long",
        stop: s.stop,
        target: null,
        trail: { afterR: 1, distanceR: 0.5 },
      }),
    },
    {
      name: "trail 2R behind by 1.0R",
      total: 104.2,
      positive: 0.37,
      plan: (s: Setup): TradePlan => ({
        side: "long",
        stop: s.stop,
        target: null,
        trail: { afterR: 2, distanceR: 1 },
      }),
    },
    {
      name: "half off at 1R, rest to 3R",
      total: 38.4,
      positive: 0.32,
      plan: (s: Setup): TradePlan => ({
        side: "long",
        stop: s.stop,
        target: s.entry + s.risk * 3,
        partial: { atR: 1, fraction: 0.5 },
      }),
    },
    {
      name: "half off at 1R, rest trailed",
      total: 17.6,
      positive: 0.49,
      plan: (s: Setup): TradePlan => ({
        side: "long",
        stop: s.stop,
        target: null,
        partial: { atR: 1, fraction: 0.5 },
        trail: { afterR: 1, distanceR: 1 },
      }),
    },
  ];

  it.each(VARIANTS)("reproduces $name at $total R", ({ total, positive, plan }) => {
    const result = pooled(plan);
    expect(result.total).toBeCloseTo(total, 1);
    expect(result.positive).toBeCloseTo(positive, 2);
  });

  it("counts the 720 trades the level claims", () => {
    expect(pooled(fixed2R).n).toBe(720);
  });

  it("raises the positive share while lowering the total, which is the answer", () => {
    // The one claim the level's correct option rests on, asserted as a relationship rather than
    // as two numbers that happen to sit in a table.
    const held = pooled(fixed2R);
    const trailed = pooled(VARIANTS[1]!.plan);
    expect(trailed.positive).toBeGreaterThan(held.positive);
    expect(trailed.total).toBeLessThan(held.total);
    expect(1 - trailed.total / held.total).toBeCloseTo(0.4, 1);
  });

  it("is not beaten by a blanket 'never trail', which the level refuses to say", () => {
    expect(pooled(VARIANTS[2]!.plan).total).toBeGreaterThan(pooled(fixed2R).total);
  });

  it("shows the single trade the brief describes", () => {
    const s = series("SPY-1d");
    const setup = setups(s).find((x) => x.bar === 508);
    expect(setup, "the brief's trade is a setup the rule finds").toBeDefined();

    const heldTo3R = simulate(
      { side: "long", stop: setup!.stop, target: setup!.entry + setup!.risk * 3 },
      s,
      508,
      90,
    );
    const trailed = simulate(
      {
        side: "long",
        stop: setup!.stop,
        target: null,
        trail: { afterR: 1, distanceR: 0.5 },
      },
      s,
      508,
      90,
    );
    expect(heldTo3R?.r).toBeCloseTo(3.08, 2);
    expect(heldTo3R!.exitBar - 508).toBe(19);
    expect(trailed?.r).toBeCloseTo(1.13, 2);
    expect(trailed!.exitBar - 508).toBe(4);
    expect(trailed?.finalStop).toBeCloseTo(142.86, 2);
    expect(new Date(s.t[508]!).toISOString().slice(0, 10)).toBe("2007-01-10");
  });
});

describe("7-B ten trades", () => {
  const level = need("7-B", "trade-sequence");
  const s = series("GC-1d");
  const flat = (risk: number) =>
    runSequence(
      { kind: "trade-sequence", risks: level.config.trades.map(() => risk), hintsUsed: 0 },
      level,
      [s],
    );

  it("authors no outcomes, so the sequence cannot drift from the data", () => {
    expect(level.target).toEqual({});
  });

  it("produces the ten R values the docstring lists", () => {
    const rs = flat(0.01).steps.map((step) => Number(step.r.toFixed(2)));
    expect(rs).toEqual([-1.0, 2.37, 2.0, -1.0, -1.0, 2.0, 2.39, 2.0, 2.0, -1.21]);
    expect(rs.reduce((t, r) => t + r, 0)).toBeCloseTo(8.55, 2);
  });

  it("gaps through the stop on the last trade, which is 1.6 arriving late", () => {
    const last = level.config.trades.at(-1)!;
    const entry = s.c[last.bar]!;
    const outcome = simulate(
      { side: "long", stop: last.stop, target: entry + (entry - last.stop) * last.targetR },
      s,
      last.bar,
      level.config.maxBars,
    );
    expect(outcome?.gapped).toBe(true);
    expect(outcome?.r).toBeLessThan(-1);
  });

  it("has two consecutive losses in the middle and does not end on a win", () => {
    const rs = flat(0.01).steps.map((step) => step.r);
    expect(rs[3]).toBeLessThan(0);
    expect(rs[4]).toBeLessThan(0);
    expect(rs.at(-1)).toBeLessThan(0);
  });

  it("finishes richer at every size, so the reckless player is rewarded by the data", () => {
    // The chapter's hardest claim: recklessness *won* here, and still scores worse. If this ever
    // inverts, the level's whole argument changes and its prose needs rewriting.
    const QUOTED = [
      { risk: 0.005, equity: 26_083 },
      { risk: 0.01, equity: 27_191 },
      { risk: 0.02, equity: 29_483 },
      { risk: 0.05, equity: 36_931 },
      { risk: 0.1, equity: 50_944 },
    ];
    for (const { risk, equity } of QUOTED) {
      const finished = flat(risk).steps.at(-1)!.equity;
      expect(Math.round(finished), `${risk * 100}%`).toBe(equity);
      expect(finished).toBeGreaterThan(level.config.equity);
    }
    expect(flat(0.1).steps.at(-1)!.equity).toBeGreaterThan(
      flat(0.02).steps.at(-1)!.equity,
    );
  });

  it("trips nobody's ruin line, which the tolerance comment says is deliberate", () => {
    for (const risk of level.config.riskChoices) {
      expect(flat(risk).ruined, `${risk * 100}%`).toBe(false);
    }
  });

  it("keeps every trade inside the window the level displays", () => {
    const slice = level.data[0]!;
    for (const trade of level.config.trades) {
      expect(trade.bar).toBeGreaterThanOrEqual(slice.from);
      expect(trade.bar).toBeLessThanOrEqual(slice.to);
    }
  });

  it("labels each trade with the month it actually falls in", () => {
    for (const trade of level.config.trades) {
      const month = new Date(s.t[trade.bar]!).toLocaleDateString("en", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      expect(trade.label, `bar ${trade.bar}`).toContain(month);
    }
  });
});

describe("the chapter as a whole", () => {
  it("teaches on four assets and bosses on a fifth", () => {
    // The cross-asset boss rule, which has held for every chapter. 7.1-7.3 name no series, so
    // the check is that nothing *taught* on gold.
    const taught = new Set(
      ["7-1", "7-2", "7-3", "7-4", "7-5", "7-6", "7-7"].flatMap(
        (id) => getAuthoredLevel(id)?.data.map((d) => d.series) ?? [],
      ),
    );
    expect(taught.has("GC-1d")).toBe(false);
    expect(need("7-B", "trade-sequence").data[0]!.series).toBe("GC-1d");
  });

  it("cites a source for every contract spec a level prices a trade with", () => {
    // 7.1 and 7.3 turn on numbers that are exchange specifications rather than measurements. A
    // spec without a citation is a number nobody can check, and these are the levels where a
    // wrong one is invisible.
    const priced = new Set(
      ["7-1", "7-2", "7-3"].flatMap((id) => {
        const level = getAuthoredLevel(id);
        return level?.kind === "sizing-calc"
          ? level.config.positions.map((p) => p.instrument)
          : [];
      }),
    );
    for (const instrument of priced) {
      expect(specFor(instrument).source.length, instrument).toBeGreaterThan(20);
    }
  });
});
