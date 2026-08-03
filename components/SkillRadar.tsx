"use client";

import { skillProfile, weakestSkills, type SkillReading } from "@/lib/levels/skills";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * Ten axes of the player's own progress, as a radar.
 *
 * Inline SVG rather than a chart library: it is ten points on a decagon, and the shared bundle is
 * already at 94% of its budget with a candle library in it.
 *
 * **Readable without colour, and without the shape.** The polygon is the summary; the list beside
 * it carries the same numbers as text with what to practise. That is not only the M11 accessibility
 * pass arriving early — a radar cannot say *why* an axis is short, and "expectancy, sample size,
 * and what a tuned backtest is worth" is the part a player can act on.
 *
 * **An unattempted axis is drawn at the centre and named as unattempted**, never as a zero. A
 * chapter scored badly and a chapter never opened are the same number of stars and completely
 * different facts, and telling somebody to practise a chapter they have not reached is worse than
 * saying nothing. `skillProfile` returns null for those and the shape closes through the centre.
 */

const SIZE = 240;
const CENTRE = SIZE / 2;
const RADIUS = SIZE / 2 - 28;
/** Grid rings, as fractions of the radius. Three, matching the three stars per level. */
const RINGS = [1 / 3, 2 / 3, 1];

function pointFor(index: number, count: number, fraction: number) {
  // Starting at twelve o'clock and going clockwise, so the first axis is where a reader looks.
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRE + Math.cos(angle) * RADIUS * fraction,
    y: CENTRE + Math.sin(angle) * RADIUS * fraction,
  };
}

function polygon(readings: readonly SkillReading[], fraction: (r: SkillReading) => number) {
  return readings
    .map((reading, i) => {
      const { x, y } = pointFor(i, readings.length, fraction(reading));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Radar({ readings }: { readings: SkillReading[] }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[15rem] shrink-0"
      role="img"
      aria-label="Your progress across the ten skills, listed in full beside this chart"
    >
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygon(readings, () => ring)}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {readings.map((reading, i) => {
        const { x, y } = pointFor(i, readings.length, 1);
        return (
          <line
            key={reading.axis}
            x1={CENTRE}
            y1={CENTRE}
            x2={x}
            y2={y}
            className="stroke-border"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={polygon(readings, (r) => r.value ?? 0)}
        className="fill-accent/20 stroke-accent"
        strokeWidth={2}
      />
      {readings.map((reading, i) => {
        const { x, y } = pointFor(i, readings.length, reading.value ?? 0);
        return (
          <circle
            key={reading.axis}
            cx={x}
            cy={y}
            r={reading.value === null ? 2 : 3}
            className={reading.value === null ? "fill-muted" : "fill-accent"}
          />
        );
      })}
    </svg>
  );
}

export function SkillRadar() {
  const hydrated = useHydrated();
  const progress = useGameStore((state) => state.progress);
  const journal = useGameStore((state) => state.journal);

  if (!hydrated) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Your skills</h2>
        <p className="text-sm text-muted">Reading your progress…</p>
      </section>
    );
  }

  const readings = skillProfile(progress, journal);
  const started = readings.filter((r) => r.value !== null);
  const weak = weakestSkills(readings).slice(0, 3);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Your skills</h2>
        <p className="max-w-prose text-sm text-muted">
          {started.length === 0
            ? "Nothing measured yet. Each chapter fills one of these in, and the last one comes from your own trades rather than from any score."
            : `${started.length} of ${readings.length} measured. Nine come from the chapters; discipline comes from your journal.`}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <Radar readings={readings} />

        <ul className="flex min-w-0 flex-1 flex-col gap-1 font-mono text-xs">
          {readings.map((reading) => (
            <li
              key={reading.axis}
              className="flex items-baseline justify-between gap-3 border-b border-border/30 pb-1"
            >
              <span className={reading.value === null ? "text-muted" : undefined}>
                {reading.label}
              </span>
              <span className="text-right text-muted">
                {reading.value === null
                  ? reading.detail
                  : `${Math.round(reading.value * 100)}% · ${reading.detail}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {weak.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
          <p className="font-mono text-xs text-muted">worth going back to</p>
          <ul className="flex flex-col gap-1 text-sm">
            {weak.map((reading) => (
              <li key={reading.axis} className="max-w-prose">
                <span className="font-medium">{reading.label}</span>{" "}
                <span className="text-muted">— {reading.practise}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
