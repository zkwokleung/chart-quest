"use client";

import { useEffect, useRef, useState } from "react";
import { barAt } from "@/lib/chart/types";
import type { ReplayFeed } from "@/lib/replay/feed";
import {
  advanceBy,
  clampTick,
  SPEEDS,
  type Speed,
} from "@/lib/replay/playback";
import { useFeed } from "@/lib/replay/use-feed";
import { useReducedMotion } from "@/lib/store/use-reduced-motion";

type ReplayControlsProps = {
  feed: ReplayFeed;
  /** Locked once the level is graded, so the outcome cannot be re-run. */
  disabled?: boolean;
};

/**
 * Transport controls for a replay.
 *
 * Every advance goes through the feed, so the bars the player sees and the bars
 * any component can read stay the same set by construction.
 *
 * Reduced motion is a real accommodation here rather than a softer animation:
 * continuous bar-by-bar reveal *is* the motion, so when it is asked for, playback
 * is not offered at all and stepping becomes the only way forward. The level stays
 * completable either way, which is the requirement.
 */
export function ReplayControls({
  feed,
  disabled = false,
}: ReplayControlsProps) {
  const { at, done } = useFeed(feed);
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const canPlay = !disabled && !reducedMotion;

  // Playback is a time accumulator, not a frame counter: `advanceBy` carries the
  // remainder so speed means the same thing at 30fps and 120fps. Cleaned up on
  // unmount and whenever playback stops — the M2 renderer crash was a cleanup
  // running late against a chart that had already gone.
  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || !canPlay) return;

    let previous: number | null = null;
    let carryMs = 0;

    const tick = (now: number) => {
      if (previous !== null) {
        const step = advanceBy(clampTick(now - previous), speed, carryMs);
        carryMs = step.carryMs;
        if (step.bars > 0) feed.step(step.bars);
      }
      previous = now;
      if (feed.done) {
        setPlaying(false);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [playing, canPlay, speed, feed]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    switch (event.key) {
      case " ":
        if (!canPlay) return;
        event.preventDefault();
        setPlaying((p) => !p);
        break;
      case "ArrowRight":
        event.preventDefault();
        setPlaying(false);
        feed.step(step);
        break;
      case "ArrowLeft":
        event.preventDefault();
        setPlaying(false);
        feed.step(-step);
        break;
      case "Home":
        event.preventDefault();
        setPlaying(false);
        feed.reset();
        break;
      case "End":
        event.preventDefault();
        setPlaying(false);
        feed.seek(feed.last);
        break;
      default:
        break;
    }
  }

  const bar = barAt(feed.visible(), at);
  const date = bar
    ? new Date(bar.t).toISOString().slice(0, 16).replace("T", " ")
    : "—";
  const total = feed.last - feed.first;
  const shown = at - feed.first;

  return (
    <div
      role="group"
      aria-label="Replay controls. Space plays and pauses, arrows step, shift for ten bars, home rewinds, end reveals the rest."
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {canPlay ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={done && !playing}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {playing ? "❙❙ Pause" : "▶ Play"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            feed.step(1);
          }}
          disabled={disabled || done}
          className="rounded border border-border px-3 py-2 text-sm hover:border-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          Step →
        </button>

        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            feed.step(10);
          }}
          disabled={disabled || done}
          className="rounded border border-border px-3 py-2 text-sm hover:border-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          +10
        </button>

        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            feed.reset();
          }}
          disabled={disabled}
          className="rounded border border-border px-3 py-2 text-sm hover:border-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          ↺ Rewind
        </button>

        {canPlay ? (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Speed"
          >
            {SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSpeed(option)}
                aria-pressed={speed === option}
                className={[
                  "rounded border px-2 py-1.5 font-mono text-xs",
                  speed === option
                    ? "border-accent text-fg"
                    : "border-border text-muted hover:border-muted",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                ].join(" ")}
              >
                {option}×
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-3">
        <span className="sr-only">Scrub the replay</span>
        <input
          type="range"
          min={feed.first}
          max={feed.last}
          value={at}
          disabled={disabled}
          onChange={(event) => {
            setPlaying(false);
            feed.seek(Number(event.target.value));
          }}
          className="w-full accent-[var(--color-accent)]"
        />
      </label>

      <p className="font-mono text-xs text-muted" aria-live="polite">
        bar {at} · {date} · {shown} of {total} revealed
        {done ? " · end" : ""}
      </p>
    </div>
  );
}
