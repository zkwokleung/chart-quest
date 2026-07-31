"use client";

import { useRef, useState } from "react";
import type { ChartHandle } from "@/components/chart/Chart";
import type { RenderableDrawing } from "@/components/chart/DrawingPrimitive";
import { ReplayControls } from "@/components/chart/ReplayControls";
import { FeedChart } from "@/components/level/FeedChart";
import { yToPrice } from "@/lib/chart/coords";
import { barAt } from "@/lib/chart/types";
import type { KindProps } from "@/lib/levels/kind-module";
import type { LevelSlice } from "@/lib/levels/schema";
import type { ReplayFeed } from "@/lib/replay/feed";
import { useFeed } from "@/lib/replay/use-feed";
import { atr } from "@/lib/ta/atr";

type Placing = "stop" | "target";

/**
 * Place a trade, then watch the market decide.
 *
 * The player advances the replay to where they want in, places a stop and a
 * target, and commits. Entry is the close of whatever bar the replay is showing —
 * they choose *when*, and the fill is the price that was on screen, which is why
 * `simulate` derives it rather than accepting one.
 *
 * Nothing here can see past the reveal point: the only price data it reads comes
 * from `feed.visible()`.
 */
export function ReplayTrade(props: KindProps<"replay-trade">) {
  const slice = props.level.data[0];
  const feed = props.feeds[0];
  // Guarded out here so the inner component can call hooks unconditionally, the
  // same split `mark-bars` uses.
  if (!slice || !feed) return null;
  return <TradeOnChart {...props} slice={slice} feed={feed} />;
}

function TradeOnChart({
  level,
  feed,
  slice,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"replay-trade"> & { feed: ReplayFeed; slice: LevelSlice }) {
  const handleRef = useRef<ChartHandle | null>(null);
  const { at, series } = useFeed(feed);

  const [stop, setStop] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [placing, setPlacing] = useState<Placing>("stop");
  const [reason, setReason] = useState("");

  const committed = grade !== null;
  const shown = committed ? attempt : null;
  const entryBar = shown?.entryBar ?? at;
  const entry = barAt(series, entryBar)?.c ?? null;

  const activeStop = shown?.stop ?? stop;
  const activeTarget = shown?.target ?? target;

  const long = level.config.side === "long";
  const volatility = atr(series, at, level.config.atrPeriod ?? 14);

  function place(event: React.PointerEvent<HTMLDivElement>) {
    if (committed) return;
    const handle = handleRef.current;
    if (!handle) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const price = yToPrice(handle.scale, event.clientY - rect.top);
    if (price === null) return;
    if (placing === "stop") {
      setStop(price);
      setPlacing("target");
    } else {
      setTarget(price);
      setPlacing("stop");
    }
  }

  function nudge(which: Placing, direction: 1 | -1) {
    if (committed) return;
    const step = (volatility || (entry ?? 1) * 0.005) * 0.1 * direction;
    const current = which === "stop" ? stop : target;
    const base =
      current ??
      (entry === null
        ? 0
        : which === "stop"
          ? long
            ? entry - (volatility || entry * 0.01)
            : entry + (volatility || entry * 0.01)
          : long
            ? entry + (volatility || entry * 0.01) * 2
            : entry - (volatility || entry * 0.01) * 2);
    if (which === "stop") setStop(base + step);
    else setTarget(base + step);
  }

  if (entry === null) return null;

  const drawings: RenderableDrawing[] = [
    { drawing: { shape: "level", price: entry }, role: "entry" },
  ];
  if (activeStop !== null)
    drawings.push({
      drawing: { shape: "level", price: activeStop },
      role: "stop",
    });
  if (activeTarget !== null)
    drawings.push({
      drawing: { shape: "level", price: activeTarget },
      role: "target",
    });
  drawings.push({ drawing: level.target.structure, role: "reference" });

  const risk =
    activeStop === null ? null : long ? entry - activeStop : activeStop - entry;
  const rr =
    risk === null || risk <= 0 || activeTarget === null
      ? null
      : (long ? activeTarget - entry : entry - activeTarget) / risk;

  const ready =
    activeStop !== null &&
    risk !== null &&
    risk > 0 &&
    reason.trim().length >= 8;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{level.config.prompt}</p>

      <div
        onPointerDown={place}
        className={committed ? "" : "cursor-crosshair"}
      >
        <FeedChart
          slice={slice}
          feed={feed}
          ref={handleRef}
          height={400}
          showVolume={false}
          drawings={drawings}
          yAxis={level.yAxis}
        />
      </div>

      {committed ? null : <ReplayControls feed={feed} />}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
        <p className="font-mono text-xs text-muted" aria-live="polite">
          entry {entry.toFixed(2)} at bar {at}
          {activeStop === null
            ? " · no stop yet"
            : ` · stop ${activeStop.toFixed(2)}`}
          {activeTarget === null ? "" : ` · target ${activeTarget.toFixed(2)}`}
          {risk !== null && risk > 0 ? ` · risk ${risk.toFixed(2)}` : ""}
          {rr === null ? "" : ` · ${rr.toFixed(2)}:1`}
        </p>

        {committed ? null : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">
                Click the chart to set your {placing}, or nudge:
              </span>
              {(["stop", "target"] as const).map((which) => (
                <span key={which} className="flex items-center gap-1">
                  <span className="font-mono text-xs text-muted">{which}</span>
                  <button
                    type="button"
                    onClick={() => nudge(which, 1)}
                    aria-label={`Raise ${which}`}
                    className="rounded border border-border px-2 py-1 text-xs hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(which, -1)}
                    aria-label={`Lower ${which}`}
                    className="rounded border border-border px-2 py-1 text-xs hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    ↓
                  </button>
                </span>
              ))}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              {/* Required, not optional colour. Chapter 9.6 reads these back against
                  the player's own results, and it can only do that if the first
                  trade already carried one. */}
              <span>Why are you taking this trade?</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="What in the chart makes this worth risking money on?"
                className="rounded border border-border bg-bg p-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>

            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                onCommit({
                  kind: "replay-trade",
                  entryBar: at,
                  stop: activeStop ?? 0,
                  target: activeTarget,
                  reason: reason.trim(),
                  hintsUsed,
                })
              }
              className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Take the trade
            </button>
            {ready ? null : (
              <p className="text-xs text-muted">
                {activeStop === null || risk === null || risk <= 0
                  ? `Place a stop ${long ? "below" : "above"} your entry.`
                  : "Say why in a sentence — the journal keeps it."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
