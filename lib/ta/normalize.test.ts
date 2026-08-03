import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { ALL_LEVELS } from "@/lib/levels/content/all";
import { gradeAny, perfectAttemptFor } from "@/lib/levels/kinds";
import {
  formatMode,
  toAtrUnits,
  toMode,
  toPct,
  type YAxisMode,
} from "./normalize";

/**
 * The y-axis mode is presentation, never scoring.
 *
 * This is the invariant the whole normalization feature rests on. If a mode could
 * move a score, `priceFracOfRange` would silently mean three different things
 * depending on a toggle the player controls, and a tolerance authored while looking
 * at a percent axis would behave differently for someone who left it on price.
 *
 * The guarantee is structural rather than careful: `Chart.tsx` applies the mode as a
 * label formatter and nothing else, so the series keeps raw prices and every grader
 * carries on in the units it was written for. These tests pin that down from both
 * ends — the transforms are affine, and grading a real attempt in all three modes
 * gives the same `Grade`.
 */

const MODES: YAxisMode[] = ["price", "pct", "atr"];

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(`public/data/series/${id}.json`, "utf8"),
  ) as Series<string>;
}

const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = load(id);
  cache.set(id, loaded);
  return loaded;
}

describe("grading is independent of the y-axis mode", () => {
  it("every authored level grades identically in all three modes", () => {
    // The mode never reaches a grader, so this passes by construction today. It is
    // here to fail loudly the moment someone implements a mode by transforming the
    // series instead of relabelling the axis — which is the obvious way to do it and
    // the one that would break every tolerance in the game.
    for (const level of ALL_LEVELS) {
      const data = level.data.map((slice) => series(slice.series));
      const attempt = perfectAttemptFor(level, data);

      const grades = MODES.map(() => gradeAny(level, attempt, data));
      const [first] = grades;
      for (const grade of grades) {
        expect(grade.score, `${level.id}`).toBe(first?.score);
        expect(grade.stars, `${level.id}`).toBe(first?.stars);
      }
    }
  });
});

describe("the mode reaches the axis and nothing else", () => {
  it("is applied as a label formatter, not by transforming the series", () => {
    // The test above passes by construction today, because the mode never reaches a
    // grader — so on its own it proves nothing. This is the half with teeth: it
    // pins down *how* the mode is applied. Transforming the data is the obvious
    // implementation and the one that would break every tolerance in the game, and
    // it would not fail a single grader test, because the graders would still be
    // internally consistent — just consistently measuring the wrong thing.
    const source = readFileSync("components/chart/Chart.tsx", "utf8");
    const uses = source
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(
        ([, line]) =>
          line.includes("yAxisMode") && !line.trimStart().startsWith("*"),
      );

    // The prop, its default, the formatter call, and the effect's dependency.
    expect(uses.length).toBeLessThanOrEqual(5);

    // A custom `priceFormat` on the price series, not `chart.localization`. It was the latter
    // until M8, which relabelled *every* pane and made 8.B's volume axis read
    // "+1036269330.1%" — a share count run through percent-from-anchor. Either mechanism keeps
    // the data untouched, so what this pins is that the mode is still a *formatter* at all.
    expect(source).toMatch(/priceFormat:\s*\{/);
    expect(source).toContain("formatter: (price: number)");
    expect(
      source,
      "the mode must not go back to chart-wide localization, which relabels volume too",
    ).not.toContain("localization: {");

    // The data path must not know about it.
    expect(source).not.toMatch(/toCandlestickData\([^)]*yAxisMode/);
    expect(source).not.toMatch(/toLineData\([^)]*yAxisMode/);
    expect(source).not.toMatch(/toCloseLineData\([^)]*yAxisMode/);
  });
});

describe("the transforms are affine, which is what makes relabelling exact", () => {
  const spy = series("SPY-1d");
  const anchor = 3000;

  it("preserves order, so the axis cannot be non-monotonic", () => {
    for (const mode of MODES) {
      let previous = -Infinity;
      for (const price of [100, 200, 300, 400, 500]) {
        const value = toMode(price, mode, spy, anchor) ?? 0;
        expect(value, `${mode} at ${price}`).toBeGreaterThan(previous);
        previous = value;
      }
    }
  });

  it("keeps equal price gaps equal in the converted units", () => {
    // The property that lets a linear axis be relabelled rather than rescaled: a
    // constant step in price is a constant step in the mode's units.
    for (const mode of MODES) {
      const at = (price: number) => toMode(price, mode, spy, anchor) ?? 0;
      const firstGap = at(200) - at(100);
      const secondGap = at(300) - at(200);
      expect(secondGap, mode).toBeCloseTo(firstGap, 9);
    }
  });

  it("agrees with the series-wide transforms", () => {
    const pct = toPct(spy, anchor);
    const atrUnits = toAtrUnits(spy, anchor, 14);
    for (const bar of [3010, 3100, 3400]) {
      const close = spy.c[bar]!;
      expect(toMode(close, "pct", spy, anchor)).toBeCloseTo(pct[bar] ?? 0, 9);
      expect(toMode(close, "atr", spy, anchor, 14)).toBeCloseTo(
        atrUnits[bar] ?? 0,
        9,
      );
    }
  });

  it("is the identity in price mode", () => {
    expect(toMode(123.45, "price", spy, anchor)).toBe(123.45);
  });
});

describe("formatting", () => {
  it("signs percent and ATR so a reader knows which side of the anchor they are on", () => {
    expect(formatMode(12.3, "pct")).toBe("+12.3%");
    expect(formatMode(-4.5, "pct")).toBe("-4.5%");
    expect(formatMode(2.5, "atr")).toBe("+2.50×");
  });

  it("leaves price unsigned, because a price is not a change", () => {
    expect(formatMode(402.31, "price")).toBe("402.31");
  });
});

describe("what the modes are for", () => {
  it("makes the same 3% day ordinary on one market and extreme on another", () => {
    // 5.5's claim, and the reason the ATR mode exists at all. Stated in a market's
    // own units, "a 3% day" is a different event on each of them.
    const share = (id: string) => {
      const s = series(id);
      let over = 0;
      let counted = 0;
      for (let i = 20; i < s.t.length; i += 1) {
        const units = atrShare(s, i);
        if (units <= 0) continue;
        counted += 1;
        if (units > 3) over += 1;
      }
      return over / counted;
    };
    expect(share("BTCUSDT-1d")).toBeGreaterThan(0.8);
    expect(share("SPY-1d")).toBeLessThan(0.1);
    expect(share("EURUSD-1d")).toBeLessThan(0.02);
  });
});

function atrShare(s: Series<string>, index: number): number {
  const period = 14;
  if (index - period + 1 < 0) return 0;
  let total = 0;
  for (let k = index - period + 1; k <= index; k += 1) {
    const prev = s.c[k - 1] ?? s.c[k] ?? 0;
    total += Math.max(
      (s.h[k] ?? 0) - (s.l[k] ?? 0),
      Math.abs((s.h[k] ?? 0) - prev),
      Math.abs((s.l[k] ?? 0) - prev),
    );
  }
  return (total / period / (s.c[index] ?? 1)) * 100;
}
