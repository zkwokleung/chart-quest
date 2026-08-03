"use client";

import { useState } from "react";
import { specFor } from "@/lib/instruments/specs";
import type { KindProps } from "@/lib/levels/kind-module";

/**
 * The account, the risk, and a box per instrument.
 *
 * Native `<input type="number">`, which is keyboard-operable and announces its own role
 * without anything being written here — the same reasoning that made `spot-the-flaw` use real
 * checkboxes and `tune-param` a real range input.
 *
 * The instrument's contract terms are shown beside each row rather than hidden. 7.3's whole
 * subject is that one formula gives four different answers, and it cannot be if the number
 * that makes them different is off screen.
 */
export function SizingCalc({
  level,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"sizing-calc">) {
  const { prompt, equity, riskPct, positions, answer, outcomes } = level.config;
  const [values, setValues] = useState<(number | null)[]>(() => positions.map(() => null));

  const committed = grade !== null;
  const shown = committed ? (attempt?.values ?? values) : values;
  const overlay = grade?.reference.kind === "sizing" ? grade.reference : null;

  const money = (value: number) =>
    value.toLocaleString("en", { maximumFractionDigits: 2 });

  // 9.1 asks for an expectancy over an authored trade list, so there are no instrument rows
  // to render and no contract terms to show — just the trades and one box.
  if (answer === "expectancy") {
    const rs = outcomes ?? [];
    const wins = rs.filter((o) => o.r > 0).length;
    const correct = overlay?.correct[0];
    const right = overlay ? shown[0] === correct : null;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">{prompt}</p>

        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-muted">
          <span>{rs.length} trades</span>
          <span>
            {wins} won, {rs.length - wins} lost
          </span>
          <span>
            {rs.length === 0 ? "" : `${Math.round((wins / rs.length) * 100)}% hit rate`}
          </span>
        </div>

        <ol className="flex flex-wrap gap-1.5">
          {rs.map((outcome, i) => (
            <li
              key={i}
              title={outcome.label}
              className="rounded-md border border-border/60 px-2 py-1 font-mono text-xs"
              style={{
                color: outcome.r > 0 ? "var(--color-up)" : "var(--color-down)",
              }}
            >
              {outcome.r >= 0 ? "+" : ""}
              {outcome.r.toFixed(2)}
              {outcome.label ? <span className="ml-1 text-muted">*</span> : null}
            </li>
          ))}
        </ol>

        <label
          className={[
            "flex flex-wrap items-center gap-2 rounded-lg border bg-surface p-3 text-sm",
            right === true ? "border-up" : right === false ? "border-down" : "border-border",
          ].join(" ")}
        >
          <span className="text-muted">expectancy, in R per trade</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            disabled={committed}
            value={shown[0] ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              setValues([raw === "" ? null : Number(raw)]);
            }}
            aria-label="Expectancy in R per trade"
            className="w-40 rounded-md border border-border bg-bg px-2 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          />
          {overlay ? (
            <span className="font-mono text-xs text-muted">
              answer {correct === undefined ? "" : Number(correct.toFixed(4))}
            </span>
          ) : null}
        </label>

        {committed ? null : (
          <button
            type="button"
            disabled={shown[0] === null || shown[0] === undefined}
            onClick={() => onCommit({ kind: "sizing-calc", values, hintsUsed })}
            className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Commit
          </button>
        )}

        <p className="text-xs text-muted">
          An asterisk marks a trade that gapped — through the stop, or past the target. A stop
          does not protect you across a gap, which is why two of these losses ran past the 1R
          they promised.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-muted">
        <span>account {money(equity)}</span>
        <span>risk {(riskPct * 100).toFixed(2)}%</span>
        <span>
          budget {money(equity * riskPct)} — the most you may lose if the stop is hit
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {positions.map((position, index) => {
          const spec = specFor(position.instrument);
          const correct = overlay?.correct[index];
          const right = overlay ? shown[index] === correct : null;
          const distance = Math.abs(position.entry - position.stop);

          return (
            <li
              key={`${position.instrument}-${index}`}
              className={[
                "flex flex-col gap-2 rounded-lg border bg-surface p-3",
                right === true
                  ? "border-up"
                  : right === false
                    ? "border-down"
                    : "border-border",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {position.label ?? position.instrument}
                </span>
                <span className="font-mono text-xs text-muted">
                  {spec.class} · {money(spec.valuePerPoint)} {spec.quoteCcy} per point ·
                  lot {spec.lotSize}
                </span>
              </div>

              <p className="font-mono text-xs text-muted">
                entry {position.entry} · stop {position.stop} · distance{" "}
                {Number(distance.toPrecision(6))}
                {position.units === undefined ? null : (
                  <>
                    {" · holding "}
                    {position.units} {spec.unitLabel}
                  </>
                )}
              </p>

              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">
                  {answer === "units" ? `size in ${spec.unitLabel}` : "money at risk"}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  disabled={committed}
                  value={shown[index] ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setValues((current) =>
                      current.map((value, i) =>
                        i === index ? (raw === "" ? null : Number(raw)) : value,
                      ),
                    );
                  }}
                  aria-label={`${answer === "units" ? "Size" : "Risk"} for ${
                    position.label ?? position.instrument
                  }`}
                  className="w-40 rounded-md border border-border bg-bg px-2 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                />
                {overlay ? (
                  <span className="font-mono text-xs text-muted">
                    answer {correct} · risks {money(overlay.risked[index] ?? 0)}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ol>

      {committed ? null : (
        <button
          type="button"
          disabled={shown.every((value) => value === null)}
          onClick={() => onCommit({ kind: "sizing-calc", values, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit {positions.length > 1 ? "sizes" : "size"}
        </button>
      )}
    </div>
  );
}
