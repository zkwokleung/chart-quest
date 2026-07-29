"use client";

import { useEffect, useRef, useState } from "react";
import { Chart, type ChartHandle, type PriceScale } from "@/components/chart/Chart";
import { xToBarIndex, yToPrice } from "@/lib/chart/coords";
import { fixtureSeries } from "@/lib/chart/fixture-series";
import { barAt, type Series, type SeriesId } from "@/lib/chart/types";
import { loadSeries } from "@/lib/data/load-series";

/**
 * Exercises the chart wrapper against the committed data.
 *
 * Its real job is proving the coordinate handle works: the readout below the
 * chart is how bar-index conversion gets verified under pan and zoom, which the
 * draw tools depend on. Worth pointing at a 4,000-bar series, not just the
 * 120-bar fixture.
 */

const CHOICES: (SeriesId | "FIXTURE-1d")[] = [
  "SPY-1d",
  "AAPL-1d-raw",
  "SPY-15m",
  "LAKE-1d",
  "BTCUSDT-4h",
  "EURUSD-1d",
  "GC-1d",
  "FIXTURE-1d",
];

export function ChartDemo() {
  const handleRef = useRef<ChartHandle | null>(null);
  const [seriesId, setSeriesId] = useState<SeriesId>("SPY-1d");
  const [fetched, setFetched] = useState<Series<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceScale, setPriceScale] = useState<PriceScale>("linear");
  const [probe, setProbe] = useState("move the pointer over the chart");

  // The fixture is synchronous, so it is derived rather than stored — storing it
  // would mean a setState inside the effect below for no reason.
  const isFixture = seriesId === "FIXTURE-1d";
  const series = isFixture ? fixtureSeries : fetched;

  useEffect(() => {
    if (isFixture) return;
    let cancelled = false;
    loadSeries(seriesId)
      .then((loaded) => {
        if (cancelled) return;
        setFetched(loaded);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetched(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId, isFixture]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const handle = handleRef.current;
    if (!handle || !series) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = xToBarIndex(handle.scale, event.clientX - rect.left, handle.bounds);
    const price = yToPrice(handle.scale, event.clientY - rect.top);

    if (index === null) {
      setProbe("off the data");
      return;
    }
    const bar = barAt(series, index);
    setProbe(
      `bar ${index}` +
        (bar ? ` · ${new Date(bar.t).toISOString().slice(0, 16)} · close ${bar.c}` : "") +
        (price === null ? "" : ` · pointer ${price.toFixed(2)}`),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Series</span>
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value as SeriesId)}
            className="rounded border border-border bg-surface px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {CHOICES.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <span className="font-mono text-xs text-muted">
          {series ? `${series.t.length} bars` : "loading…"}
        </span>
        <button
          type="button"
          onClick={() =>
            setPriceScale((m) => (m === "linear" ? "logarithmic" : "linear"))
          }
          className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          Scale: {priceScale}
        </button>
      </div>

      {error ? (
        <p className="rounded border border-down/50 bg-surface p-3 text-sm">{error}</p>
      ) : null}

      <div
        onPointerMove={onPointerMove}
        onPointerLeave={() => setProbe("move the pointer over the chart")}
        className="rounded-lg border border-border bg-surface p-2"
      >
        {series ? (
          // No key: the data effect handles a series swap via setData, so
          // remounting the chart would tear down and rebuild it for nothing.
          <Chart ref={handleRef} series={series} priceScale={priceScale} />
        ) : (
          <div className="grid h-[420px] place-items-center text-sm text-muted">
            Loading {seriesId}…
          </div>
        )}
      </div>

      <p className="font-mono text-xs text-muted" aria-live="polite">
        {probe}
      </p>
    </section>
  );
}
