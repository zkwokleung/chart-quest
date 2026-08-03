import { describe, expect, it } from "vitest";
import type { JournalEntry, LevelProgress, Persisted } from "@/lib/store/schema";
import { CHAPTERS, levelIds } from "./chapters";
import { SKILLS, skillProfile, weakestSkills } from "./skills";

/**
 * The radar's axis mapping, asserted rather than assumed.
 *
 * The epic named seven axes and the chapters do not divide into seven. This file is where that
 * gets settled: every teaching chapter maps to exactly one axis, no axis is orphaned, and the two
 * deliberate exceptions — `discipline` having no chapter and Chapter 10 having no axis — are
 * pinned as choices so a later reader cannot mistake them for oversights.
 */

const cleared: LevelProgress = {
  stars: 3,
  bestScore: 1,
  attempts: 1,
  completedAt: null,
};

function progressFor(
  entries: Record<string, Partial<LevelProgress>>,
): Persisted["progress"] {
  const map: Record<string, LevelProgress> = {};
  for (const [id, partial] of Object.entries(entries)) {
    map[id] = { ...cleared, ...partial };
  }
  return map as Persisted["progress"];
}

/** Every level of every chapter, three stars. */
const perfect = progressFor(
  Object.fromEntries(
    CHAPTERS.flatMap((c) => levelIds(c)).map((id) => [id, {}]),
  ),
);

const trade = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "j1",
  levelId: "3-B",
  seriesId: "BTCUSDT-4h",
  assetClass: "crypto-spot",
  entry: 100,
  stop: 95,
  target: 110,
  exit: 110,
  r: 2,
  reason: "pullback into the level that broke, with the trend still up",
  tags: ["long", "BTCUSDT-4h"],
  at: "2025-01-01T00:00:00.000Z",
  attemptNo: 1,
  planned: true,
  setup: "continuation",
  ...over,
});

describe("the axes", () => {
  it("maps every teaching chapter to exactly one axis", () => {
    const teaching = CHAPTERS.filter((c) => c.n <= 9).map((c) => c.n);
    const mapped = SKILLS.map((s) => s.chapter).filter(
      (n): n is number => n !== null,
    );
    expect([...mapped].sort((a, b) => a - b)).toEqual(teaching);
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it("leaves Chapter 10 unmapped on purpose", () => {
    // The capstone composes all nine. A tenth axis would score the same skills twice and would
    // read as every unfinished player's weakest.
    expect(SKILLS.map((s) => s.chapter)).not.toContain(10);
  });

  it("scores exactly one axis from the journal rather than from a chapter", () => {
    const journalOnly = SKILLS.filter((s) => s.chapter === null);
    expect(journalOnly.map((s) => s.id)).toEqual(["discipline"]);
  });

  it("gives every axis a unique id and something to practise", () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const skill of SKILLS) {
      expect(skill.label.length, skill.id).toBeGreaterThan(2);
      expect(skill.practise.length, skill.id).toBeGreaterThan(20);
    }
  });

  it("has ten of them: one per teaching chapter, plus the journal's", () => {
    // Nine chapters and one behavioural axis. The M9 plan said nine in total and had left
    // Chapter 9 itself out; the count is asserted so the next axis added has to argue for itself.
    expect(SKILLS).toHaveLength(10);
    expect(SKILLS.filter((s) => s.chapter !== null)).toHaveLength(9);
  });
});

describe("reading a profile", () => {
  it("distinguishes not-started from scored-zero, which is the point", () => {
    const untouched = skillProfile({} as Persisted["progress"], []);
    for (const reading of untouched) {
      expect(reading.value, reading.axis).toBeNull();
    }
    expect(untouched.map((r) => r.detail)).toContain("not started");

    const failed = skillProfile(
      progressFor({ "1-1": { stars: 0, bestScore: 0.2, attempts: 4 } }),
      [],
    );
    const reading = failed.find((r) => r.axis === "reading")!;
    expect(reading.value).toBe(0);
    expect(reading.detail).toBe("0 of 24 stars");
  });

  it("reads a full playthrough as one on every chapter axis", () => {
    const full = skillProfile(perfect, []);
    for (const reading of full) {
      if (reading.axis === "discipline") continue;
      expect(reading.value, reading.axis).toBe(1);
    }
  });

  it("takes discipline from the journal and not from any chapter's stars", () => {
    // Three stars everywhere and no journal still leaves discipline unmeasured, which is what
    // makes it the axis the epic wanted rather than a ninth restatement of the level scores.
    const starsOnly = skillProfile(perfect, []);
    expect(starsOnly.find((r) => r.axis === "discipline")!.value).toBeNull();

    const withTrades = skillProfile(perfect, [trade()]);
    const measured = withTrades.find((r) => r.axis === "discipline")!;
    expect(measured.value).toBeGreaterThan(0.9);
    // Its own sample size, not the percentage twice — the same rule the chapter axes follow.
    expect(measured.detail).toBe("from 1 trade");

    const sloppy = skillProfile(perfect, [
      trade({ id: "j2", reason: "", r: -2.4 }),
    ]);
    expect(sloppy.find((r) => r.axis === "discipline")!.value).toBeLessThan(0.6);
  });

  it("names what to practise, weakest first, and never something untouched", () => {
    const readings = skillProfile(
      progressFor({
        "1-1": { stars: 1, attempts: 2 },
        "2-1": { stars: 3, attempts: 1 },
        "2-2": { stars: 3, attempts: 1 },
        "2-3": { stars: 3, attempts: 1 },
        "2-4": { stars: 3, attempts: 1 },
        "2-5": { stars: 3, attempts: 1 },
        "2-6": { stars: 3, attempts: 1 },
        "2-B": { stars: 3, attempts: 1 },
      }),
      [],
    );
    const weak = weakestSkills(readings);
    expect(weak.map((r) => r.axis)).toEqual(["reading"]);
    // Chapter 2 is perfect and every other chapter is untouched, so neither is suggested.
    expect(weak.map((r) => r.axis)).not.toContain("structure");
    expect(weak.map((r) => r.axis)).not.toContain("zones");
  });
});
