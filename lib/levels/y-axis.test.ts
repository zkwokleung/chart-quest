import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_LEVELS } from "./content/all";
import { stepAsAnyLevel } from "./kinds/composite/steps";
import { Y_AXIS_EVERYWHERE_FROM, yAxisFor } from "./y-axis";

describe("who gets the y-axis control", () => {
  it("gives it to every Chapter 8 level and above", () => {
    for (const level of ALL_LEVELS) {
      if (level.chapter < Y_AXIS_EVERYWHERE_FROM) continue;
      expect(yAxisFor(level)?.toggle, level.id).toBe(true);
    }
  });

  it("gives it to no earlier level that had not already opted in", () => {
    // The regression that would be invisible in play: a resolver bug that switched the
    // control on for Chapter 1 would look like a feature rather than a mistake.
    for (const level of ALL_LEVELS) {
      if (level.chapter >= Y_AXIS_EVERYWHERE_FROM) continue;
      const resolved = yAxisFor(level);
      if (level.yAxis === undefined) {
        expect(resolved, `${level.id} gained a control it has not earned`).toBeUndefined();
      } else {
        expect(resolved?.toggle, level.id).toBe(true);
        expect(resolved?.mode, level.id).toBe(level.yAxis);
      }
    }
  });

  it("carries a boss's axis mode into its stages", () => {
    // `stepAsLevel` dropped `yAxis`, so 8.B opened on a price axis while its first stage asked
    // how big a typical day is as a share of price. Nothing failed; the chart just fell back to
    // the stored preference. Asserted here because a browser is an expensive place to find it.
    const boss = ALL_LEVELS.find((l) => l.id === "8-B");
    if (boss?.kind !== "composite") throw new Error("8-B should be a composite");
    expect(boss.yAxis).toBe("pct");
    for (const step of boss.config.steps) {
      const asLevel = stepAsAnyLevel(boss, step);
      expect(yAxisFor(asLevel)).toEqual({ mode: "pct", toggle: true });
    }
  });

  it("keeps 5.5 opening in ATR, which is the level the mode was built for", () => {
    const level = ALL_LEVELS.find((l) => l.id === "5-5")!;
    expect(yAxisFor(level)).toEqual({ mode: "atr", toggle: true });
  });

  it("leaves the opening mode to the chart when a Chapter 8 level states none", () => {
    // `mode: undefined` means "use the player's stored preference", which the chart supplies.
    // A saved setting decides the mode; it must never decide whether the control appears.
    expect(yAxisFor({ chapter: 8, yAxis: undefined })).toEqual({
      mode: undefined,
      toggle: true,
    });
    expect(yAxisFor({ chapter: 2, yAxis: undefined })).toBeUndefined();
  });
});

describe("every kind resolves it rather than passing a raw mode", () => {
  it("passes yAxis at every chart call site under lib/levels/kinds", () => {
    // A source-level check, in the style of `normalize.test.ts`. A new kind that renders a
    // chart without this prop would silently lose the Chapter 8 unlock, and nothing would
    // fail — the level would simply be missing a control that every other level has.
    const root = "lib/levels/kinds";
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        const source = readFileSync(path, "utf8");
        for (const tag of source.matchAll(/<(FeedChart|SliceChart)\b[\s\S]*?\/>/g)) {
          if (!tag[0].includes("yAxis=")) offenders.push(`${path}: <${tag[1]}`);
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });

  it("resolves through yAxisFor rather than reading level.yAxis directly", () => {
    // The rule lives in one place. A component reading `level.yAxis` straight would work
    // today and quietly skip the Chapter 8 unlock.
    const root = "lib/levels/kinds";
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        if (readFileSync(path, "utf8").includes("yAxis={level.yAxis}")) {
          offenders.push(path);
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});
