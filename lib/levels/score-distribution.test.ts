import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { ALL_LEVELS } from "./content/all";
import { gradeAny, perfectAttemptFor } from "./kinds";
import type { AnyLevel, Attempt, LevelKind, Mark } from "./schema";

/**
 * Scores a systematic set of near-miss attempts on every level.
 *
 * **This measures the grader, not the player.** It cannot tell you what humans
 * score, only what shape a grader has: whether a one-bar miss falls off a cliff,
 * whether anything can reach three stars, whether everything does. Real calibration
 * needs play data, and issue #32 stays open for it.
 *
 * What it is genuinely good for is finding graders that are broken in ways no single
 * test would catch — a level where the best reachable score is 0.55, or where every
 * perturbation still scores three stars, means the thresholds are describing
 * something other than skill.
 *
 * It runs as a test rather than a script for two reasons: the app's import graph
 * has no file extensions, so bare node cannot load it — and more to the point, a
 * mis-shaped grader should fail CI rather than print a table nobody reads. Set
 * `SHOW_DISTRIBUTION=1` to see the whole ladder.
 *
 * **Not every kind is probed, and the omissions are deliberate.** `predict-next`
 * scores participation rather than accuracy, so a perturbation would only re-test
 * the thing its own grader test already pins down; `composite` is covered through
 * the kinds its stages are made of. What is probed is `mark-bars`, `classify`,
 * `annotate`, `tune-param` and `replay-trade` — every kind whose score is a
 * continuous function of how close the player got.
 */

const SERIES_DIR = "public/data/series";
const cache = new Map<string, Series<string>>();

function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join(SERIES_DIR, `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

type Probe = { label: string; attempt: Attempt[LevelKind] };

/**
 * Degradations of the perfect attempt, from "very nearly right" downwards.
 *
 * Deliberately mechanical. The point is a comparable ladder across levels of the
 * same kind, not a simulation of how a person gets something wrong.
 */
function probesFor(level: AnyLevel, data: Series<string>[]): Probe[] {
  const perfect = perfectAttemptFor(level, data);
  const probes: Probe[] = [{ label: "perfect", attempt: perfect }];

  if (perfect.kind === "mark-bars") {
    const shift = (by: number): Attempt["mark-bars"] => ({
      ...perfect,
      marks: perfect.marks.map((mark) =>
        mark.startsWith("bar:")
          ? (`bar:${Number(mark.slice(4)) + by}` as Mark)
          : mark,
      ),
    });
    probes.push(
      { label: "1 bar off", attempt: shift(1) },
      { label: "3 bars off", attempt: shift(3) },
      { label: "10 bars off", attempt: shift(10) },
      {
        label: "one missing",
        attempt: { ...perfect, marks: perfect.marks.slice(1) },
      },
      {
        label: "one extra",
        attempt: {
          ...perfect,
          marks: [...perfect.marks, `bar:${level.data[0]?.from ?? 0}` as Mark],
        },
      },
    );
  }

  if (perfect.kind === "classify" && level.kind === "classify") {
    const wrong = level.config.options
      .map((o) => o.id)
      .filter((id) => !level.target.correct.includes(id));
    if (wrong[0]) {
      probes.push({
        label: "one wrong option",
        attempt: { ...perfect, selected: [wrong[0]] },
      });
    }
    if (perfect.selected.length > 1) {
      probes.push({
        label: "one of several missed",
        attempt: { ...perfect, selected: perfect.selected.slice(1) },
      });
    }
  }

  if (perfect.kind === "tune-param" && level.kind === "tune-param") {
    const { min, max, step } = level.config;
    const nudge = (by: number): Attempt["tune-param"] => ({
      ...perfect,
      value: Math.min(max, Math.max(min, perfect.value + by)),
    });
    if (level.config.scoring === "exploration") {
      // Nudging the value proves nothing on an exploration level — it is designed
      // not to care where the slider stops. The degradation that matters is having
      // looked at less of the range, and probing the wrong thing here made 5-1 look
      // like a level that could not tell a good answer from a bad one.
      const span = max - min;
      probes.push(
        {
          label: "half the range",
          attempt: { ...perfect, visited: [min, min + span * 0.5] },
        },
        {
          label: "a tenth of the range",
          attempt: { ...perfect, visited: [min, min + span * 0.1] },
        },
        { label: "never moved", attempt: { ...perfect, visited: [min] } },
      );
    } else {
      probes.push(
        { label: "1 step off", attempt: nudge(step) },
        { label: "4 steps off", attempt: nudge(step * 4) },
        { label: "10 steps off", attempt: nudge(step * 10) },
      );
    }
  }

  if (perfect.kind === "annotate" && perfect.drawing) {
    const slice = level.data[0];
    const s0 = series(slice?.series ?? "");
    const span =
      slice === undefined
        ? 0
        : Math.max(...s0.h.slice(slice.from, slice.to)) -
          Math.min(...s0.l.slice(slice.from, slice.to));
    const lift = (by: number): Attempt["annotate"] => {
      const drawing = perfect.drawing;
      if (!drawing) return perfect;
      const shifted =
        drawing.shape === "level"
          ? { ...drawing, price: drawing.price + by }
          : drawing.shape === "zone"
            ? { ...drawing, top: drawing.top + by, bottom: drawing.bottom + by }
            : {
                ...drawing,
                a: { ...drawing.a, price: drawing.a.price + by },
                b: { ...drawing.b, price: drawing.b.price + by },
              };
      return { ...perfect, drawing: shifted };
    };
    probes.push(
      { label: "lifted 2% of range", attempt: lift(span * 0.02) },
      { label: "lifted 10% of range", attempt: lift(span * 0.1) },
      { label: "lifted 40% of range", attempt: lift(span * 0.4) },
    );
  }

  if (perfect.kind === "replay-trade" && level.kind === "replay-trade") {
    const entry = series(level.data[0]?.series ?? "").c[perfect.entryBar] ?? 0;
    const risk = entry - perfect.stop;
    probes.push(
      {
        label: "stop 20% tighter",
        attempt: { ...perfect, stop: perfect.stop + risk * 0.2 },
      },
      {
        label: "stop halved",
        attempt: { ...perfect, stop: perfect.stop + risk * 0.5 },
      },
      { label: "no target", attempt: { ...perfect, target: null } },
      {
        label: "entered 3 bars late",
        attempt: { ...perfect, entryBar: perfect.entryBar + 3 },
      },
    );
  }

  return probes;
}

type Row = {
  id: string;
  kind: string;
  results: { label: string; score: number; stars: number }[];
};

const rows: Row[] = ALL_LEVELS.map((level) => {
  const data = level.data.map((slice) => series(slice.series));
  return {
    id: level.id,
    kind: level.kind,
    results: probesFor(level, data).map((probe) => {
      const grade = gradeAny(level, probe.attempt, data);
      return { label: probe.label, score: grade.score, stars: grade.stars };
    }),
  };
});

if (process.env["SHOW_DISTRIBUTION"]) {
  for (const row of rows) {
    for (const [i, r] of row.results.entries()) {
      console.log(
        `${(i === 0 ? row.id : "").padEnd(6)} ${(i === 0 ? row.kind : "").padEnd(14)} ` +
          `${r.label.padEnd(20)} ${r.score.toFixed(2).padStart(5)}  ${"*".repeat(r.stars)}`,
      );
    }
  }
}

const probed = rows.filter((row) => row.results.length > 1);

describe("the score distribution", () => {
  it("probes more than one attempt per level, or it is measuring nothing", () => {
    expect(probed.length).toBeGreaterThan(ALL_LEVELS.length / 2);
  });

  it.each(probed.map((r) => [r.id, r] as const))(
    "%s discriminates between a right answer and a wrong one",
    (_id, row) => {
      // Every perturbation still scoring three stars means the thresholds describe
      // something other than skill. No per-level test can see this: each level's own
      // guard only ever checks the perfect attempt.
      const worst = Math.min(...row.results.map((r) => r.stars));
      expect(worst).toBeLessThan(3);
    },
  );

  it.each(
    rows
      .map(
        (row) =>
          [
            row.id,
            row.results.find((r) => /^1 (bar|step) off$/.test(r.label)),
          ] as const,
      )
      .filter(([, probe]) => probe !== undefined),
  )("%s keeps partial credit for a single-unit miss", (_id, probe) => {
    // F1 drops steeply on mark-bars, so the one-star gate matters more there than
    // anywhere else — #32 names it as the thing to watch, and this is the watch.
    //
    // Two stars rather than one is the target, but the assertion is the weaker
    // "not zero", because a uniform one-bar shift is a substantial error on a level
    // whose three targets are *adjacent* bars: 1-4 asks for the three
    // highest-volume days and they fall on 2677, 2678 and 2679, so moving all three
    // leaves only two overlapping. Demanding two stars there would be demanding the
    // grader ignore a real mistake.
    expect(probe?.stars ?? 0).toBeGreaterThanOrEqual(1);
  });
});
