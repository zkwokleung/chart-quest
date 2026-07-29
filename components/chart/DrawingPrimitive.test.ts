import { describe, expect, it, vi } from "vitest";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Drawing } from "@/lib/chart/geometry";
import {
  DrawingsPrimitive,
  type DrawingCoords,
  type RenderableDrawing,
} from "./DrawingPrimitive";

/**
 * The primitive takes its coordinate conversion by injection, so it can be
 * exercised with fakes and no chart at all — which is the point of that design.
 */

type Call = { op: string; args: number[] };

function fakeTarget(): { target: CanvasRenderingTarget2D; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = {
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (x: number, y: number) => calls.push({ op: "moveTo", args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ op: "lineTo", args: [x, y] }),
    stroke: () => calls.push({ op: "stroke", args: [] }),
    fill: () => calls.push({ op: "fill", args: [] }),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push({ op: "fillRect", args: [x, y, w, h] }),
    arc: (x: number, y: number, r: number) => calls.push({ op: "arc", args: [x, y, r] }),
    setLineDash: (d: number[]) => calls.push({ op: "setLineDash", args: d }),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
  };

  const target = {
    useMediaCoordinateSpace: <T,>(f: (scope: never) => T): T =>
      f({ context: ctx, mediaSize: { width: 500, height: 300 } } as never),
  } as unknown as CanvasRenderingTarget2D;

  return { target, calls };
}

/** Bar 0 at x=0, ten pixels per bar. Price 100 at y=200, one pixel per unit down. */
const coords: DrawingCoords = {
  barToX: (bar) => (bar >= 0 && bar <= 20 ? bar * 10 : null),
  priceToY: (price) => 200 - (price - 100),
  range: () => ({ from: 0, to: 11 }),
};

function render(items: RenderableDrawing[], c: DrawingCoords = coords) {
  const primitive = new DrawingsPrimitive(c);
  primitive.setItems(items);
  const view = primitive.paneViews()[0];
  const renderer = view?.renderer();
  if (!renderer) return { calls: [] as Call[], renderer: null };
  const { target, calls } = fakeTarget();
  renderer.draw(target);
  return { calls, renderer };
}

const trendline: Drawing = {
  shape: "trendline",
  a: { bar: 2, price: 102 },
  b: { bar: 8, price: 108 },
};

describe("DrawingsPrimitive", () => {
  it("returns the same pane-view array every call", () => {
    // The library caches views on reference identity, so a fresh array would
    // invalidate that cache on every frame.
    const primitive = new DrawingsPrimitive(coords);
    expect(primitive.paneViews()).toBe(primitive.paneViews());
  });

  it("renders nothing when there is nothing to draw", () => {
    const primitive = new DrawingsPrimitive(coords);
    expect(primitive.paneViews()[0]?.renderer()).toBeNull();
  });

  it("repaints when items are pushed, and asks the chart to redraw", () => {
    // setItems is the update path: it stores the items and calls the library's
    // requestUpdate, which is how a primitive asks for a frame.
    const requestUpdate = vi.fn();
    const primitive = new DrawingsPrimitive(coords);
    primitive.attached({ requestUpdate } as never);

    expect(primitive.paneViews()[0]?.renderer()).toBeNull();
    primitive.setItems([{ drawing: trendline, role: "attempt" }]);
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    expect(primitive.paneViews()[0]?.renderer()).not.toBeNull();
  });

  it("does not throw when items are pushed before it is attached", () => {
    // React attaches the primitive inside an effect, so a push can land first.
    const primitive = new DrawingsPrimitive(coords);
    expect(() => primitive.setItems([{ drawing: trendline, role: "attempt" }])).not.toThrow();
  });

  it("stops requesting updates once detached", () => {
    const requestUpdate = vi.fn();
    const primitive = new DrawingsPrimitive(coords);
    primitive.attached({ requestUpdate } as never);
    primitive.detached();
    primitive.setItems([{ drawing: trendline, role: "attempt" }]);
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("draws above the series so a line is never hidden by a candle", () => {
    const primitive = new DrawingsPrimitive(coords);
    expect(primitive.paneViews()[0]?.zOrder?.()).toBe("top");
  });
});

describe("trendline rendering", () => {
  it("spans the whole window, not just between its anchors", () => {
    // A trendline's value is where it projects to, so clipping it to its anchors
    // would hide the part the player actually reads.
    const { calls } = render([{ drawing: trendline, role: "attempt" }]);
    const move = calls.find((c) => c.op === "moveTo");
    const line = calls.find((c) => c.op === "lineTo");
    expect(move?.args[0]).toBe(0); // bar 0, left of anchor a at bar 2
    expect(line?.args[0]).toBe(100); // bar 10, right of anchor b at bar 8
  });

  it("places the line at the right price for each end", () => {
    const { calls } = render([{ drawing: trendline, role: "attempt" }]);
    const move = calls.find((c) => c.op === "moveTo");
    const line = calls.find((c) => c.op === "lineTo");
    // Slope is 1/bar from (2,102), so bar 0 is 100 → y 200, bar 10 is 110 → y 190.
    expect(move?.args[1]).toBe(200);
    expect(line?.args[1]).toBe(190);
  });

  it("marks both anchors", () => {
    const { calls } = render([{ drawing: trendline, role: "attempt" }]);
    const arcs = calls.filter((c) => c.op === "arc");
    expect(arcs).toHaveLength(2);
    expect(arcs.map((a) => a.args[0])).toEqual([20, 80]);
  });

  it("skips an anchor that is off the data instead of drawing at a wrong pixel", () => {
    const offData: Drawing = {
      shape: "trendline",
      a: { bar: 2, price: 102 },
      b: { bar: 999, price: 150 },
    };
    const { calls } = render([{ drawing: offData, role: "attempt" }]);
    expect(calls.filter((c) => c.op === "arc")).toHaveLength(1);
  });
});

describe("shape rendering", () => {
  it("draws a level as one horizontal line across the pane", () => {
    const { calls } = render([{ drawing: { shape: "level", price: 105 }, role: "attempt" }]);
    const move = calls.find((c) => c.op === "moveTo");
    const line = calls.find((c) => c.op === "lineTo");
    expect(move?.args).toEqual([0, 195]);
    expect(line?.args).toEqual([500, 195]);
  });

  it("fills a zone and strokes both its bounds", () => {
    const { calls } = render([
      { drawing: { shape: "zone", top: 110, bottom: 100 }, role: "attempt" },
    ]);
    const rect = calls.find((c) => c.op === "fillRect");
    expect(rect?.args).toEqual([0, 190, 500, 10]);
    expect(calls.filter((c) => c.op === "stroke")).toHaveLength(2);
  });

  it("draws both rails of a channel", () => {
    const channel: Drawing = {
      shape: "channel",
      a: { bar: 2, price: 102 },
      b: { bar: 8, price: 108 },
      offset: 5,
    };
    const { calls } = render([{ drawing: channel, role: "attempt" }]);
    expect(calls.filter((c) => c.op === "stroke")).toHaveLength(2);
  });
});

describe("roles", () => {
  it("distinguishes roles by dash pattern as well as colour", () => {
    // Colour alone would not survive colour-blindness, the same rule the candles
    // follow.
    const dashOf = (role: RenderableDrawing["role"]) => {
      const { calls } = render([{ drawing: { shape: "level", price: 105 }, role }]);
      return calls.find((c) => c.op === "setLineDash")?.args ?? [];
    };
    expect(dashOf("attempt")).toEqual([]);
    expect(dashOf("reference").length).toBeGreaterThan(0);
    expect(dashOf("wrong").length).toBeGreaterThan(0);
    expect(dashOf("reference")).not.toEqual(dashOf("wrong"));
  });

  it("balances save and restore so styles never leak between drawings", () => {
    const { calls } = render([
      { drawing: trendline, role: "attempt" },
      { drawing: { shape: "level", price: 105 }, role: "reference" },
    ]);
    expect(calls.filter((c) => c.op === "save")).toHaveLength(2);
    expect(calls.filter((c) => c.op === "restore")).toHaveLength(2);
  });
});

describe("degenerate input", () => {
  it("draws nothing for a vertical trendline rather than throwing", () => {
    const vertical: Drawing = {
      shape: "trendline",
      a: { bar: 4, price: 100 },
      b: { bar: 4, price: 110 },
    };
    expect(() => render([{ drawing: vertical, role: "attempt" }])).not.toThrow();
  });

  it("draws nothing when the price scale has no answer", () => {
    const blind: DrawingCoords = { ...coords, priceToY: () => null };
    const { calls } = render([{ drawing: trendline, role: "attempt" }], blind);
    expect(calls.filter((c) => c.op === "stroke")).toHaveLength(0);
  });
});
