import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Series, SeriesId } from "../lib/chart/types.ts";
import {
  computeEdgeSweep,
  LOOKBACKS,
  type EdgeSweepFile,
} from "../lib/ta/edge-sweep.ts";

/**
 * Regenerates `public/data/edge-sweep.json`.
 *
 * A committed artefact like the base rates and the asset-character table: computed once, fetched
 * at runtime rather than bundled, and recomputed by `lib/data/edge-sweep.test.ts` so a stale file
 * breaks CI instead of quietly teaching last month's numbers.
 *
 *   npm run data:sweep
 *
 * Reads nothing under `public/data/oos/` — that is Chapter 10's holdback, and 9.5 splits inside
 * the in-sample data on purpose. A test asserts it.
 */

const SERIES_DIR = "public/data/series";
const OUT = "public/data/edge-sweep.json";

function load(id: SeriesId): Series<string> {
  return JSON.parse(
    readFileSync(join(SERIES_DIR, `${id}.json`), "utf8"),
  ) as Series<string>;
}

function report(file: EdgeSweepFile): void {
  console.log(
    `${LOOKBACKS.length} lookbacks, ${Math.round(file.inSampleFraction * 100)}% for tuning\n`,
  );
  console.log(
    "  market       split        best n   in-sample      later    rank of later",
  );
  for (const asset of file.assets) {
    const best = asset.cells.find((c) => c.n === asset.bestInSample)!;
    console.log(
      `  ${asset.asset.padEnd(11)} ${asset.splitDate}   ` +
        `${String(asset.bestInSample).padStart(6)}   ` +
        `${best.inSample.totalR.toFixed(1).padStart(9)}R  ` +
        `${best.later.totalR.toFixed(1).padStart(9)}R   ` +
        `${String(asset.bestInSampleRankLater).padStart(2)} of ${asset.cells.length}` +
        (asset.bestInSampleRankLater > asset.cells.length / 2
          ? "   <- worse than most it did not pick"
          : ""),
    );
  }
  console.log(`\nwrote ${OUT}`);
}

function main(): void {
  const file = computeEdgeSweep(load);
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);
  report(file);
}

/**
 * Only when run as a command.
 *
 * `lib/data/edge-sweep.test.ts` imports the computation to check the committed file for drift,
 * and a top-level write here would have the test regenerate the file it was about to compare
 * against — a guard that can never fail. `compute-base-rates.ts` learned that the hard way.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
