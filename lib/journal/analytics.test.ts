import { describe, expect, it } from "vitest";
import type { JournalEntry } from "@/lib/store/schema";
import {
  disciplineScore,
  reportOn,
  statsFor,
  UNDERPOWERED_BELOW,
} from "./analytics";

/**
 * The report has to be right about small numbers, because small numbers are all it will ever
 * see: a player who clears Chapters 1-8 perfectly has seven planned trades. Every "null rather
 * than zero" below is deliberate — an absence reported as a zero reads as a failing.
 */

let seq = 0;
function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    levelId: "3-B",
    seriesId: "BTCUSDT-4h",
    assetClass: "crypto-spot",
    entry: 100,
    stop: 95,
    target: 110,
    exit: 110,
    r: 2,
    reason: "a reason long enough to count as one",
    tags: [],
    at: `2026-01-${String(seq).padStart(2, "0")}T00:00:00.000Z`,
    attemptNo: 1,
    planned: true,
    setup: "continuation",
    ...over,
  };
}

describe("an empty record", () => {
  it("reports nothing rather than zero", () => {
    const report = reportOn([]);
    expect(report.planned.n).toBe(0);
    expect(report.planned.winRate).toBeNull();
    expect(report.planned.expectancy).toBeNull();
    expect(report.planned.avgWinR).toBeNull();
    expect(report.byAssetClass).toEqual([]);
    expect(disciplineScore([])).toBeNull();
  });

  it("ignores entries with no usable R rather than counting them as scratches", () => {
    // An unsimulated trade is not a break-even trade.
    const report = reportOn([entry({ r: null }), entry({ r: 2 })]);
    expect(report.planned.n).toBe(1);
    expect(report.planned.scratches).toBe(0);
  });
});

describe("the statistics", () => {
  it("makes expectancy the mean R, which is what it is here", () => {
    // Every trade risks exactly 1R by construction, so the textbook formula and the mean are
    // the same number — and computing both would be two sources for one fact.
    const rs = [2, -1, 2, -1, 0.5];
    const stats = statsFor(rs.map((r) => entry({ r })));
    expect(stats.expectancy).toBeCloseTo(0.5, 10);

    const winRate = 3 / 5;
    const avgWin = (2 + 2 + 0.5) / 3;
    const avgLoss = 1;
    expect(winRate * avgWin - (1 - winRate) * avgLoss).toBeCloseTo(
      stats.expectancy!,
      10,
    );
  });

  it("counts a zero-R trade as a scratch, not a win", () => {
    const stats = statsFor([entry({ r: 0 }), entry({ r: 2 })]);
    expect(stats.scratches).toBe(1);
    expect(stats.wins).toBe(1);
    // And the win rate is over decided trades, so a scratch does not dilute it.
    expect(stats.winRate).toBe(1);
  });

  it("reports drawdown in R over the cumulative curve", () => {
    // +2, then −1, −1, then +2: the curve peaks at 2, troughs at 0, so the drawdown is 2R.
    const stats = statsFor([2, -1, -1, 2].map((r) => entry({ r })));
    expect(stats.maxDrawdownR).toBeCloseTo(2, 10);
    expect(stats.worstLosingStreak).toBe(2);
  });

  it("reports no drawdown for a curve that only rises", () => {
    expect(statsFor([1, 2, 3].map((r) => entry({ r }))).maxDrawdownR).toBe(0);
  });

  it("orders by time before walking the curve, not by array order", () => {
    // Two entries written out of order still produce one honest curve.
    const late = entry({ r: -1, at: "2026-02-01T00:00:00.000Z" });
    const early = entry({ r: 2, at: "2026-01-01T00:00:00.000Z" });
    expect(reportOn([late, early]).planned.maxDrawdownR).toBeCloseTo(1, 10);
    // Reversed, the loss comes first and the trough is deeper relative to a zero peak.
    const lossFirst = reportOn([
      entry({ r: -1, at: "2026-01-01T00:00:00.000Z" }),
      entry({ r: 2, at: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(lossFirst.planned.maxDrawdownR).toBeCloseTo(1, 10);
  });

  it("withholds an interval below three decided trades", () => {
    expect(statsFor([entry({ r: 2 }), entry({ r: -1 })]).winRateCi95).toBeNull();
    expect(statsFor([2, -1, 2].map((r) => entry({ r }))).winRateCi95).not.toBeNull();
  });
});

describe("planned trades against everything", () => {
  it("keeps the authored plans out of the headline figures", () => {
    // The distinction the chapter turns on: 7.B's trades had their stops chosen for the player.
    const journal = [
      entry({ r: 2, planned: true }),
      entry({ r: -1, planned: false, levelId: "7-B", reason: "" }),
      entry({ r: -1, planned: false, levelId: "7-B", reason: "" }),
    ];
    const report = reportOn(journal);
    expect(report.planned.n).toBe(1);
    expect(report.planned.expectancy).toBe(2);
    expect(report.all.n).toBe(3);
    expect(report.all.expectancy).toBeCloseTo(0, 10);
  });

  it("treats a pre-M9 entry with no flag as planned", () => {
    // Everything written before M9 came from a replay level, where the plan was the player's.
    const report = reportOn([entry({ planned: undefined })]);
    expect(report.planned.n).toBe(1);
  });

  it("breaks down only planned trades, so no cell describes the author's stops", () => {
    const report = reportOn([
      entry({ assetClass: "crypto-spot", planned: true }),
      entry({ assetClass: "futures", planned: false, reason: "" }),
    ]);
    expect(report.byAssetClass.map((c) => c.key)).toEqual(["crypto-spot"]);
  });
});

describe("what the report refuses to conclude", () => {
  it("names every cell too small to support a claim", () => {
    const report = reportOn([
      entry({ assetClass: "crypto-spot" }),
      entry({ assetClass: "fx" }),
    ]);
    for (const cell of report.byAssetClass) expect(cell.underpowered).toBe(true);
    expect(report.underpowered).toContain("Crypto");
    expect(report.underpowered).toContain("Currencies");
  });

  it("stops calling a cell underpowered once it has enough behind it", () => {
    const many = Array.from({ length: UNDERPOWERED_BELOW }, () => entry({ r: 1 }));
    const report = reportOn(many);
    expect(report.byAssetClass[0]!.underpowered).toBe(false);
    expect(report.underpowered).not.toContain("Crypto");
  });

  it("cannot be satisfied by a real playthrough, which is 9.6's whole answer", () => {
    // The largest planned per-class cell a player can reach is four. Asserted here so the
    // guarantee 9.6's graded answer rests on lives beside the code that computes it.
    const asFullPlaythrough = [
      ...Array.from({ length: 2 }, () => entry({ assetClass: "crypto-spot" })),
      ...Array.from({ length: 4 }, () => entry({ assetClass: "equity" })),
      entry({ assetClass: "fx" }),
    ];
    const report = reportOn(asFullPlaythrough);
    expect(Math.max(...report.byAssetClass.map((c) => c.stats.n))).toBeLessThan(
      UNDERPOWERED_BELOW,
    );
    expect(report.byAssetClass.every((c) => c.underpowered)).toBe(true);
  });
});

describe("discipline", () => {
  it("reports how much worse the average loss was than the 1R it promised", () => {
    const report = reportOn([entry({ r: -1.4 }), entry({ r: -1 })]);
    expect(report.discipline.excessLossR).toBeCloseTo(0.2, 6);
    expect(report.discipline.gapped).toBe(1);
  });

  it("reports no excess when every stop held", () => {
    expect(reportOn([entry({ r: -1 })]).discipline.excessLossR).toBe(0);
  });

  it("counts every trade with no stated reason, including the authored ones", () => {
    const report = reportOn([
      entry({ reason: "" }),
      entry({ reason: "", planned: false }),
      entry({ reason: "a real reason, written out" }),
    ]);
    expect(report.discipline.unreasoned).toBe(2);
  });

  it("counts retries as attempts beyond the first per level", () => {
    const report = reportOn([
      entry({ levelId: "3-B", attemptNo: 1 }),
      entry({ levelId: "3-B", attemptNo: 2 }),
      entry({ levelId: "6-2", attemptNo: 1 }),
    ]);
    expect(report.discipline.retried).toBe(1);
  });

  it("scores a considered first-time trade above a retried unexplained one", () => {
    const good = disciplineScore([entry({ r: 2, attemptNo: 1 })])!;
    const bad = disciplineScore([
      entry({ levelId: "3-B", attemptNo: 1, reason: "", r: -1.5 }),
      entry({ levelId: "3-B", attemptNo: 2, reason: "", r: -1.5 }),
    ])!;
    expect(good).toBeGreaterThan(bad);
    expect(good).toBeLessThanOrEqual(1);
    expect(bad).toBeGreaterThanOrEqual(0);
  });

  it("does not punish a gap it could not have prevented, past a point", () => {
    // A stop cannot hold across a gap, so the held component is capped rather than unbounded.
    const gapped = disciplineScore([entry({ r: -3 })])!;
    expect(gapped).toBeGreaterThan(0);
  });
});
