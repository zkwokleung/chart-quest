import { describe, expect, it } from "vitest";
import { anchorsNeeded, buildDrawing } from "./build-drawing";

const a = { bar: 10, price: 100 };
const b = { bar: 20, price: 120 };

describe("anchorsNeeded", () => {
  it("asks for one anchor for a horizontal level and two for everything else", () => {
    // The bug this guards: a level built from `anchors[0]` while the UI demanded
    // two points, so the second click was collected, displayed and discarded.
    expect(anchorsNeeded("level")).toBe(1);
    expect(anchorsNeeded("trendline")).toBe(2);
    expect(anchorsNeeded("zone")).toBe(2);
    expect(anchorsNeeded("channel")).toBe(2);
  });
});

describe("buildDrawing", () => {
  it("builds a level from a single anchor", () => {
    expect(buildDrawing("level", [a])).toEqual({ shape: "level", price: 100 });
  });

  it("ignores a second anchor on a level rather than using it", () => {
    // Whichever way this resolves it must be *stated*: the first click is the
    // price, so a player who expects the second to matter is not silently graded
    // on a price they did not intend.
    expect(buildDrawing("level", [a, b])).toEqual({ shape: "level", price: 100 });
  });

  it("returns null until a two-anchor shape has both", () => {
    expect(buildDrawing("trendline", [])).toBeNull();
    expect(buildDrawing("trendline", [a])).toBeNull();
    expect(buildDrawing("zone", [a])).toBeNull();
    expect(buildDrawing("channel", [a])).toBeNull();
  });

  it("normalises a trendline left to right whichever order it was clicked", () => {
    // Anchor order must not decide slope — the e2e suite draws a falling line by
    // clicking the earlier bar high, and that has to stay a falling line.
    expect(buildDrawing("trendline", [b, a])).toEqual({
      shape: "trendline",
      a,
      b,
    });
    expect(buildDrawing("trendline", [a, b])).toEqual({
      shape: "trendline",
      a,
      b,
    });
  });

  it("normalises a channel left to right too", () => {
    expect(buildDrawing("channel", [b, a])).toEqual({
      shape: "channel",
      a,
      b,
      offset: 0,
    });
  });

  it("orders a zone's bounds by price, not by click order", () => {
    const low = { bar: 5, price: 90 };
    const high = { bar: 40, price: 110 };
    expect(buildDrawing("zone", [high, low])).toEqual({
      shape: "zone",
      top: 110,
      bottom: 90,
    });
    expect(buildDrawing("zone", [low, high])).toEqual({
      shape: "zone",
      top: 110,
      bottom: 90,
    });
  });

  it("keeps a zone's bars out of it, since a zone is two prices", () => {
    const drawing = buildDrawing("zone", [a, b]);
    expect(drawing).not.toHaveProperty("a");
    expect(drawing).not.toHaveProperty("bar");
  });
});
