import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { createLevelFeed } from "./feed";
import { barContaining, barEnd, lastClosedBar, linkFeeds } from "./linked";

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(`public/data/series/${id}.json`, "utf8"),
  ) as Series<string>;
}

/** The pairs Chapter 6 uses, low timeframe first. */
const PAIRS: [driver: string, followerId: string][] = [
  ["BTCUSDT-4h", "BTCUSDT-1d"],
  ["EURUSD-1h", "EURUSD-4h"],
  ["SPY-15m", "SPY-1h"],
];

describe("bar boundaries", () => {
  it("ends a bar where the next one begins", () => {
    const series = load("BTCUSDT-4h");
    expect(barEnd(series, 0)).toBe(series.t[1]);
    expect(barEnd(series, 10)).toBe(series.t[11]);
  });

  it("falls back to the nominal duration only for the final bar", () => {
    const series = load("BTCUSDT-4h");
    const last = series.t.length - 1;
    expect(barEnd(series, last)).toBe(series.t[last]! + 14_400_000);
  });

  it("uses the next open rather than a nominal day across a weekend", () => {
    // The reason `barEnd` asks the series instead of assuming: an equity Friday bar is
    // followed by Monday, and nothing here needs to know that a session is 6.5 hours.
    const spy = load("SPY-1d");
    const friday = spy.t.findIndex((t) => new Date(t).getUTCDay() === 5);
    expect(friday).toBeGreaterThanOrEqual(0);
    const gap = barEnd(spy, friday) - spy.t[friday]!;
    expect(gap).toBeGreaterThan(86_400_000);
  });
});

describe("finding a position from a moment", () => {
  const series = load("BTCUSDT-1d");

  it("reports the last bar whose window has closed", () => {
    // One millisecond before bar 5 closes, bar 4 is the last complete one.
    expect(lastClosedBar(series, barEnd(series, 5) - 1)).toBe(4);
    expect(lastClosedBar(series, barEnd(series, 5))).toBe(5);
  });

  it("reports nothing when no bar has closed yet", () => {
    expect(lastClosedBar(series, series.t[0]! - 1)).toBe(-1);
  });

  it("distinguishes the bar containing a moment from the last one closed", () => {
    // The distinction the whole module turns on. Halfway through bar 5, the bar
    // *containing* the moment is 5 and the last one *closed* is 4 — and revealing 5 would
    // show a close three-quarters of a day in the future.
    const midway = series.t[5]! + (barEnd(series, 5) - series.t[5]!) / 2;
    expect(barContaining(series, midway)).toBe(5);
    expect(lastClosedBar(series, midway)).toBe(4);
  });
});

describe.each(PAIRS)("%s driving %s", (driverId, followerId) => {
  const driverSeries = load(driverId);
  const followerSeries = load(followerId);

  /** A window in the overlap, with the follower covering the same period. */
  function build(driverFrom: number, bars: number) {
    const driver = createLevelFeed(
      driverSeries,
      { from: driverFrom, to: driverFrom + bars },
      { primedBars: 1 },
    );
    const startMs = driverSeries.t[driverFrom]!;
    const endMs = driverSeries.t[driverFrom + bars - 1]!;
    const from = Math.max(0, barContaining(followerSeries, startMs));
    const to = Math.max(from, barContaining(followerSeries, endMs));
    return { driver, follower: linkFeeds(driver, { series: followerSeries, from, to }) };
  }

  const start = Math.max(
    0,
    barContaining(driverSeries, Math.max(driverSeries.t[0]!, followerSeries.t[0]!)) + 1,
  );

  it("NEVER reveals a follower bar that has not finished", () => {
    // The property this module exists for. A 4h bar whose open is behind the driver still
    // closes ahead of it, and revealing it hands the player a close that has not happened
    // — while looking entirely correct on screen.
    const { driver, follower } = build(start, 200);
    for (let step = 0; step < 200; step += 1) {
      const reached = barEnd(driver.visible(), driver.at);
      const shown = follower.visible();
      const lastShown = shown.t.length - 1;
      if (lastShown >= 0 && lastShown >= follower.first) {
        expect(
          barEnd(followerSeries, lastShown),
          `follower bar ${lastShown} is still open at driver bar ${driver.at}`,
        ).toBeLessThanOrEqual(reached);
      }
      driver.step();
    }
  });

  it("reveals a follower bar as soon as it does finish", () => {
    // The other half: lagging by one bar is correct, lagging by two is a stuck pane.
    const { driver, follower } = build(start, 200);
    for (let step = 0; step < 200; step += 1) {
      const reached = barEnd(driver.visible(), driver.at);
      const due = lastClosedBar(followerSeries, reached);
      if (due >= follower.first && due <= follower.last) {
        expect(follower.at, `driver at ${driver.at}`).toBe(due);
      }
      driver.step();
    }
  });

  it("lands in the same place however it got there", () => {
    // Derived rather than counted, so a scrub and a run of single steps must agree. This
    // is what a second clock would get wrong.
    const stepped = build(start, 120);
    for (let i = 0; i < 60; i += 1) stepped.driver.step();
    const scrubbed = build(start, 120);
    scrubbed.driver.seek(stepped.driver.at);
    expect(scrubbed.follower.at).toBe(stepped.follower.at);
    expect(scrubbed.follower.visible().t.length).toBe(
      stepped.follower.visible().t.length,
    );
  });

  it("goes back when the driver does", () => {
    const { driver, follower } = build(start, 120);
    driver.step(80);
    const forward = follower.at;
    driver.step(-40);
    expect(follower.at).toBeLessThanOrEqual(forward);
    driver.step(40);
    expect(follower.at).toBe(forward);
  });

  it("notifies its own subscribers when the driver moves", () => {
    const { driver, follower } = build(start, 60);
    let calls = 0;
    const off = follower.subscribe(() => {
      calls += 1;
    });
    driver.step();
    driver.step();
    expect(calls).toBe(2);
    off();
    driver.step();
    expect(calls).toBe(2);
  });

  it("moves the driver when the follower's own transport is used", () => {
    // Delegation rather than a silent no-op: a linked feed has one transport, and a step
    // that did nothing would be a trap for whoever wires the next MTF level.
    const { driver, follower } = build(start, 200);
    const before = driver.at;
    follower.step();
    expect(driver.at).toBeGreaterThan(before);
    follower.reset();
    expect(driver.at).toBe(before);
  });

  it("reveals nothing beyond its own window", () => {
    const { driver, follower } = build(start, 200);
    driver.step(500);
    expect(follower.at).toBeLessThanOrEqual(follower.last);
    expect(follower.visible().t.length - 1).toBeLessThanOrEqual(follower.last);
  });

  it("keeps absolute bar indices, as the unlinked feed does", () => {
    const { driver, follower } = build(start, 60);
    driver.step(30);
    const shown = follower.visible();
    const i = shown.t.length - 1;
    expect(shown.t[i]).toBe(followerSeries.t[i]);
    expect(shown.c[i]).toBe(followerSeries.c[i]);
    expect(shown.t[i + 1]).toBeUndefined();
  });
});
