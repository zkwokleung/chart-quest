import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Series, SeriesId } from "../lib/chart/types.ts";
import { resample, type Bucket } from "../lib/data/resample.ts";
import type { SeriesManifest } from "../lib/data/manifest-types.ts";
import { describe as describeSeries, encodeSeries } from "./lib/manifest.ts";

/**
 * Derives the higher-timeframe series Chapter 6 needs, from series already committed.
 *
 *   npm run data:resample
 *
 * Chapter 6 teaches multi-timeframe reading, which needs two views of the same period,
 * and only Bitcoin has that natively — EURUSD's hourly begins two years after its daily
 * ends, and SPY's 15m three years after. See `lib/data/resample.ts` for why aggregating
 * upward beats refetching.
 *
 * Bitcoin is deliberately absent from the output: its 1d and 4h are both real, so nothing
 * needs deriving, and resampling it stays a *test* — `resample.test.ts` checks the derived
 * daily against the committed one on all 931 days they share. Keeping it out of the
 * shipped set is what keeps it available as a proof.
 */

const DIR = "public/data/series";
const OOS_DIR = "public/data/oos";

type Job = {
  from: string;
  into: Bucket;
  id: string;
  dir: string;
  note: string;
};

const JOBS: Job[] = [
  {
    from: "EURUSD-1h",
    into: "4h",
    id: "EURUSD-4h",
    dir: DIR,
    note: "Derived from EURUSD-1h · higher-timeframe pane for Chapter 6",
  },
  {
    from: "SPY-15m",
    into: "1h",
    id: "SPY-1h",
    dir: DIR,
    note: "Derived from SPY-15m · higher-timeframe pane for Chapter 6",
  },
  /**
   * **The holdback has to be derived too.**
   *
   * `EURUSD-4h` carries 1,742 bars, which is enough to build a Chapter 10 strategy on —
   * and `HeldBackSeriesId` exists because leaving one series unsplit lets a player skip
   * out-of-sample validation simply by choosing it. Resampling the *source's* holdback
   * keeps the guarantee exactly rather than granting an exemption.
   *
   * `SPY-1h` needs none: `SPY-15m` is already exempt, being a 60-day snapshot with no room
   * to spare, so the exemption propagates to anything derived from it.
   */
  {
    from: "EURUSD-1h-oos",
    into: "4h",
    id: "EURUSD-4h-oos",
    dir: OOS_DIR,
    note: "Derived from EURUSD-1h-oos · holdback for the derived 4h series",
  },
];

function load(dir: string, id: string): Series<string> {
  return JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as Series<string>;
}

export function derive(job: Job): Series<string> {
  return resample(load(job.dir, job.from), job.into, job.id);
}

function main(): void {
  const manifests = new Map<string, SeriesManifest>();
  const read = (dir: string) => {
    const hit = manifests.get(dir);
    if (hit) return hit;
    const loaded = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    ) as SeriesManifest;
    manifests.set(dir, loaded);
    return loaded;
  };

  for (const job of JOBS) {
    const manifest = read(job.dir);
    const series = derive(job);
    const json = encodeSeries(series);
    writeFileSync(join(job.dir, `${series.id}.json`), json);

    const entry = describeSeries(series, json, {
      source: "derived",
      // The source is a rolling snapshot, so anything derived from it is one too:
      // refetching upstream moves the bars underneath it.
      snapshot: manifest.series.find((e) => e.id === job.from)?.snapshot ?? false,
      reconstructed: true,
      repairedBars: 0,
      droppedBars: 0,
      note: job.note,
    });

    const at = manifest.series.findIndex((e) => e.id === series.id);
    if (at >= 0) manifest.series[at] = entry;
    else manifest.series.push(entry);

    const source = load(job.dir, job.from);
    console.log(
      `${series.id.padEnd(14)} ${String(series.t.length).padStart(5)} bars ` +
        `from ${job.from} (${source.t.length}) · ` +
        `${entry.firstBar.slice(0, 10)} .. ${entry.lastBar.slice(0, 10)} · ` +
        `${(entry.gzipBytes / 1024).toFixed(1)} KB gz`,
    );
  }

  for (const [dir, manifest] of manifests) {
    manifest.series.sort((a, b) => a.id.localeCompare(b.id));
    // `generatedAt` is left alone rather than restamped. Rewriting it would put a diff in
    // every regeneration even when not one bar moved, which makes the one diff that
    // matters harder to see in review.
    writeFileSync(
      join(dir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    console.log(`updated ${join(dir, "manifest.json")}`);
  }
}

/**
 * Only when run as a command.
 *
 * `lib/data/integrity.test.ts` imports `derive` to check the committed files for drift,
 * and a top-level write here would have the test regenerate what it was about to compare
 * against. M7's base-rate guard shipped that way for one run and could not fail.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { JOBS };
