"use client";

import { useMemo, useState } from "react";
import { FeedChart } from "@/components/level/FeedChart";
import type { KindProps } from "@/lib/levels/kind-module";
import { yAxisFor } from "@/lib/levels/y-axis";
import { runSequence } from "./grade";

/**
 * Ten decisions, one at a time, with the account moving underneath.
 *
 * Revealed trade by trade rather than all at once, because that is the thing being taught: you
 * size trade six without knowing what trade six does, and after five results have already moved
 * the account. Showing the whole sequence up front would turn a discipline exercise into a
 * puzzle with a lookup table.
 *
 * **The account has to actually move, and for a while it did not.** An earlier version read the
 * running equity off `grade`, which is null until all ten are committed — so every decision was
 * offered against the starting 25,000 and the level's own prompt ("you will see how it went
 * before the next one") was false. No unit test could see it: the grader was right, and the
 * component was showing a number the grader never produced.
 *
 * So the decided prefix is run through the grader's own `runSequence` rather than simulated
 * here, over `feeds[0].visible()` rather than over `truth` — which `seal.test.ts` reserves for
 * `composite`. Only steps the player has already sized are read, so nothing on screen is ahead
 * of the decision being asked for.
 */
export function TradeSequence({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"trade-sequence">) {
  const { prompt, equity, trades, riskChoices } = level.config;
  const [risks, setRisks] = useState<number[]>([]);

  const committed = grade !== null;
  const chosen = committed ? (attempt?.risks ?? risks) : risks;
  const overlay = grade?.reference.kind === "sequence" ? grade.reference : null;

  const slice = level.data[0];
  const feed = feeds[0];
  const at = chosen.length;
  const done = at >= trades.length;

  const inProgress = useMemo(() => {
    if (committed || !feed || at === 0) return null;
    return runSequence({ kind: "trade-sequence", risks: chosen, hintsUsed }, level, [
      feed.visible(),
    ]);
  }, [committed, feed, at, chosen, hintsUsed, level]);

  // Only the trades already sized. `runSequence` returns a step per authored trade, and the
  // ones past `at` are the future — they carry a real R even at zero risk.
  const revealed = overlay
    ? { steps: overlay.steps, escalations: overlay.escalations }
    : inProgress
      ? { steps: inProgress.steps.slice(0, at), escalations: inProgress.escalations }
      : null;

  const money = (value: number) =>
    value.toLocaleString("en", { maximumFractionDigits: 0 });

  function choose(risk: number) {
    const next = [...risks, risk];
    setRisks(next);
    if (next.length >= trades.length) {
      onCommit({ kind: "trade-sequence", risks: next, hintsUsed });
    }
  }

  /** The account after the trades the player has already sized. */
  const runningEquity = revealed?.steps[at - 1]?.equity ?? equity;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      {slice && feed ? (
        <FeedChart
          slice={slice}
          feed={feed}
          height={260}
          showVolume={false}
          yAxis={yAxisFor(level)}
        />
      ) : null}

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-muted">
        <span>start {money(equity)}</span>
        <span aria-live="polite">
          {committed
            ? `finished ${money(overlay?.steps.at(-1)?.equity ?? equity)}`
            : `trade ${Math.min(at + 1, trades.length)} of ${trades.length} · account ${money(runningEquity)}`}
        </span>
        {(overlay ?? inProgress)?.ruined ? (
          <span style={{ color: "var(--color-down)" }}>account through the floor</span>
        ) : null}
      </div>

      {!committed && !done ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm">
            {trades[at]?.label ?? `Trade ${at + 1}`} — how much of the account do you
            risk?
          </p>
          <p className="font-mono text-xs text-muted">
            you have {money(runningEquity)}; the stop and target are already set, so this
            is the only decision
          </p>
          <div className="flex flex-wrap gap-2">
            {riskChoices.map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => choose(risk)}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {(risk * 100).toFixed(risk < 0.01 ? 1 : 0)}%
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {revealed ? (
        <ol className="flex flex-col gap-1">
          {revealed.steps.map((step, i) => (
            <li
              key={i}
              className={[
                "flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 font-mono text-xs",
                revealed.escalations.includes(i)
                  ? "border-down"
                  : "border-border/60",
              ].join(" ")}
            >
              <span>
                {trades[i]?.label ?? `Trade ${i + 1}`} · risked{" "}
                {(step.risk * 100).toFixed(step.risk < 0.01 ? 1 : 0)}%
              </span>
              <span style={{ color: step.r >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
                {step.r >= 0 ? "+" : ""}
                {step.r.toFixed(2)}R
              </span>
              <span className="text-muted">{money(step.equity)}</span>
              {revealed.escalations.includes(i) ? (
                <span style={{ color: "var(--color-down)" }}>
                  raised after a loss
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
