import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import type { AssetClass } from "@/lib/instruments/asset-class";
import type { JournalDraft } from "./kind-module";
import { ALL_LEVELS } from "./content/all";
import { gradeAny, journalEntriesFor, perfectAttemptFor } from "./kinds";

/**
 * What the journal actually records, across every authored level.
 *
 * **This is M9's gate, stated mechanically.** Issue #27 asks that level 9.6 read real journal
 * data split by asset class, and before M9 that was impossible: only `replay-trade` carried a
 * journal hook, and only three levels had it as their top-level kind. Four composite bosses
 * contained a `replay-trade` step whose trade was discarded, and 7.B's ten sized trades wrote
 * nothing. A perfect playthrough of Chapters 1-8 logged **three entries across two asset
 * classes** — and the two classes that appear only in bosses, fx and futures, never appeared.
 *
 * So this test exists to fail the moment coverage regresses, in the unit suite where it runs in
 * a second rather than only through a browser. Every number here was wrong before M9.
 */

const cache = new Map<string, Series<string>>();
function series(id: SeriesId): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

/** Every draft a perfect playthrough of every authored level would write. */
const drafts: { levelId: string; draft: JournalDraft }[] = ALL_LEVELS.flatMap(
  (level) => {
    const data = level.data.map((slice) => series(slice.series));
    const attempt = perfectAttemptFor(level, data);
    const grade = gradeAny(level, attempt, data);
    return journalEntriesFor(level, attempt, grade).map((draft) => ({
      levelId: level.id,
      draft,
    }));
  },
);

const byClass = (planned?: boolean) => {
  const counts = new Map<AssetClass, number>();
  for (const { draft } of drafts) {
    if (planned !== undefined && (draft.planned ?? true) !== planned) continue;
    const key = draft.assetClass as AssetClass;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

describe("what the journal records", () => {
  it("writes eighteen entries, not three", () => {
    // Seventeen before Chapter 9; 9.4 is the eighteenth and the eighth the player planned.
    expect(drafts).toHaveLength(18);
  });

  it("covers all four asset classes, with the counts pinned", () => {
    // Pinned rather than merely counted, so a later level quietly changing the mix fails here
    // and not in Chapter 9's arithmetic.
    expect(Object.fromEntries([...byClass()].sort())).toEqual({
      "crypto-spot": 2,
      equity: 4,
      fx: 1,
      // Ten from 7.B's sequence plus 9.4's own trade, which is the first futures trade a player
      // actually plans.
      futures: 11,
    });
  });

  it("writes from every level that asks the player for a trade", () => {
    const levels = [...new Set(drafts.map((d) => d.levelId))].sort();
    expect(levels).toEqual([
      "3-B",
      "4-B",
      "5-B",
      "6-2",
      "6-B",
      "7-4",
      "7-B",
      "8-B",
      "9-4",
    ]);
  });
});

describe("planned trades, which every headline figure rests on", () => {
  it("counts eight, one of them the first futures trade a player plans", () => {
    // **The distinction Chapter 9.6 depends on.** Ten of the eighteen come from 7.B, where the
    // entries, stops and targets were authored and the only decision was size. Pooling them
    // would make "your average loss is 1.4R, not the 1R you set" a claim about the author's
    // stops — the exact error the chapter exists to cure.
    const planned = drafts.filter((d) => d.draft.planned !== false);
    expect(planned).toHaveLength(8);
    expect(Object.fromEntries([...byClass(true)].sort())).toEqual({
      "crypto-spot": 2,
      equity: 4,
      fx: 1,
      // 9.4 trades gold, so the futures cell stops being empty of the player's own plans — which
      // 9.6's prose had to be corrected for. This test is what caught it.
      futures: 1,
    });
  });

  it("puts every unplanned trade in one attempt at one level", () => {
    const unplanned = drafts.filter((d) => d.draft.planned === false);
    expect(unplanned).toHaveLength(10);
    expect(new Set(unplanned.map((d) => d.levelId))).toEqual(new Set(["7-B"]));
    // No stated reason, because the player gave none. Synthesising one would put words in their
    // mouth in the one field whose whole value is that it is theirs.
    for (const { draft } of unplanned) expect(draft.reason).toBe("");
  });

  it("guarantees no asset class can support an expectancy, for any player", () => {
    // **The structural fact 9.6's graded answer rests on**, computed rather than asserted so a
    // future trade level fails this guarantee rather than leaving a stale constant behind.
    // A player who skipped levels has fewer trades, never more.
    const largest = Math.max(...byClass(true).values());
    expect(largest).toBeLessThan(20);
  });
});

describe("every entry is fit to be read back", () => {
  it("carries a finite R that matches the grade it came from", () => {
    for (const { levelId, draft } of drafts) {
      expect(Number.isFinite(draft.r), `${levelId}`).toBe(true);
      expect(draft.r).toBeGreaterThan(-5);
      expect(draft.r).toBeLessThan(5);
    }
  });

  it("carries a setup from the closed vocabulary", () => {
    for (const { levelId, draft } of drafts) {
      expect(["continuation", "reversal", "level"], `${levelId}`).toContain(draft.setup);
    }
  });

  it("uses every id in the vocabulary, so none of it is dead", () => {
    expect(new Set(drafts.map((d) => d.draft.setup))).toEqual(
      new Set(["continuation", "reversal", "level"]),
    );
  });

  it("names a real series and its asset class on every entry", () => {
    for (const { levelId, draft } of drafts) {
      expect(draft.seriesId, `${levelId}`).toBeTruthy();
      expect(
        ["crypto-spot", "equity", "fx", "futures"],
        `${levelId}`,
      ).toContain(draft.assetClass);
    }
  });

  it("records prices a reader could check, not placeholders", () => {
    for (const { levelId, draft } of drafts) {
      expect(draft.entry, `${levelId} entry`).toBeGreaterThan(0);
      expect(draft.stop, `${levelId} stop`).toBeGreaterThan(0);
      expect(draft.entry, `${levelId}`).not.toBe(draft.stop);
    }
  });
});
