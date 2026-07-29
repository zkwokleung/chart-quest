import { describe, expect, it } from "vitest";
import {
  barIndexToX,
  clampLogical,
  isValidLogical,
  priceToY,
  xToBarIndex,
  yToPrice,
  type LogicalBounds,
  type ScaleAdapter,
} from "./coords";

const bounds: LogicalBounds = { min: 0, max: 119 };

/**
 * Mimics the library's permissiveness on purpose: bar spacing of 8px, no bounds
 * check on out-of-range integers, and 0 returned for non-integer input.
 */
function fakeScale(overrides: Partial<ScaleAdapter> = {}): ScaleAdapter {
  return {
    coordinateToLogical: (x) => x / 8,
    logicalToCoordinate: (logical) =>
      Number.isInteger(logical) ? logical * 8 : 0,
    coordinateToPrice: (y) => 100 - y / 10,
    priceToCoordinate: (price) => (100 - price) * 10,
    ...overrides,
  };
}

describe("isValidLogical", () => {
  it("rejects non-integers, which the library maps to pixel 0", () => {
    expect(isValidLogical(4.5, bounds)).toBe(false);
    expect(isValidLogical(4, bounds)).toBe(true);
  });

  it("rejects out-of-range indices", () => {
    expect(isValidLogical(-1, bounds)).toBe(false);
    expect(isValidLogical(120, bounds)).toBe(false);
    expect(isValidLogical(119, bounds)).toBe(true);
  });

  it("rejects null, NaN and Infinity", () => {
    expect(isValidLogical(null, bounds)).toBe(false);
    expect(isValidLogical(Number.NaN, bounds)).toBe(false);
    expect(isValidLogical(Number.POSITIVE_INFINITY, bounds)).toBe(false);
  });
});

describe("xToBarIndex", () => {
  it("rounds to the nearest bar", () => {
    const scale = fakeScale();
    expect(xToBarIndex(scale, 80, bounds)).toBe(10);
    // 83px is mid-bar; a click there means the bar it lands on.
    expect(xToBarIndex(scale, 83, bounds)).toBe(10);
    expect(xToBarIndex(scale, 85, bounds)).toBe(11);
  });

  it("returns null past the end of the data", () => {
    const scale = fakeScale();
    // The library happily reports logical 200 here. Trusting it would anchor a
    // drawing to a bar that does not exist.
    expect(xToBarIndex(scale, 1600, bounds)).toBeNull();
    expect(xToBarIndex(scale, -40, bounds)).toBeNull();
  });

  it("returns null when the scale reports nothing", () => {
    const scale = fakeScale({ coordinateToLogical: () => null });
    expect(xToBarIndex(scale, 80, bounds)).toBeNull();
  });
});

describe("barIndexToX", () => {
  it("converts a valid index", () => {
    expect(barIndexToX(fakeScale(), 10, bounds)).toBe(80);
  });

  it("refuses a non-integer instead of returning pixel 0", () => {
    // This is the trap: 0 is a plausible-looking coordinate at the left edge.
    expect(barIndexToX(fakeScale(), 10.5, bounds)).toBeNull();
  });

  it("refuses an out-of-range index", () => {
    expect(barIndexToX(fakeScale(), 500, bounds)).toBeNull();
    expect(barIndexToX(fakeScale(), -3, bounds)).toBeNull();
  });
});

describe("clampLogical", () => {
  it("pulls values into range and rounds", () => {
    expect(clampLogical(-5, bounds)).toBe(0);
    expect(clampLogical(999, bounds)).toBe(119);
    expect(clampLogical(10.4, bounds)).toBe(10);
  });
});

describe("price conversion", () => {
  it("round-trips", () => {
    const scale = fakeScale();
    const y = priceToY(scale, 95);
    expect(y).toBe(50);
    expect(yToPrice(scale, 50)).toBe(95);
  });

  it("returns null for non-finite input and null output", () => {
    expect(priceToY(fakeScale(), Number.NaN)).toBeNull();
    expect(yToPrice(fakeScale({ coordinateToPrice: () => null }), 10)).toBeNull();
  });
});
