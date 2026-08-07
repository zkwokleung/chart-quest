import { ImageResponse } from "next/og";

/**
 * The iOS home-screen icon, generated at build time like the OG card — no committed binary to go
 * stale against `icon.svg`, which this redraws at 180px.
 *
 * Full bleed and square on purpose: iOS applies its own corner mask, and a radius baked in here
 * would leave dark artefacts in the corners it rounds off.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BG = "#0b0e14";
const UP = "#3fb98e";
const DOWN = "#e2603f";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG }}>
        <div style={{ position: "absolute", left: 52, top: 34, width: 8, height: 118, background: DOWN }} />
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 68,
            width: 56,
            height: 68,
            border: `11px solid ${DOWN}`,
            background: BG,
            borderRadius: 6,
          }}
        />
        <div style={{ position: "absolute", left: 120, top: 17, width: 8, height: 118, background: UP }} />
        <div
          style={{
            position: "absolute",
            left: 101,
            top: 45,
            width: 45,
            height: 68,
            background: UP,
            borderRadius: 6,
          }}
        />
      </div>
    ),
    size,
  );
}
