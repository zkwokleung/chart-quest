import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { barIndexOf } from "../../mark";
import { getAuthoredLevel as getLevel } from "../all";
import type { AnyLevel, Level } from "../../schema";

/**
 * Checks what Chapter 1's levels *claim* against what the data *shows*.
 *
 * The generic authoring guards prove a level is winnable, but they derive the
 * perfect attempt from the target, so they cannot tell a right answer from a
 * confidently wrong one. These tests can: every assertion below is measured from
 * the committed series rather than restated from the level file.
 *
 * This matters more here than in most projects. Chart Quest's whole claim is that
 * its numbers are measured, so a level teaching a falsehood is worse than a level
 * that crashes.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
}

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getLevel(id);
  if (!level || level.kind !== kind)
    throw new Error(`${id} is not a ${kind} level`);
  return level as unknown as Level<K>;
}

describe("1-1 candle anatomy", () => {
  const level = need("1-1", "mark-bars");
  const series = load("BTCUSDT-1d");
  const i = level.config.focusBar ?? 0;

  it("focuses a candle with a visible body and both wicks", () => {
    // Nothing to point at otherwise: a doji has no body, and a marubozu no wicks.
    const o = series.o[i] ?? 0;
    const h = series.h[i] ?? 0;
    const l = series.l[i] ?? 0;
    const c = series.c[i] ?? 0;
    const range = h - l;
    expect(range).toBeGreaterThan(0);
    expect(Math.abs(c - o) / range).toBeGreaterThan(0.2);
    expect((h - Math.max(o, c)) / range).toBeGreaterThan(0.15);
    expect((Math.min(o, c) - l) / range).toBeGreaterThan(0.15);
  });

  it("quotes the open and close the data holds", () => {
    expect(level.brief).toContain(String(series.o[i]));
    expect(level.brief).toContain(String(series.c[i]));
  });
});

describe("1-2 what a line chart hides", () => {
  const level = need("1-2", "classify");
  const series = load("BTCUSDT-1d");
  const slice = level.data[0]!;

  it("contains a bar whose range is 28.7% of its close", () => {
    const found = Array.from(
      { length: slice.to - slice.from },
      (_, k) => slice.from + k,
    ).some((i) => {
      const h = series.h[i] ?? 0;
      const l = series.l[i] ?? 0;
      const c = series.c[i] ?? 1;
      return Math.abs(((h - l) / c) * 100 - 28.7) < 0.5;
    });
    expect(found).toBe(true);
  });

  it("contains a bar that closed near its open despite that range", () => {
    // Without this the level's premise fails: a line chart only hides the range
    // when the close does not reflect it.
    const found = Array.from(
      { length: slice.to - slice.from },
      (_, k) => slice.from + k,
    ).some((i) => {
      const o = series.o[i] ?? 0;
      const h = series.h[i] ?? 0;
      const l = series.l[i] ?? 0;
      const c = series.c[i] ?? 1;
      return (h - l) / c > 0.2 && Math.abs(c - o) / (h - l) < 0.15;
    });
    expect(found).toBe(true);
  });
});

describe("1-3 the timeframe illusion", () => {
  const level = need("1-3", "classify");

  it("really shows one timeframe falling while the other rises", () => {
    // The level's entire premise. If both slices trended the same way the question
    // would have no answer.
    const [fourHour, daily] = level.data;
    const h4 = load(fourHour!.series);
    const d1 = load(daily!.series);

    const legStart = h4.c[fourHour!.from] ?? 1;
    const legEnd = h4.c[fourHour!.to - 1] ?? 1;
    const ctxStart = d1.c[daily!.from] ?? 1;
    const ctxEnd = d1.c[daily!.to - 1] ?? 1;

    expect(legEnd / legStart - 1).toBeLessThan(-0.05);
    expect(ctxEnd / ctxStart - 1).toBeGreaterThan(0.25);
  });

  it("ends both slices on the same day", () => {
    // Otherwise the honest answer would be "they cover different periods".
    const [fourHour, daily] = level.data;
    const h4 = load(fourHour!.series);
    const d1 = load(daily!.series);
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    expect(day(h4.t[fourHour!.to - 1] ?? 0)).toBe(
      day(d1.t[daily!.to - 1] ?? 0),
    );
  });
});

describe("1-4 where the volume went", () => {
  const level = need("1-4", "mark-bars");
  const series = load("SPY-1d");
  const slice = level.data[0]!;

  const ranked = Array.from(
    { length: slice.to - slice.from },
    (_, k) => slice.from + k,
  ).sort((a, b) => (series.v[b] ?? 0) - (series.v[a] ?? 0));

  it("targets the three genuinely highest-volume bars", () => {
    // This is the assertion the generic guards cannot make. Changing a target bar
    // to the wrong one passes every self-consistency check and fails here.
    const targets = level.target.marks
      .map((m) => barIndexOf(m))
      .filter((i): i is number => i !== null)
      .sort((a, b) => a - b);
    expect(targets).toEqual(ranked.slice(0, 3).sort((a, b) => a - b));
  });

  it("keeps the third-placed bar clearly above the fourth", () => {
    // A player cannot distinguish bars a few percent apart by eye, so a window
    // without separation would make the level unfair however correct its target.
    const third = series.v[ranked[2]!] ?? 0;
    const fourth = series.v[ranked[3]!] ?? 1;
    expect(third / fourth).toBeGreaterThan(1.3);
  });
});

describe("1-6 four clocks", () => {
  const level = need("1-6", "classify");

  function gapStats(sliceIndex: number) {
    const slice = level.data[sliceIndex]!;
    const series = load(slice.series);
    let gapped = 0;
    let biggest = 0;
    for (let i = slice.from + 1; i < slice.to; i += 1) {
      const previous = series.c[i - 1] ?? 1;
      const gap = Math.abs((series.o[i] ?? previous) - previous) / previous;
      if (gap > 0.005) gapped += 1;
      biggest = Math.max(biggest, gap);
    }
    return { gapped, biggest, bars: slice.to - slice.from - 1 };
  }

  it("shows a session market gapping on most days", () => {
    const spy = gapStats(0);
    expect(spy.gapped / spy.bars).toBeGreaterThan(0.6);
  });

  it("shows the 10.4% gap the prompt quotes", () => {
    expect(gapStats(0).biggest * 100).toBeCloseTo(10.4, 0);
  });

  it("shows a continuous market barely gapping at all", () => {
    // The contrast is the lesson. If crypto gapped here too, the level would be
    // teaching something false.
    const btc = gapStats(1);
    expect(btc.gapped).toBe(0);
    expect(btc.biggest).toBeLessThan(0.005);
  });
});

describe("1-7 the crash that never happened", () => {
  const level = need("1-7", "classify");
  const raw = load("AAPL-1d-raw");
  const adjusted = load("AAPL-1d");

  it("shows the 74.2% single-day fall the brief quotes", () => {
    let worst = 0;
    for (let i = 1; i < raw.c.length; i += 1) {
      worst = Math.min(worst, (raw.c[i] ?? 0) / (raw.c[i - 1] ?? 1) - 1);
    }
    expect(worst * 100).toBeCloseTo(-74.2, 0);
  });

  it("shows nothing of the kind in the adjusted series on the same day", () => {
    // The level claims the fall never happened. That is only true if the adjusted
    // series, covering the same sessions, is unremarkable.
    const byTime = new Map(adjusted.t.map((t, i) => [t, adjusted.c[i] ?? 0]));
    let worst = 0;
    for (let i = 1; i < raw.t.length; i += 1) {
      const now = byTime.get(raw.t[i] ?? 0);
      const previous = byTime.get(raw.t[i - 1] ?? 0);
      if (now === undefined || previous === undefined) continue;
      worst = Math.min(worst, now / previous - 1);
    }
    expect(worst).toBeGreaterThan(-0.2);
  });

  it("is the only level using the deliberately misleading series", () => {
    expect(level.data.every((s) => s.series === "AAPL-1d-raw")).toBe(true);
  });
});

describe("1-B coin flip", () => {
  const level = need("1-B", "predict-next");

  it("keeps every round's horizon inside its series", () => {
    // A round whose horizon runs off the end has no outcome, so it would silently
    // drop out of the accuracy the level exists to report.
    for (const slice of level.data) {
      const series = load(slice.series);
      expect(slice.to - 1 + level.config.horizon).toBeLessThan(series.t.length);
    }
  });

  it("spans more than one market", () => {
    expect(new Set(level.data.map((s) => s.series)).size).toBeGreaterThan(1);
  });

  it("reuses no window an earlier level in the chapter taught on", () => {
    // A recognised chart is no longer a coin flip.
    const earlier = ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7"]
      .map((id) => getLevel(id))
      .filter((l): l is AnyLevel => l !== undefined)
      .flatMap((l) => l.data);

    for (const round of level.data) {
      for (const taught of earlier) {
        if (taught.series !== round.series) continue;
        const overlaps = round.from < taught.to && taught.from < round.to;
        expect(
          overlaps,
          `round ${round.series} ${round.from}-${round.to} overlaps a taught window ${taught.from}-${taught.to}`,
        ).toBe(false);
      }
    }
  });
});
