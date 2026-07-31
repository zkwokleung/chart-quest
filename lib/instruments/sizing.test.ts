import { describe, expect, it } from "vitest";
import {
  afterLosses,
  breakevenWinRate,
  expectancyR,
  recoveryNeeded,
  riskOf,
  roundToLot,
  sizePosition,
} from "./sizing";
import { ALL_SPECS, specFor } from "./specs";

/**
 * The contract numbers in `specs.ts` cannot be verified from anything in this repo — they are
 * exchange specifications, not measurements. So these tests check what *can* be checked:
 * internal consistency, that rounding never exceeds a risk budget, and that the four classes
 * genuinely disagree about one trade. That last one is 7.3's entire subject, and a copy-paste
 * error in the spec table would silently make two classes agree.
 */

describe("the spec table is internally consistent", () => {
  it.each(ALL_SPECS.map((s) => [s.id, s] as const))(
    "%s has a positive value per point and lot size",
    (_id, spec) => {
      expect(spec.valuePerPoint).toBeGreaterThan(0);
      expect(spec.lotSize).toBeGreaterThan(0);
    },
  );

  it.each(ALL_SPECS.filter((s) => s.tick !== undefined).map((s) => [s.id, s] as const))(
    "%s has a tick value equal to its tick times its value per point",
    (_id, spec) => {
      expect(spec.tickValue).toBeCloseTo(spec.tick! * spec.valuePerPoint, 6);
    },
  );

  it.each(ALL_SPECS.map((s) => [s.id, s] as const))(
    "%s cites where its contract terms come from",
    (_id, spec) => {
      // The claim these numbers make is "an exchange says so", and a reader should be able to
      // check which exchange.
      expect(spec.source.length).toBeGreaterThan(20);
      expect(spec.unitLabel.length).toBeGreaterThan(0);
    },
  );

  it("keeps the class in step with asset-class.ts rather than restating it", () => {
    for (const spec of ALL_SPECS) {
      expect(["crypto-spot", "equity", "fx", "futures"]).toContain(spec.class);
    }
  });
});

describe("rounding down, always", () => {
  it("never rounds a position up past the budget", () => {
    // The reason this rounds down: a sizing lesson that risks more than it asked to is
    // teaching the opposite of its subject. On gold the overshoot would be a whole contract.
    const gold = specFor("GC-1d");
    expect(roundToLot(2.99, gold)).toBe(2);
    expect(roundToLot(0.99, gold)).toBe(0);
  });

  it("handles a fractional lot size without float dust", () => {
    const btc = specFor("BTCUSDT-1d");
    expect(roundToLot(0.123456789, btc)).toBe(0.12345678);
    const fx = specFor("EURUSD-1d");
    expect(roundToLot(0.079, fx)).toBe(0.07);
  });

  it("returns nothing for a nonsensical size", () => {
    const spec = specFor("SPY-1d");
    expect(roundToLot(0, spec)).toBe(0);
    expect(roundToLot(-5, spec)).toBe(0);
    expect(roundToLot(Number.NaN, spec)).toBe(0);
    expect(roundToLot(Number.POSITIVE_INFINITY, spec)).toBe(0);
  });
});

describe("sizing one trade", () => {
  it("risks what it was asked to, within one lot", () => {
    const result = sizePosition({
      spec: specFor("SPY-1d"),
      equity: 25_000,
      riskPct: 0.01,
      entry: 450,
      stop: 445,
    });
    // $250 of risk over $5 of stop distance is 50 shares exactly.
    expect(result.units).toBe(50);
    expect(result.budget).toBe(250);
    expect(result.risked).toBe(250);
  });

  it("never risks more than the budget, on any instrument", () => {
    for (const spec of ALL_SPECS) {
      const result = sizePosition({
        spec,
        equity: 25_000,
        riskPct: 0.01,
        entry: 137.37,
        stop: 131.11,
      });
      expect(result.risked, spec.id).toBeLessThanOrEqual(result.budget + 1e-6);
    }
  });

  it("leaves less than one lot's worth of the budget unused", () => {
    // The other half of rounding down: it must not throw away most of the position either.
    for (const spec of ALL_SPECS) {
      const result = sizePosition({
        spec,
        equity: 1_000_000,
        riskPct: 0.01,
        entry: 100,
        stop: 95,
      });
      const unusedLots = (result.budget - result.risked) / (result.riskPerUnit * spec.lotSize);
      expect(unusedLots, spec.id).toBeLessThan(1);
    }
  });

  it("returns no position when the stop sits at the entry", () => {
    // There is no risk to divide by, and the honest answer is that the question has none —
    // not that the position is infinite.
    const result = sizePosition({
      spec: specFor("BTCUSDT-1d"),
      equity: 10_000,
      riskPct: 0.01,
      entry: 50_000,
      stop: 50_000,
    });
    expect(result.units).toBe(0);
    expect(result.risked).toBe(0);
  });

  it("scales inversely with stop distance, not with price", () => {
    // The error the misconceptions name: sizing off the entry makes position size independent
    // of risk, which is the commonest real-world mistake in this whole chapter.
    const base = { spec: specFor("AAPL-1d"), equity: 50_000, riskPct: 0.01, entry: 200 };
    const tight = sizePosition({ ...base, stop: 198 });
    const wide = sizePosition({ ...base, stop: 190 });
    expect(tight.units).toBeCloseTo(wide.units * 5, 0);
    expect(tight.risked).toBeCloseTo(wide.risked, 0);
  });
});

describe("7.3: the same trade in four markets", () => {
  /** One percent of $50,000, and a stop 2% below entry, priced per instrument. */
  const sized = (id: Parameters<typeof specFor>[0], entry: number) =>
    sizePosition({
      spec: specFor(id),
      equity: 50_000,
      riskPct: 0.01,
      entry,
      stop: entry * 0.98,
    });

  it("produces a genuinely different position in each class", () => {
    // The level's whole point. If any two of these agreed, 7.3 would be four copies of one
    // sum rather than four instruments.
    const results = {
      crypto: sized("BTCUSDT-1d", 50_000),
      equity: sized("AAPL-1d", 200),
      futures: sized("GC-1d", 1_900),
      fx: sized("EURUSD-1d", 1.1),
    };
    const units = Object.values(results).map((r) => r.units);
    expect(new Set(units).size).toBe(4);
    // And every one of them respects the same $500 budget.
    for (const [name, r] of Object.entries(results)) {
      expect(r.risked, name).toBeLessThanOrEqual(500 + 1e-6);
    }
  });

  it("makes gold the position where the multiplier bites", () => {
    // $500 of risk against a $38 stop distance is 13 ounces' worth — but a contract is 100
    // ounces, so the answer is zero contracts and the lesson is that the instrument is too
    // large for the account. That is a real answer, not a bug.
    const gold = sized("GC-1d", 1_900);
    expect(gold.riskPerUnit).toBeCloseTo(1_900 * 0.02 * 100, 4);
    expect(gold.units).toBe(0);
  });

  it("keeps a fractional instrument fractional", () => {
    const btc = sized("BTCUSDT-1d", 50_000);
    expect(btc.units).toBeGreaterThan(0);
    expect(btc.units).toBeLessThan(1);
  });
});

describe("the arithmetic 7.5 and 7.6 rest on", () => {
  it("gives the breakeven win rate for a reward:risk", () => {
    expect(breakevenWinRate(1)).toBeCloseTo(0.5);
    expect(breakevenWinRate(1.5)).toBeCloseTo(0.4);
    expect(breakevenWinRate(2)).toBeCloseTo(1 / 3);
    expect(breakevenWinRate(3)).toBeCloseTo(0.25);
  });

  it("refuses a reward:risk that is not one", () => {
    expect(breakevenWinRate(0)).toBeNull();
    expect(breakevenWinRate(-2)).toBeNull();
  });

  it("puts expectancy at zero exactly on the breakeven line", () => {
    for (const rr of [0.5, 1, 2, 3, 5]) {
      expect(expectancyR(breakevenWinRate(rr)!, rr)).toBeCloseTo(0, 10);
    }
  });

  it("prices a losing streak multiplicatively", () => {
    // 7.6's two columns. The streak is the same streak; only the sizing differs.
    expect(afterLosses(0.01, 13)).toBeCloseTo(0.8775, 4);
    expect(afterLosses(0.05, 13)).toBeCloseTo(0.5133, 4);
    expect(recoveryNeeded(afterLosses(0.01, 13))).toBeCloseTo(0.1396, 3);
    expect(recoveryNeeded(afterLosses(0.05, 13))).toBeCloseTo(0.9482, 3);
  });

  it("shows recovery growing faster than the loss that caused it", () => {
    // The asymmetry the level exists for: a 49% drawdown needs a 95% gain.
    for (const risk of [0.01, 0.02, 0.05, 0.1]) {
      const left = afterLosses(risk, 13);
      expect(recoveryNeeded(left)).toBeGreaterThan(1 - left);
    }
  });

  it("treats a wiped account as unrecoverable rather than as a number", () => {
    expect(recoveryNeeded(0)).toBe(Infinity);
  });
});

describe("risk of a chosen position", () => {
  it("prices one R in currency", () => {
    // 7.1's question, inverted: this many units with this stop is worth this much.
    expect(riskOf(specFor("SPY-1d"), 50, 450, 445)).toBeCloseTo(250);
    expect(riskOf(specFor("GC-1d"), 1, 1_900, 1_880)).toBeCloseTo(2_000);
    expect(riskOf(specFor("EURUSD-1d"), 0.1, 1.1, 1.095)).toBeCloseTo(50);
  });

  it("agrees with sizePosition, so the two directions cannot drift", () => {
    for (const spec of ALL_SPECS) {
      const sizing = sizePosition({ spec, equity: 40_000, riskPct: 0.02, entry: 80, stop: 76 });
      if (sizing.units === 0) continue;
      expect(riskOf(spec, sizing.units, 80, 76)).toBeCloseTo(sizing.risked, 6);
    }
  });
});
