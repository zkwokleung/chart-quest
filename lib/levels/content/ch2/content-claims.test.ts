import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { findSwings, readStructure, swingHighs } from "@/lib/ta/swings";
import { gradeAnnotate } from "../../kinds/annotate/grade";
import { barIndexOf } from "../../mark";
import { getLevel } from "../../registry";
import type { AnyLevel, Level } from "../../schema";

/**
 * Checks what Chapter 2's levels *claim* against what the data *shows*.
 *
 * The generic guards prove a level is winnable but derive the perfect attempt from
 * the target, so they cannot tell a right answer from a confidently wrong one.
 * These can. In Chapter 1 the same discipline caught two real bugs; here it caught
 * an invented reference line for 2.4.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
}

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getLevel(id);
  if (!level || level.kind !== kind) throw new Error(`${id} is not a ${kind} level`);
  return level as unknown as Level<K>;
}

const btc = load("BTCUSDT-1d");

describe("2-1 swing highs", () => {
  const level = need("2-1", "mark-bars");
  const slice = level.data[0]!;

  it("targets bars that really are fractal swing highs", () => {
    // The assertion the generic guards cannot make: a target naming the wrong bar
    // passes every self-consistency check.
    const detected = new Set(
      swingHighs(btc, { from: slice.from, to: slice.to }, 5).map((s) => s.bar),
    );
    for (const mark of level.target.marks) {
      const bar = barIndexOf(mark);
      expect(bar).not.toBeNull();
      expect(detected.has(bar ?? -1), `bar ${bar} is not a swing high`).toBe(true);
    }
  });

  it("keeps them far enough apart to be told apart by eye", () => {
    const bars = level.target.marks
      .map((m) => barIndexOf(m))
      .filter((b): b is number => b !== null)
      .sort((a, b) => a - b);
    for (let i = 1; i < bars.length; i += 1) {
      expect((bars[i] ?? 0) - (bars[i - 1] ?? 0)).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("2-2 structure across four charts", () => {
  const level = need("2-2", "classify");

  it("shows exactly one downtrend, so the question has one answer", () => {
    const structures = level.data.map((s) =>
      readStructure(findSwings(btc, { from: s.from, to: s.to }, 3)),
    );
    expect(structures.filter((s) => s === "downtrend")).toHaveLength(1);
  });

  it("marks the downtrend as the correct option", () => {
    const structures = level.data.map((s) =>
      readStructure(findSwings(btc, { from: s.from, to: s.to }, 3)),
    );
    const answerIndex = level.config.options.findIndex(
      (o) => o.id === level.target.correct[0],
    );
    expect(structures[answerIndex]).toBe("downtrend");
  });

  it("includes at least one genuine uptrend among the distractors", () => {
    // Otherwise "the only trend" and "the only downtrend" would be the same
    // question, and the level would not teach the distinction.
    const structures = level.data.map((s) =>
      readStructure(findSwings(btc, { from: s.from, to: s.to }, 3)),
    );
    expect(structures).toContain("uptrend");
  });
});

describe("2-3 the trendline window", () => {
  const level = need("2-3", "annotate");

  it("gives the reference full marks by the grader's own measure", () => {
    const grade = gradeAnnotate(
      { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 },
      level,
      [btc],
    );
    expect(grade.detail?.["body cuts"]).toBe(0);
    expect(grade.stars).toBe(3);
  });

  it("anchors the reference on actual lows", () => {
    const ref = level.target.reference;
    if (ref.shape !== "trendline") throw new Error("expected a trendline");
    for (const anchor of [ref.a, ref.b]) {
      expect(anchor.price).toBeCloseTo(btc.l[anchor.bar] ?? 0, 6);
    }
  });

  it("is a range, not the uptrend the plan assumed", () => {
    // Recorded so a future edit cannot quietly reintroduce the wrong description:
    // the swing highs here run 9950 → 10380 → 9993 → 9589 → 9292, only 63% rising.
    // The floor lifts while the ceiling does not, which is why the support line is
    // worth drawing at all.
    const slice = level.data[0]!;
    expect(readStructure(findSwings(btc, { from: slice.from, to: slice.to }, 3))).toBe(
      "range",
    );
    expect(level.brief.toLowerCase()).not.toContain("uptrend");
  });
});

describe("2-4 the resistance line", () => {
  const level = need("2-4", "annotate");

  it("gives the reference full marks by the grader's own measure", () => {
    // This test caught an invented reference: the originally authored anchors were
    // read off a swing-high listing rather than measured, and scored one star.
    const grade = gradeAnnotate(
      { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 },
      level,
      [btc],
    );
    expect(grade.detail?.["body cuts"]).toBe(0);
    expect(grade.stars).toBe(3);
  });

  it("anchors the reference on actual highs", () => {
    const ref = level.target.reference;
    if (ref.shape !== "trendline") throw new Error("expected a trendline");
    for (const anchor of [ref.a, ref.b]) {
      expect(anchor.price).toBeCloseTo(btc.h[anchor.bar] ?? 0, 6);
    }
  });

  it("really falls while 2-3's line rises, so the shape contracts", () => {
    // The level claims this is a triangle rather than a channel. That is only true
    // if the two lines converge — and it is why a channel could not be authored
    // here: no parallel offset catches a single high.
    const resistance = level.target.reference;
    const support = need("2-3", "annotate").target.reference;
    if (resistance.shape !== "trendline" || support.shape !== "trendline") {
      throw new Error("expected trendlines");
    }
    const slope = (d: typeof resistance) =>
      (d.b.price - d.a.price) / (d.b.bar - d.a.bar);
    expect(slope(resistance)).toBeLessThan(0);
    expect(slope(support)).toBeGreaterThan(0);
  });
});

describe("2-5 break versus deviation", () => {
  const level = need("2-5", "mark-bars");

  it("targets a close beyond a prior swing low that was never reclaimed", () => {
    const bar = barIndexOf(level.target.marks[0]!);
    expect(bar).not.toBeNull();
    if (bar === null) return;

    const slice = level.data[0]!;
    const priorLows = findSwings(btc, { from: slice.from, to: bar }, 3)
      .filter((s) => s.kind === "low")
      .map((s) => s.price);
    const broken = priorLows.filter((low) => (btc.c[bar] ?? 0) < low);
    expect(broken.length).toBeGreaterThan(0);

    // And it stayed broken, which is what makes it a break rather than a probe.
    const level_ = Math.max(...broken);
    for (let i = bar + 1; i < Math.min(bar + 6, slice.to); i += 1) {
      expect(btc.c[i] ?? 0).toBeLessThan(level_);
    }
  });

  it("contains a more dramatic dip that recovered, as the trap", () => {
    // Without a false break nearby the level is trivial. Bar 152 fell from 13,540
    // to 10,900 and was back above 11,400 within four days.
    const dramatic = 152;
    const priorLow = 11400;
    expect(btc.c[dramatic] ?? 0).toBeLessThan(priorLow);
    const recovered = [153, 154, 155, 156].some((i) => (btc.c[i] ?? 0) > priorLow);
    expect(recovered).toBe(true);
    // And it is the bigger move of the two, so it is genuinely the tempting answer.
    const target = barIndexOf(level.target.marks[0]!) ?? 0;
    const drop = (i: number) =>
      Math.abs(((btc.c[i] ?? 0) - (btc.c[i - 1] ?? 1)) / (btc.c[i - 1] ?? 1));
    expect(drop(dramatic)).toBeGreaterThan(drop(target));
  });
});

describe("2-6 the range", () => {
  const level = need("2-6", "annotate");

  it("gives the reference full marks by the grader's own measure", () => {
    const grade = gradeAnnotate(
      { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 },
      level,
      [btc],
    );
    expect(grade.stars).toBe(3);
  });

  it("bounds a window that really ranges rather than trends", () => {
    const slice = level.data[0]!;
    const span =
      Math.max(...btc.h.slice(slice.from, slice.to)) -
      Math.min(...btc.l.slice(slice.from, slice.to));
    const drift = Math.abs(
      (btc.c[slice.to - 1] ?? 0) - (btc.c[slice.from] ?? 0),
    );
    // Ends within a tenth of its own height of where it began.
    expect(drift / span).toBeLessThan(0.15);
  });

  it("insets its bounds inside the extremes, where price actually turned", () => {
    // Bounds drawn exactly on the extremes catch two touches each — an extreme is
    // reached once by definition. The authored bounds sit inside them.
    const ref = level.target.reference;
    if (ref.shape !== "zone") throw new Error("expected a zone");
    const slice = level.data[0]!;
    const high = Math.max(...btc.h.slice(slice.from, slice.to));
    const low = Math.min(...btc.l.slice(slice.from, slice.to));
    expect(ref.top).toBeLessThan(high);
    expect(ref.bottom).toBeGreaterThan(low);
  });
});

describe("2-B the boss", () => {
  const level = need("2-B", "composite");
  const eur = load("EURUSD-1d");

  it("runs on a market no Chapter 2 level taught on", () => {
    // The cross-asset transfer guarantee, live for the first time: Chapter 1 is
    // exempt by design, so this is the first boss the rule can actually check.
    const taught = new Set(
      ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6"]
        .map((id) => getLevel(id))
        .filter((l): l is AnyLevel => l !== undefined)
        .flatMap((l) => l.data.map((d) => d.series)),
    );
    expect(taught.has("BTCUSDT-1d")).toBe(true);
    for (const slice of level.data) {
      expect(taught.has(slice.series)).toBe(false);
    }
  });

  it("weights the participation-scored stage lightest", () => {
    // predict-next cannot really be failed, so an equal share would hand over free
    // marks and lower the bar for the stages being tested.
    const predict = level.config.steps.find((s) => s.kind === "predict-next");
    expect(predict).toBeDefined();
    for (const step of level.config.steps) {
      if (step.kind === "predict-next") continue;
      expect(step.weight).toBeGreaterThan(predict?.weight ?? 1);
    }
  });

  it("targets real swing highs in its first stage", () => {
    const step = level.config.steps.find((s) => s.kind === "mark-bars");
    if (!step || step.kind !== "mark-bars") throw new Error("missing stage");
    const slice = level.data[0]!;
    const detected = new Set(
      swingHighs(eur, { from: slice.from, to: slice.to }, 5).map((s) => s.bar),
    );
    for (const mark of step.target.marks) {
      expect(detected.has(barIndexOf(mark) ?? -1)).toBe(true);
    }
  });

  it("anchors its trendline stage on real lows, with no body cuts", () => {
    const step = level.config.steps.find((s) => s.kind === "annotate");
    if (!step || step.kind !== "annotate") throw new Error("missing stage");
    const ref = step.target.reference;
    if (ref.shape !== "trendline") throw new Error("expected a trendline");
    for (const anchor of [ref.a, ref.b]) {
      expect(anchor.price).toBeCloseTo(eur.l[anchor.bar] ?? 0, 6);
    }
  });

  it("really is the uptrend its classify stage claims", () => {
    const slice = level.data[0]!;
    expect(readStructure(findSwings(eur, { from: slice.from, to: slice.to }, 3))).toBe(
      "uptrend",
    );
  });

  it("leaves room for the predict stage's horizon", () => {
    const step = level.config.steps.find((s) => s.kind === "predict-next");
    if (!step || step.kind !== "predict-next") throw new Error("missing stage");
    const slice = (step.data ?? level.data)[0]!;
    expect(slice.to - 1 + step.config.horizon).toBeLessThan(eur.t.length);
    // And the revealed bars stay inside the window the boss shows.
    expect(slice.to - 1 + step.config.horizon).toBeLessThanOrEqual(
      level.data[0]!.to,
    );
  });
});
