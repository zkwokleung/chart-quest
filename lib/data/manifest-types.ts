import type { Timeframe } from "@/lib/chart/types";

export type DataSource = "binance" | "yahoo" | "derived";

export type ManifestEntry = {
  id: string;
  tf: Timeframe;
  bars: number;
  /** ISO timestamp of the first and last bar. */
  firstBar: string;
  lastBar: string;
  bytes: number;
  gzipBytes: number;
  sha256: string;
  source: DataSource;
  /**
   * True when upstream only serves a rolling window, so re-running the fetch
   * produces different bars. Snapshot series are pinned by their hash and are not
   * expected to match a later refetch. See docs/DATA.md.
   */
  snapshot: boolean;
  /** True when the series is computed from another rather than fetched. */
  reconstructed: boolean;
  /**
   * Bars whose high or low was widened to contain their own open and close.
   * Recorded rather than hidden: gold and FX feeds mix sources for extremes and
   * endpoints, so a non-zero count here is expected and auditable.
   */
  repairedBars: number;
  /** Bars discarded upstream for null, duplicate or non-finite values. */
  droppedBars: number;
  note?: string;
};

export type SeriesManifest = {
  generatedAt: string;
  series: ManifestEntry[];
};
