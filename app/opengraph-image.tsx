import { ImageResponse } from "next/og";

/**
 * The social card, generated at build time rather than committed as a PNG.
 *
 * A checked-in image is a second copy of the name, the tagline and the chapter count, and it goes stale
 * the first time any of them changes — silently, because nothing renders it during development. Built
 * from the same strings the page uses, it cannot.
 *
 * No external font is loaded. It would be a network fetch during the build and a licence to track, for
 * a card most people see at thumbnail size; the system stack is legible and free.
 */

export const alt = "Chart Quest — learn to read any market, one level at a time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0e14";
const FG = "#e6e9ef";
const MUTED = "#8b94a7";
const UP = "#3fbf9f";
const DOWN = "#e06a54";

/**
 * A plausible series, drawn rather than sampled: the card must not depend on the data files.
 *
 * Values are percentages of the strip's height, measured from the top, so the numbers read the way a
 * chart does — a smaller number is a higher price. Bodies are kept at eight points or more because at
 * thumbnail size a two-point body renders as a cross and the card stops looking like candles.
 */
const CANDLES = [
  { o: 78, c: 62, h: 54, l: 86 },
  { o: 62, c: 71, h: 56, l: 79 },
  { o: 71, c: 52, h: 44, l: 76 },
  { o: 52, c: 61, h: 46, l: 68 },
  { o: 61, c: 40, h: 32, l: 66 },
  { o: 40, c: 49, h: 34, l: 57 },
  { o: 49, c: 30, h: 22, l: 54 },
  { o: 30, c: 38, h: 24, l: 45 },
  { o: 38, c: 18, h: 10, l: 42 },
  { o: 18, c: 25, h: 12, l: 31 },
  { o: 25, c: 8, h: 4, l: 29 },
];

const STRIP = 230;
const scale = (percent: number) => (percent / 100) * STRIP;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: FG, fontSize: 92, fontWeight: 600, letterSpacing: -2 }}>
            Chart Quest
          </div>
          <div style={{ color: MUTED, fontSize: 40 }}>
            Learn to read any market, one level at a time.
          </div>
        </div>

        {/* Candles, because the product is a chart you do things to. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            height: STRIP,
          }}
        >
          {CANDLES.map((candle, i) => {
            // Up means the close is *higher*, and higher is a smaller number here.
            const colour = candle.c < candle.o ? UP : DOWN;
            const bodyTop = scale(Math.min(candle.o, candle.c));
            const bodyHeight = Math.max(10, scale(Math.abs(candle.o - candle.c)));
            return (
              <div key={i} style={{ position: "relative", display: "flex", width: 62 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 28,
                    top: scale(candle.h),
                    width: 6,
                    height: scale(candle.l - candle.h),
                    background: colour,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: bodyTop,
                    width: 62,
                    height: bodyHeight,
                    background: colour,
                    borderRadius: 4,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", color: MUTED, fontSize: 30 }}>
          Ten chapters · 73 levels · no account, no server
        </div>
      </div>
    ),
    size,
  );
}
