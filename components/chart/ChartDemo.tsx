"use client";

import { useRef, useState } from "react";
import { Chart, type ChartHandle, type PriceScale } from "@/components/chart/Chart";
import { xToBarIndex, yToPrice } from "@/lib/chart/coords";
import { fixtureSeries } from "@/lib/chart/fixture-series";
import { barAt } from "@/lib/chart/types";

/**
 * Exercises the chart wrapper against the fixture series.
 *
 * Its real job is proving the coordinate handle works: the readout below the
 * chart is how bar-index conversion gets verified under pan and zoom before the
 * draw tools depend on it.
 */
export function ChartDemo() {
  const handleRef = useRef<ChartHandle | null>(null);
  const [priceScale, setPriceScale] = useState<PriceScale>("linear");
  const [probe, setProbe] = useState<string>("move the pointer over the chart");

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const handle = handleRef.current;
    if (!handle) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = xToBarIndex(
      handle.scale,
      event.clientX - rect.left,
      handle.bounds,
    );
    const price = yToPrice(handle.scale, event.clientY - rect.top);

    if (index === null) {
      setProbe("off the data");
      return;
    }
    const bar = barAt(fixtureSeries, index);
    setProbe(
      `bar ${index}` +
        (bar ? ` · close ${bar.c.toFixed(2)}` : "") +
        (price === null ? "" : ` · pointer ${price.toFixed(2)}`),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-muted">
          {fixtureSeries.id} · {fixtureSeries.t.length} bars
        </h2>
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

      <div
        onPointerMove={onPointerMove}
        onPointerLeave={() => setProbe("move the pointer over the chart")}
        className="rounded-lg border border-border bg-surface p-2"
      >
        <Chart ref={handleRef} series={fixtureSeries} priceScale={priceScale} />
      </div>

      <p className="font-mono text-xs text-muted" aria-live="polite">
        {probe}
      </p>
    </section>
  );
}
