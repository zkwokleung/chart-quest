import { describe, expect, it } from "vitest";
import { advanceBy, BARS_PER_SECOND, clampTick } from "./playback";

describe("advanceBy", () => {
  it("reveals the expected bars over one second at each speed", () => {
    expect(advanceBy(1000, 1).bars).toBe(BARS_PER_SECOND);
    expect(advanceBy(1000, 2).bars).toBe(BARS_PER_SECOND * 2);
    expect(advanceBy(1000, 4).bars).toBe(BARS_PER_SECOND * 4);
  });

  it("reveals nothing on a frame too short to earn a bar", () => {
    expect(advanceBy(16, 1).bars).toBe(0);
  });

  it("carries the remainder, so short frames still add up", () => {
    // The bug this exists to prevent: at 4 bars a second a 16 ms frame is worth
    // 0.064 of a bar, and discarding that every frame advances roughly never.
    let carryMs = 0;
    let revealed = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      const step = advanceBy(16.67, 1, carryMs);
      revealed += step.bars;
      carryMs = step.carryMs;
    }
    // One second of 60 fps frames is one second of playback.
    expect(revealed).toBe(BARS_PER_SECOND);
  });

  it("keeps the carry smaller than one bar's worth of time", () => {
    const msPerBar = 1000 / BARS_PER_SECOND;
    for (const elapsed of [1, 7, 16.67, 33, 100, 249]) {
      expect(advanceBy(elapsed, 1).carryMs).toBeLessThan(msPerBar);
    }
  });

  it("holds a pace independent of the display's frame rate", () => {
    // "2x" has to mean the same thing on a 30 Hz panel and a 120 Hz one.
    const run = (fps: number, seconds: number) => {
      let carryMs = 0;
      let revealed = 0;
      for (let frame = 0; frame < fps * seconds; frame += 1) {
        const step = advanceBy(1000 / fps, 2, carryMs);
        revealed += step.bars;
        carryMs = step.carryMs;
      }
      return revealed;
    };

    // Within a bar, not exactly equal. Two seconds at 2x lands *exactly* on a bar
    // boundary (2000ms / 125ms = 16), and 240 additions of 8.333… ms accumulate
    // enough float error to fall a hair short of it, yielding 15. Demanding
    // exactness here would be asserting something floating point cannot promise;
    // being off by at most one bar at the boundary is the real guarantee.
    for (const seconds of [1, 2, 3, 5]) {
      expect(
        Math.abs(run(30, seconds) - run(120, seconds)),
      ).toBeLessThanOrEqual(1);
      expect(run(30, seconds)).toBeGreaterThanOrEqual(
        BARS_PER_SECOND * 2 * seconds - 1,
      );
      expect(run(30, seconds)).toBeLessThanOrEqual(
        BARS_PER_SECOND * 2 * seconds,
      );
    }
  });

  it("ignores a nonsense delta rather than jumping", () => {
    expect(advanceBy(Number.NaN, 1, 40)).toEqual({ bars: 0, carryMs: 40 });
    expect(advanceBy(-500, 1, 40)).toEqual({ bars: 0, carryMs: 40 });
  });
});

describe("clampTick", () => {
  it("passes an ordinary frame through", () => {
    expect(clampTick(16.67)).toBeCloseTo(16.67);
  });

  it("caps a backgrounded tab's delta", () => {
    // Without this, looking away for ten seconds skips 160 bars in one frame and
    // the trade is over before the player looks back.
    expect(clampTick(10_000)).toBe(250);
  });
});
