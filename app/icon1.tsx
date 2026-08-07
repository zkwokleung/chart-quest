import { ImageResponse } from "next/og";

/**
 * A 32px PNG of the same mark as `icon.svg`, because Safari does not render SVG favicons — without
 * this its tabs show a generic glyph. Next emits both as `<link rel="icon">` and each browser takes
 * the format it supports.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const BG = "#0b0e14";
const UP = "#3fb98e";
const DOWN = "#e2603f";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          borderRadius: 7,
        }}
      >
        <div style={{ position: "absolute", left: 9, top: 6, width: 2, height: 21, background: DOWN }} />
        <div
          style={{
            position: "absolute",
            left: 5,
            top: 12,
            width: 10,
            height: 12,
            border: `2px solid ${DOWN}`,
            background: BG,
            borderRadius: 1,
          }}
        />
        <div style={{ position: "absolute", left: 21, top: 3, width: 2, height: 21, background: UP }} />
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 8,
            width: 8,
            height: 12,
            background: UP,
            borderRadius: 1,
          }}
        />
      </div>
    ),
    size,
  );
}
