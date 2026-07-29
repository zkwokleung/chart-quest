import type {
  HeldBackSeriesId,
  OosSeriesId,
  Series,
  SeriesId,
  Timeframe,
} from "../lib/chart/types.ts";
import type { ManifestEntry } from "../lib/data/manifest-types.ts";
import {
  indexAtOrAfter,
  sliceSeries,
  trimAfter,
  validateSeries,
  withId,
  type Precision,
} from "./lib/columnar.ts";
import {
  describe,
  encodeSeries,
  MAX_GZIP_BYTES,
  writeManifest,
  writeSeriesFile,
  type EntryMeta,
} from "./lib/manifest.ts";
import { fetchBinance } from "./sources/binance.ts";
import { fetchYahoo, type SplitEvent } from "./sources/yahoo.ts";
import { unadjustSplits } from "./lib/unadjust.ts";
import { HELD_BACK, splitOos } from "./lib/split-oos.ts";

const SERIES_DIR = "public/data/series";
const OOS_DIR = "public/data/oos";

/**
 * Pinned so a re-run produces the same daily bars rather than silently extending
 * history. Bar indices are the addressing scheme for every level, so the end of a
 * series is not free to move — see docs/DATA.md. Bump deliberately.
 */
const END = Date.UTC(2026, 6, 28, 23, 59, 59);

/** Daily history starts here: deep enough to reach the 2007-09 crisis. */
const DAILY_START = Date.UTC(2005, 0, 1);

const DAY = 86_400_000;

type YahooSpec = {
  kind: "yahoo";
  id: SeriesId;
  symbol: string;
  tf: Timeframe;
  startMs: number;
  precision: Precision;
  minBars: number;
  /** Upstream only serves a rolling window for this interval. */
  snapshot?: boolean;
  note?: string;
};

type BinanceSpec = {
  kind: "binance";
  id: SeriesId;
  symbol: string;
  tf: Timeframe;
  startMs: number;
  endMs?: number;
  minBars: number;
  note?: string;
};

type Spec = YahooSpec | BinanceSpec;

/**
 * The spine, chosen so the series disagree with each other. A player who only
 * ever sees crypto learns crypto, not technical analysis.
 */
const SPINE: Spec[] = [
  {
    kind: "binance",
    id: "BTCUSDT-1d",
    symbol: "BTCUSDT",
    tf: "1d",
    startMs: Date.UTC(2017, 0, 1),
    minBars: 3000,
    note: "Crypto · 24/7 · high volatility · trend-persistent",
  },
  {
    // Full 4h history is ~19,600 bars / 382 KB gzipped, well over the per-file
    // ceiling. This window keeps the 2021 top, the 2022 bear and the 2023
    // recovery — three regimes rather than three years of noise.
    kind: "binance",
    id: "BTCUSDT-4h",
    symbol: "BTCUSDT",
    tf: "4h",
    startMs: Date.UTC(2021, 0, 1),
    endMs: Date.UTC(2024, 0, 1),
    minBars: 6000,
    note: "Crypto intraday · 2021-2024 window to stay inside the size budget",
  },
  {
    kind: "yahoo",
    id: "SPY-1d",
    symbol: "SPY",
    tf: "1d",
    startMs: DAILY_START,
    precision: 2,
    minBars: 5000,
    note: "Index · sessions · gaps · short-term mean-reverting",
  },
  {
    kind: "yahoo",
    id: "SPY-15m",
    symbol: "SPY",
    tf: "15m",
    // Upstream hard-caps 15m at roughly 60 days and errors rather than truncates.
    // ~40 sessions at 26 bars each, which is ample for the session and
    // opening-range levels.
    startMs: END - 58 * DAY,
    precision: 2,
    minBars: 1000,
    snapshot: true,
    note: "Intraday sessions and the opening range · rolling 60-day snapshot",
  },
  {
    kind: "yahoo",
    id: "AAPL-1d",
    symbol: "AAPL",
    tf: "1d",
    startMs: DAILY_START,
    precision: 2,
    minBars: 5000,
    note: "Single stock · earnings gaps · split-adjusted",
  },
  {
    kind: "yahoo",
    id: "EURUSD-1d",
    symbol: "EURUSD=X",
    tf: "1d",
    startMs: DAILY_START,
    precision: 5,
    minBars: 5000,
    note: "FX · 24/5 · low volatility · ranging · Sunday gap",
  },
  {
    kind: "yahoo",
    id: "EURUSD-1h",
    symbol: "EURUSD=X",
    tf: "1h",
    // Upstream caps 1h at roughly 730 days; 500 keeps the file inside budget.
    startMs: END - 500 * DAY,
    precision: 5,
    minBars: 6000,
    snapshot: true,
    note: "FX intraday · rolling 500-day snapshot",
  },
  {
    kind: "yahoo",
    id: "GC-1d",
    symbol: "GC=F",
    tf: "1d",
    startMs: DAILY_START,
    precision: 2,
    minBars: 5000,
    note: "Commodity · different volatility regime",
  },
  {
    kind: "yahoo",
    id: "LAKE-1d",
    symbol: "LAKE",
    tf: "1d",
    startMs: DAILY_START,
    precision: 2,
    minBars: 5000,
    note: "Illiquid small-cap · spread and slippage · 2014 news spike",
  },
];

/** Level 1.7 needs only the bars around the 2020-08-31 4:1 split. */
const RAW_SLICE: { id: SeriesId; fromMs: number; toMs: number } = {
  id: "AAPL-1d-raw",
  fromMs: Date.UTC(2020, 5, 1),
  toMs: Date.UTC(2020, 9, 1),
};

/**
 * A feed where more than this fraction of bars needs its range widened is not a
 * feed quirk any more, it is broken. Gold sits near 5.5%.
 */
const MAX_REPAIR_RATIO = 0.1;

type Fetched = {
  series: Series<SeriesId>;
  splits: SplitEvent[];
  repaired: number;
  dropped: number;
};

async function fetchSpec(spec: Spec): Promise<Fetched> {
  const cutoff = spec.kind === "binance" ? (spec.endMs ?? END) : END;

  if (spec.kind === "binance") {
    const { series, repaired, dropped } = await fetchBinance(
      spec.symbol,
      spec.tf,
      spec.startMs,
      cutoff,
    );
    const trim = trimAfter(withId(series, spec.id), cutoff);
    return { series: trim.series, splits: [], repaired, dropped: dropped + trim.trimmed };
  }

  const { series, splits, repaired, dropped } = await fetchYahoo(
    spec.symbol,
    spec.tf,
    Math.floor(spec.startMs / 1000),
    Math.floor(cutoff / 1000),
    { id: spec.id, precision: spec.precision },
  );
  const trim = trimAfter(withId(series, spec.id), cutoff);
  return { series: trim.series, splits, repaired, dropped: dropped + trim.trimmed };
}

async function emit(
  dir: string,
  series: Series<SeriesId | OosSeriesId>,
  meta: EntryMeta,
): Promise<ManifestEntry> {
  const json = encodeSeries(series);
  const entry = describe(series, json, meta);
  if (entry.gzipBytes > MAX_GZIP_BYTES) {
    throw new Error(
      `${series.id}: ${(entry.gzipBytes / 1024).toFixed(1)} KB gzipped exceeds the ` +
        `${MAX_GZIP_BYTES / 1024} KB ceiling — narrow its window`,
    );
  }
  await writeSeriesFile(dir, series, json);
  return entry;
}

function report(entry: ManifestEntry, suffix = ""): void {
  console.log(
    `${String(entry.bars).padStart(6)} bars  ` +
      `${(entry.gzipBytes / 1024).toFixed(1).padStart(6)} KB gz  ` +
      `${entry.firstBar.slice(0, 10)} → ${entry.lastBar.slice(0, 10)}${suffix}`,
  );
}

function isHeldBack(id: SeriesId): id is HeldBackSeriesId {
  return (HELD_BACK as readonly string[]).includes(id);
}

async function main(): Promise<void> {
  const entries: ManifestEntry[] = [];
  const oosEntries: ManifestEntry[] = [];

  for (const spec of SPINE) {
    process.stdout.write(`${spec.id.padEnd(14)} `);
    const { series, splits, repaired, dropped } = await fetchSpec(spec);

    const precision: Precision = spec.kind === "yahoo" ? spec.precision : 2;
    validateSeries(series, { minBars: spec.minBars, precision });

    const repairRatio = repaired / Math.max(1, series.t.length);
    if (repairRatio > MAX_REPAIR_RATIO) {
      throw new Error(
        `${spec.id}: ${(repairRatio * 100).toFixed(1)}% of bars needed their range ` +
          `widened — the upstream feed looks broken, not merely quirky`,
      );
    }

    const meta: EntryMeta = {
      source: spec.kind,
      snapshot: spec.kind === "yahoo" ? spec.snapshot === true : false,
      reconstructed: false,
      repairedBars: repaired,
      droppedBars: dropped,
      note: spec.note,
    };
    const quality =
      (repaired > 0 ? `  repaired ${repaired}` : "") +
      (dropped > 0 ? `  dropped ${dropped}` : "");

    // The teaching file is genuinely truncated rather than shipping the full
    // series alongside a duplicate tail — otherwise chapters 1-9 could reach the
    // bars Chapter 10 validates against.
    if (isHeldBack(spec.id)) {
      const { inSample, outOfSample } = splitOos(withId(series, spec.id));
      const entry = await emit(SERIES_DIR, inSample, meta);
      entries.push(entry);
      report(entry, quality);

      process.stdout.write(`${outOfSample.id.padEnd(14)} `);
      const oosEntry = await emit(OOS_DIR, outOfSample, {
        ...meta,
        repairedBars: 0,
        droppedBars: 0,
        note: `Held back for Chapter 10. Not referenced by any level in chapters 1-9.`,
      });
      oosEntries.push(oosEntry);
      report(oosEntry, "  held back");
    } else {
      const entry = await emit(SERIES_DIR, series, meta);
      entries.push(entry);
      report(entry, quality);
    }

    if (spec.id === "AAPL-1d") {
      process.stdout.write(`${RAW_SLICE.id.padEnd(14)} `);
      const from = indexAtOrAfter(series, RAW_SLICE.fromMs);
      const to = indexAtOrAfter(series, RAW_SLICE.toMs);
      const raw = unadjustSplits(
        withId(sliceSeries(series, from, to), RAW_SLICE.id),
        splits,
      );
      validateSeries(raw, { minBars: 60, precision: 2 });
      const rawEntry = await emit(SERIES_DIR, raw, {
        source: "derived",
        snapshot: false,
        reconstructed: true,
        repairedBars: 0,
        droppedBars: 0,
        note:
          "Split-unadjusted reconstruction for level 1.7. Yahoo serves only " +
          "adjusted prices, so the phantom drop is rebuilt from its split events.",
      });
      entries.push(rawEntry);
      report(rawEntry, `  reconstructed from ${splits.length} split(s)`);
    }
  }

  await writeManifest(SERIES_DIR, entries);
  await writeManifest(OOS_DIR, oosEntries);

  const gz = (list: ManifestEntry[]) =>
    (list.reduce((sum, e) => sum + e.gzipBytes, 0) / 1024).toFixed(1);
  console.log(
    `\n${entries.length} series · ${gz(entries)} KB gzipped` +
      `\n${oosEntries.length} held back · ${gz(oosEntries)} KB gzipped`,
  );
}

await main();
