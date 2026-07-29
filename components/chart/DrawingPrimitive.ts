import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import { farPriceAtBar, priceAtBar, type Drawing } from "@/lib/chart/geometry";

/**
 * Renders player drawings inside the chart's own render loop.
 *
 * A chart pane primitive rather than an overlay canvas: the library redraws it on
 * every pan, zoom and resize, so a line cannot drift away from the price it was
 * anchored to. An overlay would have to subscribe to visible-range changes and
 * re-render by hand, which is exactly where that drift comes from.
 *
 * Coordinate conversion is injected, so this class is testable with fakes and no
 * chart at all. Updates are *pushed* through `setItems`, which then calls the
 * library's `requestUpdate` — the mechanism it provides for exactly this. Reading
 * React state through a ref written during render would work but is not allowed
 * under concurrent rendering, where a discarded render leaves the ref inconsistent.
 */

export type DrawingRole = "attempt" | "reference" | "hit" | "wrong";

export type RenderableDrawing = {
  /** Bar indices are absolute, as levels author them. */
  drawing: Drawing;
  role: DrawingRole;
  label?: string;
};

export type DrawingCoords = {
  /** Absolute bar index to pixel x, or null when off the data. */
  barToX: (bar: number) => number | null;
  priceToY: (price: number) => number | null;
  /** First and last absolute bar index the level shows. */
  range: () => { from: number; to: number };
};

const STYLES: Record<DrawingRole, { color: string; width: number; dash: number[] }> = {
  // Distinguished by dash pattern as well as colour, so the roles survive
  // colour-blindness — the same rule the candles follow.
  attempt: { color: "#5ec8d8", width: 2, dash: [] },
  reference: { color: "#9aa4b2", width: 2, dash: [7, 5] },
  hit: { color: "#3fb98e", width: 2.5, dash: [] },
  wrong: { color: "#e2603f", width: 2.5, dash: [3, 3] },
};

class DrawingsRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly items: RenderableDrawing[],
    private readonly coords: DrawingCoords,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (this.items.length === 0) return;

    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      for (const item of this.items) {
        ctx.save();
        const style = STYLES[item.role];
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.setLineDash(style.dash);
        this.drawOne(ctx, item, scope.mediaSize.width);
        ctx.restore();
      }
    });
  }

  private drawOne(
    ctx: CanvasRenderingContext2D,
    item: RenderableDrawing,
    width: number,
  ): void {
    const { drawing } = item;
    const { from, to } = this.coords.range();

    if (drawing.shape === "zone") {
      const top = this.coords.priceToY(drawing.top);
      const bottom = this.coords.priceToY(drawing.bottom);
      if (top === null || bottom === null) return;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, Math.min(top, bottom), width, Math.abs(bottom - top));
      ctx.globalAlpha = 1;
      for (const y of [top, bottom]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      return;
    }

    if (drawing.shape === "level") {
      const y = this.coords.priceToY(drawing.price);
      if (y === null) return;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      return;
    }

    // Trendline and channel are drawn across the whole visible window rather than
    // only between their anchors: a trendline's value is where it projects to, so
    // clipping it to its anchors would hide the part the player reads.
    this.strokeLine(ctx, from, to, (bar) => priceAtBar(drawing, bar));
    if (drawing.shape === "channel") {
      this.strokeLine(ctx, from, to, (bar) => farPriceAtBar(drawing, bar));
    }

    for (const anchor of [drawing.a, drawing.b]) {
      const x = this.coords.barToX(anchor.bar);
      const y = this.coords.priceToY(anchor.price);
      if (x === null || y === null) continue;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private strokeLine(
    ctx: CanvasRenderingContext2D,
    from: number,
    to: number,
    priceAt: (bar: number) => number | null,
  ): void {
    const startPrice = priceAt(from);
    const endPrice = priceAt(to - 1);
    if (startPrice === null || endPrice === null) return;

    const x1 = this.coords.barToX(from);
    const y1 = this.coords.priceToY(startPrice);
    const x2 = this.coords.barToX(to - 1);
    const y2 = this.coords.priceToY(endPrice);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  constructor(
    private readonly getItems: () => RenderableDrawing[],
    private readonly coords: DrawingCoords,
  ) {}

  zOrder() {
    // Above the series, so a line is never hidden behind a candle it touches.
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const items = this.getItems();
    return items.length === 0 ? null : new DrawingsRenderer(items, this.coords);
  }
}

export class DrawingsPrimitive implements ISeriesPrimitive {
  private items: RenderableDrawing[] = [];
  private requestUpdate?: () => void;

  /**
   * One stable array, built once. The library caches pane views on reference
   * identity, so returning a fresh array would invalidate that cache every frame.
   */
  private readonly views: readonly IPrimitivePaneView[];

  constructor(coords: DrawingCoords) {
    this.views = [new DrawingsPaneView(() => this.items, coords)];
  }

  /** Replaces what is drawn and asks the chart to repaint. */
  setItems(items: RenderableDrawing[]): void {
    this.items = items;
    this.requestUpdate?.();
  }

  attached(param: SeriesAttachedParameter): void {
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = undefined;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  /**
   * Called when the viewport changes. Nothing is cached between frames — the
   * renderer reads current state on each draw — so a pan repaints with no
   * invalidation bookkeeping of our own.
   */
  updateAllViews(): void {}
}
