import { describe, expect, it } from "vitest";
import {
  exportSave,
  exportedAtOf,
  importSave,
  summarise,
} from "./transfer";
import {
  initialPersisted,
  SCHEMA_VERSION,
  type JournalEntry,
  type Persisted,
} from "./schema";

/**
 * The only untrusted input in the project, and the one place a bug costs a player everything.
 *
 * **What these tests are really guarding.** `migratePersisted` merges anything object-shaped against
 * `initialPersisted`, so routing an import through it would make a garbage file *import successfully*
 * as an empty save — the feature that exists to protect a player's only copy would be the thing that
 * deleted it. Most of what follows is therefore about refusals: every case below is a file that must
 * not be accepted, and the assertion is that it is rejected *with a reason*.
 *
 * A rejection without a reason is nearly as bad, because "import failed" and "your save is now empty"
 * are indistinguishable to someone who has just lost ten chapters.
 */

const AT = "2026-08-04T12:00:00.000Z";

const trade: JournalEntry = {
  id: "j1",
  levelId: "3-B",
  seriesId: "BTCUSDT-4h",
  assetClass: "crypto-spot",
  entry: 100,
  stop: 95,
  target: 110,
  exit: 110,
  r: 2,
  reason: "pullback into the level that broke",
  tags: ["long"],
  at: AT,
  attemptNo: 1,
  planned: true,
  setup: "continuation",
};

/** A save with something in every collection, so a round trip has something to lose. */
function populated(): Persisted {
  return {
    profile: {
      xp: 120,
      streak: 3,
      lastPlayed: AT,
      settings: { reducedMotion: true, yAxisMode: "atr" },
    },
    progress: {
      "1-1": { stars: 3, bestScore: 1, attempts: 2, completedAt: AT },
      "1-B": { stars: 2, bestScore: 0.8, attempts: 4, completedAt: AT },
      "2-1": { stars: 0, bestScore: 0.1, attempts: 1, completedAt: null },
    },
    journal: [trade, { ...trade, id: "j2", r: null, exit: null }],
    strategies: [
      { id: "s1", name: "Dip in an uptrend", blocks: [{ kind: "compare" }], lastResult: null },
    ],
    predictions: { "1-B": { right: "5 of 5", accuracy: 100 } },
  };
}

/** A valid file, with one field replaced — the shape most of these cases need. */
function fileWith(patch: Record<string, unknown>): string {
  const base = JSON.parse(exportSave(populated(), AT)) as Record<string, unknown>;
  return JSON.stringify({ ...base, ...patch });
}

function stateWith(patch: Record<string, unknown>): string {
  const base = JSON.parse(exportSave(populated(), AT)) as Record<string, unknown>;
  const state = base.state as Record<string, unknown>;
  return JSON.stringify({ ...base, state: { ...state, ...patch } });
}

describe("a round trip", () => {
  it("returns exactly what it was given", () => {
    const before = populated();
    const result = importSave(exportSave(before, AT));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(before);
  });

  it("survives an empty save, which is what a new player has", () => {
    const result = importSave(exportSave(initialPersisted, AT));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(initialPersisted);
  });

  it("writes a file a person can read, and stamps when it was made", () => {
    const text = exportSave(populated(), AT);
    // Pretty-printed on purpose: this is the player's only view of what the game holds about them.
    expect(text).toContain("\n  ");
    expect(text.endsWith("\n")).toBe(true);
    expect(exportedAtOf(text)).toBe(AT);
    expect(JSON.parse(text)).toMatchObject({ app: "chart-quest", schema: SCHEMA_VERSION });
  });
});

describe("refusals", () => {
  /** Every rejection has to name what was wrong. "Import failed" is not a message. */
  function reject(text: string, matching: RegExp) {
    const result = importSave(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(matching);
      expect(result.error.length).toBeGreaterThan(20);
    }
  }

  it("refuses text that is not JSON", () => {
    reject("this is not a save", /not valid JSON/i);
    reject("", /not valid JSON/i);
  });

  it("refuses truncated JSON, which is what a failed download looks like", () => {
    const whole = exportSave(populated(), AT);
    reject(whole.slice(0, whole.length / 2), /not valid JSON/i);
  });

  it("refuses another application's save, and says whose it is", () => {
    reject(
      JSON.stringify({ app: "some-other-game", schema: 1, state: {} }),
      /from "some-other-game"/,
    );
  });

  it("refuses a JSON file that is not a save at all", () => {
    // The realistic version of this is a `package.json` or an exported chart, picked by mistake.
    reject(JSON.stringify({ name: "my-project", version: "1.0.0" }), /missing the marker/i);
    reject(JSON.stringify([1, 2, 3]), /does not contain a save/i);
    reject("null", /does not contain a save/i);
  });

  it("refuses a save from a newer version rather than guessing at it", () => {
    reject(fileWith({ schema: SCHEMA_VERSION + 1 }), /newer version/i);
  });

  it("refuses a save with no version, because there is no way to read it safely", () => {
    reject(fileWith({ schema: undefined }), /which version/i);
    reject(fileWith({ schema: "1" }), /which version/i);
  });

  it("refuses a progress map that is an array", () => {
    // **The case that motivates checking rather than merging.** `withDefaults` accepts this happily,
    // and `Object.entries` would then produce "0", "1" as level ids — every chapter locked, silently.
    reject(stateWith({ progress: [] }), /level progress is the wrong shape/i);
  });

  it("refuses a level entry that is not readable, and names the level", () => {
    reject(
      stateWith({ progress: { "4-2": { stars: "three", bestScore: 1, attempts: 1 } } }),
      /entry for level 4-2/,
    );
    reject(
      stateWith({ progress: { "4-2": { stars: 9, bestScore: 1, attempts: 1, completedAt: null } } }),
      /entry for level 4-2/,
    );
  });

  it("refuses a trade whose R is a string, and names which trade", () => {
    // `statsFor` maps `r` straight into arithmetic, so a string would surface as a NaN expectancy
    // shown to the player as though it were measured.
    reject(
      stateWith({ journal: [trade, { ...trade, r: "2" }] }),
      /trade number 2 is not readable/,
    );
  });

  it("refuses a trade with a non-finite number, which JSON round-trips as null anyway", () => {
    reject(stateWith({ journal: [{ ...trade, entry: "100" }] }), /trade number 1/);
  });

  it("refuses collections that are the wrong shape", () => {
    reject(stateWith({ journal: {} }), /journal is the wrong shape/i);
    reject(stateWith({ strategies: {} }), /strategies are the wrong shape/i);
    reject(stateWith({ predictions: [] }), /recalled answers are the wrong shape/i);
    reject(stateWith({ strategies: [{ name: "no id" }] }), /strategy number 1/);
  });

  it("refuses a file with no state", () => {
    reject(fileWith({ state: undefined }), /no progress in it/i);
    reject(fileWith({ state: "nope" }), /no progress in it/i);
  });
});

describe("what leniency remains, and where", () => {
  it("fills fields an older save predates rather than refusing it", () => {
    // The one thing `migratePersisted` is for, and it runs *after* validation. A save written before
    // M9 has no `strategies` and no `settings.yAxisMode`; that is age, not corruption.
    const old = JSON.stringify({
      app: "chart-quest",
      schema: 1,
      exportedAt: AT,
      state: {
        profile: { xp: 5, streak: 1, lastPlayed: AT, settings: { reducedMotion: false } },
        progress: { "1-1": { stars: 1, bestScore: 0.6, attempts: 1, completedAt: null } },
        journal: [],
        strategies: [],
      },
    });
    const result = importSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.profile.settings.yAxisMode).toBe("price");
    expect(result.state.predictions).toEqual({});
    expect(result.state.progress["1-1"]?.stars).toBe(1);
  });

  it("accepts a journal entry with an unresolved R, because that is a real state", () => {
    const result = importSave(stateWith({ journal: [{ ...trade, r: null, exit: null }] }));
    expect(result.ok).toBe(true);
  });

  it("does not care what a strategy's blocks contain", () => {
    // `SavedStrategy.blocks` is `unknown` in the schema so the store stays free of `lib/backtest`.
    // Validating it here would import the block model into every route that touches the store.
    const result = importSave(
      stateWith({ strategies: [{ id: "s", name: "n", blocks: "anything", lastResult: 42 }] }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("the summary shown before replacing a save", () => {
  it("counts what a player would want to check before overwriting", () => {
    const summary = summarise(populated(), AT);
    expect(summary).toEqual({
      exportedAt: AT,
      levelsPlayed: 3,
      // Bosses at two stars or better — the same bar `isChapterUnlocked` uses.
      chaptersCleared: 1,
      totalStars: 5,
      trades: 2,
      strategies: 1,
    });
  });

  it("reports an empty save as empty rather than as nothing", () => {
    const summary = summarise(initialPersisted, null);
    expect(summary).toMatchObject({
      levelsPlayed: 0,
      chaptersCleared: 0,
      totalStars: 0,
      trades: 0,
    });
  });

  it("does not count a level opened but never attempted", () => {
    const state = {
      ...initialPersisted,
      progress: { "1-1": { stars: 0, bestScore: 0, attempts: 0, completedAt: null } },
    } as Persisted;
    expect(summarise(state, null).levelsPlayed).toBe(0);
  });
});
