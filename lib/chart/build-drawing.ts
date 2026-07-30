import type { Anchor, Drawing } from "./geometry";

/**
 * How many anchors a shape needs before it is complete.
 *
 * A horizontal level is a single price, so a second click has nothing to
 * contribute. Requiring two made the second one silently discarded — the drawing
 * was graded on the first click while the UI still asked for another point.
 */
export function anchorsNeeded(shape: Drawing["shape"]): 1 | 2 {
  return shape === "level" ? 1 : 2;
}

/**
 * Two anchors become whichever shape the level asked for.
 *
 * A zone and a level care only about price, so they read it off the anchors and
 * ignore the bars — which is what lets one interaction serve all four shapes.
 *
 * Pure and separate from the component because the anchor-count rule and the
 * left-to-right normalisation are the parts that can be wrong, and a component
 * function cannot be unit tested.
 */
export function buildDrawing(
  shape: Drawing["shape"],
  anchors: readonly Anchor[],
): Drawing | null {
  const [a, b] = anchors;
  if (!a) return null;

  if (shape === "level") return { shape: "level", price: a.price };
  if (!b) return null;

  switch (shape) {
    case "trendline":
      return a.bar <= b.bar
        ? { shape: "trendline", a, b }
        : { shape: "trendline", a: b, b: a };
    case "zone":
      return {
        shape: "zone",
        top: Math.max(a.price, b.price),
        bottom: Math.min(a.price, b.price),
      };
    case "channel":
      return a.bar <= b.bar
        ? { shape: "channel", a, b, offset: 0 }
        : { shape: "channel", a: b, b: a, offset: 0 };
  }
}
