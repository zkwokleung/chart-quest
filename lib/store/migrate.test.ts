import { describe, expect, it } from "vitest";
import { migratePersisted } from "./migrate";
import { initialPersisted, SCHEMA_VERSION } from "./schema";

describe("migratePersisted", () => {
  it("returns defaults for corrupt payloads", () => {
    for (const corrupt of [null, undefined, "not-an-object", 42, []]) {
      const result = migratePersisted(corrupt, 0);
      expect(result.profile.xp).toBe(0);
      expect(result.progress).toEqual({});
      expect(result.journal).toEqual([]);
    }
  });

  it("preserves stored progress and xp", () => {
    const result = migratePersisted(
      {
        profile: { xp: 260, streak: 4, lastPlayed: "2026-01-01T00:00:00.000Z" },
        progress: { "1-1": { stars: 3, bestScore: 0.94, attempts: 2, completedAt: null } },
      },
      SCHEMA_VERSION,
    );

    expect(result.profile.xp).toBe(260);
    expect(result.profile.streak).toBe(4);
    expect(result.progress["1-1"]?.stars).toBe(3);
  });

  it("fills in settings a truncated payload is missing", () => {
    // A payload written by an older build won't have keys added since. Those
    // must arrive as defaults rather than undefined, or selectors reading
    // settings.yAxisMode crash on a real player's saved game.
    const result = migratePersisted({ profile: { xp: 10 } }, 1);

    expect(result.profile.settings).toEqual(initialPersisted.profile.settings);
    expect(result.predictions).toEqual({});
    expect(result.strategies).toEqual([]);
  });

  it("does not mutate the shared defaults", () => {
    const result = migratePersisted({ profile: { xp: 5 } }, 1);
    result.journal.push({
      id: "x",
      levelId: "3-B",
      seriesId: "BTCUSDT-4h",
      assetClass: "crypto-spot",
      entry: 1,
      stop: 0.9,
      target: null,
      exit: null,
      r: null,
      reason: "",
      tags: [],
      at: "2026-01-01T00:00:00.000Z",
    });

    expect(initialPersisted.journal).toHaveLength(0);
  });
});
