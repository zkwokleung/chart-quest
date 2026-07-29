import type { Series } from "./types";

/**
 * A deterministic 120-bar series so the chart has something to render before the
 * data pipeline exists.
 *
 * Deliberately not in `public/data/` — it must never be mistaken for a real
 * committed series, and no level may reference it. Generated from a fixed seed so
 * tests and screenshots stay stable.
 */

const BAR_COUNT = 120;
const DAY_MS = 86_400_000;
const START_MS = Date.UTC(2024, 0, 1);

/** Mulberry32 — small, fast, and identical across runs and platforms. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function build(): Series {
  const rand = seeded(0x5eed);
  const t: number[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  const v: number[] = [];

  let close = 100;
  for (let i = 0; i < BAR_COUNT; i += 1) {
    // A mild upward drift with a dip around the middle, so the fixture shows a
    // trend, a pullback and a recovery rather than pure noise.
    const drift = 0.12 - (i > 45 && i < 70 ? 0.5 : 0);
    const shock = (rand() - 0.5) * 2.4;
    const open = close;
    close = Math.max(5, open + drift + shock);
    const wick = 0.4 + rand() * 1.6;

    t.push(START_MS + i * DAY_MS);
    o.push(round(open));
    h.push(round(Math.max(open, close) + wick));
    l.push(round(Math.min(open, close) - wick));
    c.push(round(close));
    v.push(Math.round(800 + rand() * 2600));
  }

  return { id: "FIXTURE-1d", tf: "1d", t, o, h, l, c, v };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const fixtureSeries: Series = build();
