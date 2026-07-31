import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { OosSeriesId, Series, SeriesId } from "@/lib/chart/types";
import type { SeriesManifest } from "@/lib/data/manifest-types";
import { ALL_LEVELS } from "@/lib/levels/content/all";
import { derive, JOBS } from "../../scripts/resample-data";

/**
 * Guards the committed data against drift.
 *
 * Levels address these files by bar index, so a file that changes without its
 * manifest entry changing is a silent break across every level pointing into it.
 *
 * What this cannot catch: a deliberate refetch that shifts history *and* updates
 * the manifest in the same commit. That shows up as a manifest diff in review,
 * which is why the manifest is committed. Verifying committed data against
 * upstream needs the network and can never pass for the snapshot series, so it
 * stays a manual step rather than a CI job.
 */

const SERIES_DIR = "public/data/series";
const OOS_DIR = "public/data/oos";
const MAX_GZIP_BYTES = 150 * 1024;

/** Every id the app is allowed to reference. Mirrors the SeriesId union. */
const EXPECTED_SERIES: SeriesId[] = [
  "AAPL-1d",
  "AAPL-1d-raw",
  "BTCUSDT-1d",
  "BTCUSDT-4h",
  "EURUSD-1d",
  "EURUSD-1h",
  "EURUSD-4h",
  "GC-1d",
  "LAKE-1d",
  "SPY-15m",
  "SPY-1d",
  "SPY-1h",
];

/** FIXTURE-1d is synthetic and lives in code, so it has no committed file. */
const CODE_ONLY: SeriesId[] = ["FIXTURE-1d"];

function readManifest(dir: string): SeriesManifest {
  return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as SeriesManifest;
}

function readRaw(dir: string, id: string): string {
  return readFileSync(join(dir, `${id}.json`), "utf8");
}

const manifest = readManifest(SERIES_DIR);
const oosManifest = readManifest(OOS_DIR);

describe("committed series manifest", () => {
  it("lists exactly the ids the SeriesId union allows", () => {
    const listed = manifest.series.map((e) => e.id).sort();
    expect(listed).toEqual([...EXPECTED_SERIES].sort());
  });

  it("keeps the synthetic fixture out of the committed data", () => {
    for (const id of CODE_ONLY) {
      expect(manifest.series.some((e) => e.id === id)).toBe(false);
    }
  });

  it("does not list any out-of-sample series", () => {
    // The main manifest is what the loader can reach. An -oos entry here would
    // make Chapter 10's holdback reachable from every earlier chapter.
    for (const entry of manifest.series) {
      expect(entry.id.endsWith("-oos")).toBe(false);
    }
  });
});

describe.each(manifest.series)("$id", (entry) => {
  const raw = readRaw(SERIES_DIR, entry.id);
  const series = JSON.parse(raw) as Series<string>;

  it("matches its recorded hash", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe(entry.sha256);
  });

  it("matches its recorded bar count and range", () => {
    expect(series.t).toHaveLength(entry.bars);
    expect(new Date(series.t[0] ?? 0).toISOString()).toBe(entry.firstBar);
    expect(new Date(series.t[series.t.length - 1] ?? 0).toISOString()).toBe(entry.lastBar);
  });

  it("stays inside the size budget", () => {
    const gz = gzipSync(Buffer.from(raw), { level: 9 }).byteLength;
    expect(gz).toBeLessThanOrEqual(MAX_GZIP_BYTES);
    expect(gz).toBe(entry.gzipBytes);
  });

  it("has parallel columns of equal length", () => {
    for (const key of ["o", "h", "l", "c", "v"] as const) {
      expect(series[key]).toHaveLength(series.t.length);
    }
  });

  it("has a strictly increasing timeline", () => {
    for (let i = 1; i < series.t.length; i += 1) {
      expect(series.t[i]).toBeGreaterThan(series.t[i - 1] ?? 0);
    }
  });

  it("has every bar's range containing its own open and close", () => {
    // A candle whose wick excludes its body would be actively wrong in Chapter 1,
    // whose subject is candle anatomy.
    for (let i = 0; i < series.t.length; i += 1) {
      const o = series.o[i] ?? 0;
      const h = series.h[i] ?? 0;
      const l = series.l[i] ?? 0;
      const c = series.c[i] ?? 0;
      expect(h).toBeGreaterThanOrEqual(Math.max(o, c));
      expect(l).toBeLessThanOrEqual(Math.min(o, c));
      expect(l).toBeGreaterThan(0);
      expect(series.v[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("declares the id its filename claims", () => {
    expect(series.id).toBe(entry.id);
  });
});

describe("out-of-sample holdback", () => {
  it("names every entry with the -oos suffix", () => {
    expect(oosManifest.series.length).toBeGreaterThan(0);
    for (const entry of oosManifest.series) {
      expect(entry.id.endsWith("-oos")).toBe(true);
    }
  });

  it("matches each recorded hash", () => {
    for (const entry of oosManifest.series) {
      const raw = readRaw(OOS_DIR, entry.id);
      expect(createHash("sha256").update(raw).digest("hex")).toBe(entry.sha256);
    }
  });

  it("does not overlap its in-sample counterpart", () => {
    // The whole point of the holdback: if a player practised on these bars,
    // Chapter 10.6 would prove nothing.
    for (const entry of oosManifest.series) {
      const baseId = entry.id.replace(/-oos$/, "");
      const inSample = JSON.parse(readRaw(SERIES_DIR, baseId)) as Series<string>;
      const oos = JSON.parse(readRaw(OOS_DIR, entry.id)) as Series<OosSeriesId>;

      const lastIn = inSample.t[inSample.t.length - 1] ?? 0;
      const firstOos = oos.t[0] ?? 0;
      expect(firstOos).toBeGreaterThan(lastIn);

      const shared = new Set(inSample.t).size + new Set(oos.t).size;
      expect(shared).toBe(inSample.t.length + oos.t.length);
    }
  });

  it("holds back enough bars to validate a strategy against", () => {
    for (const entry of oosManifest.series) {
      expect(entry.bars).toBeGreaterThanOrEqual(200);
    }
  });

  it("covers every series a Chapter 10 strategy can run on", () => {
    // SPY-15m is the deliberate exception — a 60-day snapshot with no room to
    // spare, used for the session levels rather than for strategy building. SPY-1h is
    // derived from it, so the exemption propagates; deriving a holdback from a source
    // that has none is not possible.
    //
    // EURUSD-4h is derived and *is* held back, because 1,742 bars is enough to build a
    // strategy on and this guard is the reason: an unsplit series lets a player skip
    // out-of-sample validation by choosing it.
    const held = new Set(oosManifest.series.map((e) => e.id.replace(/-oos$/, "")));
    const exempt = new Set(["SPY-15m", "SPY-1h", "AAPL-1d-raw"]);
    const strategyCapable = manifest.series
      .map((e) => e.id)
      .filter((id) => !exempt.has(id));
    for (const id of strategyCapable) {
      expect(held, id).toContain(id);
    }
  });
});

describe("data quality is recorded, not hidden", () => {
  it("reports repair and drop counts for every series", () => {
    for (const entry of manifest.series) {
      expect(entry.repairedBars).toBeGreaterThanOrEqual(0);
      expect(entry.droppedBars).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps repaired bars to a small minority", () => {
    // Gold is the worst offender at ~5%. Past 10% the feed is broken rather than
    // quirky, and the fetch script refuses to write it.
    for (const entry of manifest.series) {
      expect(entry.repairedBars / entry.bars).toBeLessThan(0.1);
    }
  });

  it("flags the rolling-window series as snapshots", () => {
    const snapshots = manifest.series.filter((e) => e.snapshot).map((e) => e.id);
    expect(snapshots).toContain("SPY-15m");
    expect(snapshots).toContain("EURUSD-1h");
  });

  it("flags the reconstructed series", () => {
    // AAPL-1d-raw is un-split-adjusted for level 1.7; the other two are resampled from
    // committed intraday series for Chapter 6's multi-timeframe panes.
    const reconstructed = manifest.series.filter((e) => e.reconstructed).map((e) => e.id);
    expect(reconstructed).toEqual(["AAPL-1d-raw", "EURUSD-4h", "SPY-1h"]);
  });
});

describe("AAPL-1d-raw", () => {
  const raw = JSON.parse(readRaw(SERIES_DIR, "AAPL-1d-raw")) as Series<string>;
  const adjusted = JSON.parse(readRaw(SERIES_DIR, "AAPL-1d")) as Series<string>;

  it("contains the phantom drop level 1.7 asks about", () => {
    let worst = 0;
    for (let i = 1; i < raw.c.length; i += 1) {
      const change = (raw.c[i] ?? 0) / (raw.c[i - 1] ?? 1) - 1;
      worst = Math.min(worst, change);
    }
    expect(worst).toBeLessThan(-0.7);
  });

  it("shows the same sessions as an ordinary day in the adjusted series", () => {
    // Both readings come from the same trades, which is the entire lesson.
    const byTime = new Map(adjusted.t.map((t, i) => [t, adjusted.c[i] ?? 0]));
    let worstAdjusted = 0;
    for (let i = 1; i < raw.t.length; i += 1) {
      const now = byTime.get(raw.t[i] ?? 0);
      const prev = byTime.get(raw.t[i - 1] ?? 0);
      if (now === undefined || prev === undefined) continue;
      worstAdjusted = Math.min(worstAdjusted, now / prev - 1);
    }
    expect(worstAdjusted).toBeGreaterThan(-0.2);
  });
});

/**
 * Whether each series' `open` field carries information the other three do not.
 *
 * Found in M7 while measuring candlestick base rates. Yahoo's `EURUSD=X` daily feed
 * reports an open within a pip or two of the *same bar's* close from 2010 onward, so
 * every bar arrives as a textbook doji and any body- or gap-based reading of it is an
 * artefact rather than a measurement. It is upstream — 64 of the last 67 bars Yahoo
 * serves have the same shape — so refetching cannot fix it and the series is kept for
 * its closes, which are sound.
 *
 * The guard exists so the next series with this shape fails CI instead of quietly
 * becoming the basis of a level. It is deliberately an allow-list of one.
 */
describe("open-price health", () => {
  /** Series whose open is known to be unusable, with the reason recorded above. */
  const OPEN_UNRELIABLE: SeriesId[] = ["EURUSD-1d"];

  function degenerateBodyShare(id: string): number {
    const series = JSON.parse(readRaw(SERIES_DIR, id)) as Series<string>;
    let degenerate = 0;
    let counted = 0;
    for (let i = 0; i < series.t.length; i += 1) {
      const range = (series.h[i] ?? 0) - (series.l[i] ?? 0);
      if (range <= 0) continue;
      counted += 1;
      if (Math.abs((series.c[i] ?? 0) - (series.o[i] ?? 0)) / range < 0.1) {
        degenerate += 1;
      }
    }
    return counted === 0 ? 0 : degenerate / counted;
  }

  it.each(EXPECTED_SERIES.filter((id) => !OPEN_UNRELIABLE.includes(id)))(
    "%s has real bodies, so its open means something",
    (id) => {
      // Every sound series we hold sits near 0.11. Half would mean the open is
      // tracking the close rather than the session's first trade.
      expect(degenerateBodyShare(id)).toBeLessThan(0.35);
    },
  );

  it.each(OPEN_UNRELIABLE)(
    "%s is still the broken series this allow-list was written for",
    (id) => {
      // If this ever fails, upstream fixed the feed: drop the entry, and 1.6 can go
      // back to showing FX as its middle market.
      expect(degenerateBodyShare(id)).toBeGreaterThan(0.5);
    },
  );

  it("keeps no level's body- or gap-based claim pointed at an unreliable open", () => {
    // 1.6 is the level that reads opens directly; it used to read this one.
    const usesUnreliableOpen = ALL_LEVELS.filter(
      (level) =>
        level.id === "1-6" &&
        level.data.some((slice) => OPEN_UNRELIABLE.includes(slice.series)),
    );
    expect(usesUnreliableOpen).toEqual([]);
  });
});

/**
 * The derived series against what the resampler produces now.
 *
 * Same failure mode the base rates have: these files are fetched at runtime and levels
 * address them by bar index, so a boundary rule changed without `npm run data:resample`
 * would leave Chapter 6 pointing at bars that no longer mean what the level file says.
 * Recomputing rather than hashing also means the test names *what* moved.
 */
describe("derived series", () => {
  it.each(JOBS.map((job) => [job.id, job] as const))(
    "%s matches a fresh resample of its source",
    (_id, job) => {
      const committed = JSON.parse(readRaw(job.dir, job.id)) as Series<string>;
      expect(derive(job)).toEqual(committed);
    },
  );

  it("declares every derived series as derived and reconstructed", () => {
    for (const job of JOBS) {
      const listed = job.dir === SERIES_DIR ? manifest : oosManifest;
      const entry = listed.series.find((e) => e.id === job.id);
      expect(entry?.source, job.id).toBe("derived");
      expect(entry?.reconstructed, job.id).toBe(true);
    }
  });

  it("keeps each derived series inside the period its source covers", () => {
    // Aggregation cannot invent a bar outside the source, so a range wider than the
    // source's would mean bars were assigned to the wrong bucket entirely.
    for (const job of JOBS) {
      const source = JSON.parse(readRaw(job.dir, job.from)) as Series<string>;
      const derived = JSON.parse(readRaw(job.dir, job.id)) as Series<string>;
      expect(derived.t[0]!, job.id).toBeGreaterThanOrEqual(source.t[0]!);
      expect(derived.t.at(-1)!, job.id).toBeLessThanOrEqual(source.t.at(-1)!);
    }
  });

  it("gives the derived series a holdback unless its source has none", () => {
    // The guarantee `HeldBackSeriesId` exists for, checked on the derived side too: a
    // strategy-capable series without a holdback is a way to skip Chapter 10's
    // out-of-sample validation by choosing it.
    const held = new Set(oosManifest.series.map((e) => e.id));
    for (const job of JOBS.filter((j) => j.dir === SERIES_DIR)) {
      const sourceHeld = held.has(`${job.from}-oos`);
      expect(held.has(`${job.id}-oos`), `${job.id} holdback`).toBe(sourceHeld);
    }
  });

  it("gives every MTF pair a real overlap, which is the point of deriving them", () => {
    // The failure this whole artefact exists to prevent: a level cannot show two views of
    // a period one of its series does not cover.
    const pairs: [low: string, high: string][] = [
      ["BTCUSDT-4h", "BTCUSDT-1d"],
      ["EURUSD-1h", "EURUSD-4h"],
      ["SPY-15m", "SPY-1h"],
    ];
    for (const [low, high] of pairs) {
      const a = JSON.parse(readRaw(SERIES_DIR, low)) as Series<string>;
      const b = JSON.parse(readRaw(SERIES_DIR, high)) as Series<string>;
      const from = Math.max(a.t[0]!, b.t[0]!);
      const to = Math.min(a.t.at(-1)!, b.t.at(-1)!);
      const days = (to - from) / 86_400_000;
      expect(days, `${low} vs ${high} overlap in days`).toBeGreaterThan(30);
    }
  });
});
