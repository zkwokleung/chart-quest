import { describe, expect, it } from "vitest";
import type { Block } from "@/lib/backtest/blocks";
import { UNDERPOWERED_BELOW } from "@/lib/journal/analytics";
import type { OverlaySpec } from "@/lib/levels/schema";
import { playbookMarkdown, type PlaybookInput } from "./export";

/**
 * The document that leaves the game, and the one rule it has to keep.
 *
 * **No figure without its sample size.** Everywhere else in this project that rule protects a level;
 * here it protects a person reading their own notes in six months with none of the context that made
 * them careful. So these tests are mostly about what the document refuses to say: it will not report an
 * out-of-sample return without saying what the count cannot establish, it will not omit a market it
 * lost on, and it will not leave the failure-modes section for the player to fill in optimistically.
 */

type Run = Extract<OverlaySpec, { kind: "run" }>;

const BLOCKS: Block[] = [
  {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
];

function run(
  perAsset: Partial<Run["perAsset"][number]>[],
  verdict: Run["verdict"] = "passed",
): Run {
  return {
    kind: "run",
    verdict,
    reason: "because the test said so",
    perAsset: perAsset.map((asset) => ({
      asset: "SPY-1d",
      trades: 40,
      expectancy: 0.4,
      totalR: 16,
      maxDrawdownR: 5,
      underpowered: false,
      baselineR: 0.27,
      ...asset,
    })),
    passing: ["SPY-1d"],
    classesPassing: ["equity"],
    equityR: [1, 2, 3],
  };
}

function input(over: Partial<PlaybookInput> = {}): PlaybookInput {
  return {
    name: "Dip in an uptrend",
    blocks: BLOCKS,
    exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 },
    risk: { perTradePct: 0.01 },
    inSample: run([{}]),
    holdback: null,
    journal: null,
    variants: 3,
    generatedOn: "2026-08-04",
    ...over,
  };
}

describe("the rule, in words the player can read back", () => {
  it("states each condition in the chapters' language rather than in identifiers", () => {
    const doc = playbookMarkdown(input());
    expect(doc).toContain("the close is above the 200-bar average");
    expect(doc).toContain("RSI(14) is below 40");
    // The same wording the composer showed while they built it, which is the point of sharing
    // `describeBlock` between the two. Scoped to the numbered rule lines: a bare substring search for
    // a three-letter identifier collides with English — "too small" contains "sma".
    const ruleLines = doc
      .split("\n")
      .filter((line) => /^\d+\. /.test(line))
      .join(" ");
    expect(ruleLines).toHaveLength(ruleLines.length);
    expect(ruleLines).not.toMatch(/\bsma\b|\bema\b|\brsi\(/);
    expect(ruleLines).not.toMatch(/bos-(up|down)|atr-pct/);
  });

  it("states the exit in ATR and R, and says why", () => {
    const doc = playbookMarkdown(input());
    expect(doc).toContain("**2 ATR** below entry");
    expect(doc).toContain("**2R** above entry");
    expect(doc).toContain("Risk **1.00%**");
    expect(doc).toContain("means the same thing on every market");
  });

  it("says plainly when there is no rule at all", () => {
    const doc = playbookMarkdown(input({ blocks: [] }));
    expect(doc).toContain("would never trade");
  });

  it("carries a no-financial-advice line, because it leaves the game", () => {
    expect(playbookMarkdown(input())).toContain("not financial advice");
  });
});

describe("no figure without its sample size", () => {
  it("puts the trade count in every per-market row", () => {
    const doc = playbookMarkdown(
      input({ inSample: run([{ asset: "SPY-1d", trades: 49 }, { asset: "GC-1d", trades: 34 }]) }),
    );
    expect(doc).toContain("| SPY-1d | 49 |");
    expect(doc).toContain("| GC-1d | 34 |");
    // Trades is the second column, immediately after the market — before anything it qualifies.
    const header = doc.split("\n").find((line) => line.startsWith("| Market"))!;
    expect(header.indexOf("Trades")).toBeLessThan(header.indexOf("Expectancy"));
  });

  it("names an underpowered market in words rather than leaving it to be noticed", () => {
    const doc = playbookMarkdown(
      input({
        inSample: run([
          { asset: "SPY-1d", trades: 49 },
          { asset: "BTCUSDT-1d", trades: 18, underpowered: true, expectancy: -0.4 },
        ]),
      }),
    );
    expect(doc).toContain("Too few trades to conclude from: BTCUSDT-1d (18)");
    expect(doc).toContain(`Fewer than ${UNDERPOWERED_BELOW} trades is not a result`);
  });

  it("shows the doing-nothing column, or the whole comparison is missing", () => {
    const doc = playbookMarkdown(input());
    expect(doc).toContain("Doing nothing");
    expect(doc).toContain("no entry rule at all");
  });
});

describe("out of sample", () => {
  it("states what the sample cannot establish before showing the numbers", () => {
    const doc = playbookMarkdown({
      ...input(),
      holdback: run([{ asset: "SPY-1d-oos", trades: 9, underpowered: true, expectancy: -0.14 }]),
    });
    const caveat = doc.indexOf("Read the trade counts before the returns");
    const table = doc.indexOf("| SPY-1d-oos |");
    expect(caveat).toBeGreaterThan(-1);
    expect(caveat).toBeLessThan(table);
    expect(doc).toContain("A good result here is not evidence");
  });

  it("says nothing was tested when the holdback has not been run", () => {
    const doc = playbookMarkdown(input({ holdback: null }));
    expect(doc).toContain("nothing here has been tested on unseen data");
  });

  it("never claims the holdback confirmed anything", () => {
    const doc = playbookMarkdown({
      ...input(),
      holdback: run([{ asset: "SPY-1d-oos", trades: 9, expectancy: 0.8, underpowered: true }]),
    }).toLowerCase();
    expect(doc).not.toContain("validated");
    expect(doc).not.toContain("confirms");
    expect(doc).toContain("cannot tell you it works");
  });
});

describe("known failure modes, generated rather than left blank", () => {
  it("names the deepest drawdown and warns the real one is worse", () => {
    const doc = playbookMarkdown(
      input({ inSample: run([{ maxDrawdownR: 8.4 }]) }),
    );
    expect(doc).toContain("Expect to be 8.4R down");
    expect(doc).toContain("a real one will be worse");
  });

  it("names any market where the entry did no better than doing nothing", () => {
    const doc = playbookMarkdown(
      input({
        inSample: run([
          { asset: "SPY-1d", expectancy: 0.03, baselineR: 0.27 },
          { asset: "GC-1d", expectancy: 0.41, baselineR: 0.23 },
        ]),
      }),
    );
    expect(doc).toContain("On SPY-1d the entry did no better than entering on every bar");
    expect(doc).not.toContain("On SPY-1d, GC-1d the entry did no better");
  });

  it("names a market it loses money on outright", () => {
    const doc = playbookMarkdown(
      input({ inSample: run([{ asset: "LAKE-1d", expectancy: -0.2, baselineR: -0.02 }]) }),
    );
    expect(doc).toContain("Loses money on LAKE-1d");
  });

  it("records the variant count once tuning has cost something", () => {
    expect(playbookMarkdown(input({ variants: 3 }))).not.toContain("variants were tried");
    const searched = playbookMarkdown(input({ variants: 22 }));
    expect(searched).toContain("22 variants were tried");
    expect(searched).toContain("25th of 26");
  });

  it("admits to knowing nothing when there was no backtest", () => {
    const doc = playbookMarkdown(input({ inSample: null, holdback: null }));
    expect(doc).toContain("nothing is known about how it fails");
  });
});

describe("review cadence", () => {
  it("counts trades rather than weeks, at the game's own threshold", () => {
    // A monthly review of a rule firing twice a year is eleven months of reading noise.
    const doc = playbookMarkdown(input());
    expect(doc).toContain(`every **${UNDERPOWERED_BELOW} trades**`);
    expect(doc).toContain("Time is not what makes a sample");
  });

  it("tells the player to compare against the baseline rather than the total", () => {
    expect(playbookMarkdown(input())).toContain("If the gap has closed, the edge has gone");
  });

  it("tells them not to re-tune when it stops working", () => {
    expect(playbookMarkdown(input())).toContain("Re-tuning is how a broken rule");
  });
});

describe("the player's own record", () => {
  it("reports the planned trades with their count", () => {
    const doc = playbookMarkdown(
      input({
        journal: {
          planned: {
            n: 8,
            planned: 8,
            wins: 5,
            losses: 3,
            scratches: 0,
            winRate: 0.625,
            winRateCi95: [0.3, 0.86],
            expectancy: 0.3,
            avgWinR: 1.6,
            avgLossR: -1.1,
            totalR: 2.4,
            maxDrawdownR: 2.2,
            worstLosingStreak: 2,
          },
          all: {
            n: 18,
            planned: 8,
            wins: 9,
            losses: 9,
            scratches: 0,
            winRate: 0.5,
            winRateCi95: [0.29, 0.71],
            expectancy: 0.1,
            avgWinR: 1.5,
            avgLossR: -1.3,
            totalR: 1.8,
            maxDrawdownR: 3,
            worstLosingStreak: 3,
          },
          byAssetClass: [],
          bySetup: [],
          bySeries: [],
          discipline: { gapped: 1, excessLossR: 0.2, unreasoned: 10, retried: 2 },
          underpowered: ["Crypto", "Currencies"],
        },
      }),
    );
    expect(doc).toContain("8 trades you planned yourself");
    expect(doc).toContain("Too few trades to split by Crypto, Currencies");
    expect(doc).toContain("10 of them carry no stated reason");
  });

  it("says so when there is no record", () => {
    expect(playbookMarkdown(input({ journal: null }))).toContain("No trades logged");
  });
});
