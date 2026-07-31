import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Series, SeriesId } from "../lib/chart/types.ts";
import {
  DEFINITION,
  HORIZON,
  poolStats,
  statsFor,
  type PatternStats,
} from "../lib/ta/base-rates.ts";
import { PATTERN_KINDS, type PatternKind } from "../lib/ta/patterns.ts";

/**
 * Regenerates `public/data/base-rates.json`.
 *
 * A committed artefact, like the series: computed once, immutable after, fetched at
 * runtime rather than bundled. `lib/data/base-rates.test.ts` recomputes it from the
 * committed series and fails if the file has drifted, so a stale file breaks CI
 * instead of quietly teaching last month's numbers.
 *
 *   npm run data:rates
 */

const SERIES_DIR = "public/data/series";
const OUT = "public/data/base-rates.json";

/**
 * The daily spine, one asset per market type.
 *
 * **`EURUSD-1d` is deliberately absent.** Yahoo's `EURUSD=X` feed reports an open
 * within a pip or two of the same bar's close from 2010 onward, so 72% of that series
 * reads as a doji and every candlestick figure computed from it would be an artefact
 * of the feed. Its chart patterns would be sound — those come from highs and lows —
 * but a table where one asset is present for two rows and absent for three is a table
 * that invites the wrong conclusion. See docs/AUTHORING.md.
 *
 * The intraday and raw series are out because a base rate per timeframe is a
 * different measurement, and 4.5 already asks the player to hold six numbers.
 */
const ASSETS: SeriesId[] = [
  "BTCUSDT-1d",
  "SPY-1d",
  "AAPL-1d",
  "GC-1d",
  "LAKE-1d",
];

export type BaseRatesFile = {
  definition: string;
  horizon: number;
  assets: SeriesId[];
  patterns: Record<
    PatternKind,
    { pooled: PatternStats; byAsset: Record<string, PatternStats> }
  >;
};

function load(id: string): Series<string> {
  return JSON.parse(readFileSync(join(SERIES_DIR, `${id}.json`), "utf8")) as Series<string>;
}

/** Six decimals: enough to compare, few enough that the file diffs readably. */
function round(stats: PatternStats): PatternStats {
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return {
    n: stats.n,
    winRate: r(stats.winRate),
    meanFwdAtr: r(stats.meanFwdAtr),
    ci95: [r(stats.ci95[0]), r(stats.ci95[1])],
  };
}

export function computeBaseRates(): BaseRatesFile {
  const series = new Map(ASSETS.map((id) => [id, load(id)]));
  const patterns = {} as BaseRatesFile["patterns"];

  for (const kind of PATTERN_KINDS) {
    const byAsset: Record<string, PatternStats> = {};
    for (const id of ASSETS) {
      byAsset[id] = round(statsFor(series.get(id)!, kind));
    }
    patterns[kind] = {
      pooled: round(poolStats(ASSETS.map((id) => byAsset[id]!))),
      byAsset,
    };
  }

  return { definition: DEFINITION, horizon: HORIZON, assets: ASSETS, patterns };
}

function main(): void {
  const file = computeBaseRates();
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);

  for (const kind of PATTERN_KINDS) {
    const { pooled } = file.patterns[kind];
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    console.log(
      `${kind.padEnd(19)} n=${String(pooled.n).padStart(5)}  ` +
        `win ${pct(pooled.winRate)}  ` +
        `ci [${pct(pooled.ci95[0])}, ${pct(pooled.ci95[1])}]  ` +
        `fwd ${pooled.meanFwdAtr >= 0 ? "+" : ""}${pooled.meanFwdAtr.toFixed(3)} ATR`,
    );
  }
  console.log(`\nwrote ${OUT}`);
}

/**
 * Only when run as a command.
 *
 * `lib/data/base-rates.test.ts` imports `computeBaseRates` to check the committed file
 * for drift, and a top-level write here would have the test regenerate the file it was
 * about to compare against — a guard that can never fail. It did exactly that for one
 * run before this check existed.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
