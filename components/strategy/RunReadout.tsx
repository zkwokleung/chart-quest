"use client";

import type { Objective } from "@/lib/backtest/guards";
import type { OverlaySpec } from "@/lib/levels/schema";

/**
 * A backtest result, per market, with every figure beside its sample size.
 *
 * **The one rule this component exists to keep: no number without its `n`.** Chapter 9 spent seven
 * levels on it and Chapter 10 is where the player would most like to forget it, because now the
 * flattering figure is their own. So `trades` is the first column and an underpowered row says so in
 * words rather than being left to be noticed.
 *
 * The verdict vocabulary is `passed | refuted | inconclusive`, and there is deliberately no
 * "confirmed": the out-of-sample holdback cannot produce thirty trades on any daily series in the
 * spine, so a sample that size can rule a strategy out and cannot rule one in. Saying otherwise in a
 * green banner would undo the chapter.
 */

type Run = Extract<OverlaySpec, { kind: "run" }>;

const r = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;

const VERDICTS: Record<Run["verdict"], { label: string; tone: string }> = {
  passed: { label: "cleared the objective", tone: "border-up text-fg" },
  refuted: { label: "refuted", tone: "border-down text-fg" },
  inconclusive: { label: "too little to say", tone: "border-border text-muted" },
};

/** The objective in words, so the verdict can be checked against what was asked. */
function stateObjective(objective: Objective): string {
  const parts: string[] = [];
  parts.push(
    `expectancy above ${(objective.minExpectancy ?? 0).toFixed(2)}R a trade`,
  );
  if (objective.minTrades) parts.push(`over at least ${objective.minTrades} trades`);
  if (objective.minAssetsPassing && objective.minAssetsPassing > 1) {
    parts.push(`on at least ${objective.minAssetsPassing} markets`);
  }
  if (objective.minClassesPassing && objective.minClassesPassing > 0) {
    parts.push(
      `spanning at least ${objective.minClassesPassing} asset ${
        objective.minClassesPassing === 1 ? "class" : "classes"
      }`,
    );
  }
  return parts.join(", ");
}

/** Cumulative R as a sparkline. Inline SVG — ten to a few hundred points needs no library. */
function EquityCurve({ equityR }: { equityR: number[] }) {
  if (equityR.length < 2) return null;
  const width = 320;
  const height = 72;
  const low = Math.min(0, ...equityR);
  const high = Math.max(0, ...equityR);
  const span = high - low || 1;
  const x = (i: number) => (i / (equityR.length - 1)) * width;
  const y = (value: number) => height - ((value - low) / span) * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-[22rem]"
      role="img"
      aria-label={`Cumulative return, ending at ${equityR.at(-1)!.toFixed(2)}R over ${equityR.length} trades`}
    >
      <line
        x1={0}
        y1={y(0)}
        x2={width}
        y2={y(0)}
        className="stroke-border"
        strokeWidth={1}
      />
      <polyline
        points={equityR.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(" ")}
        className="fill-none stroke-accent"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function RunReadout({
  run,
  objective,
  holdback = 0,
}: {
  run: Run;
  objective: Objective;
  holdback?: number;
}) {
  const verdict = VERDICTS[run.verdict];
  const showsBaseline = run.perAsset.some((asset) => asset.baselineR !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-lg border ${verdict.tone} bg-surface p-3`}>
        <p className="font-mono text-xs text-muted">
          asked for: {stateObjective(objective)}
        </p>
        <p className="mt-1 text-sm font-medium">{verdict.label}</p>
        <p className="mt-1 max-w-prose text-sm text-muted">{run.reason}</p>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Result per market</caption>
        <thead>
          <tr className="font-mono text-xs text-muted">
            <th scope="col" className="py-1 text-left font-normal">
              market
            </th>
            {/* First, deliberately: every figure to its right is meaningless without it. */}
            <th scope="col" className="py-1 text-right font-normal">
              n
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              expectancy
            </th>
            {showsBaseline ? (
              <th scope="col" className="py-1 text-right font-normal">
                doing nothing
              </th>
            ) : null}
            <th scope="col" className="py-1 text-right font-normal">
              total
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              worst run
            </th>
          </tr>
        </thead>
        <tbody>
          {run.perAsset.map((asset) => (
            <tr key={asset.asset} className="border-t border-border/40">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {asset.asset}
                {asset.underpowered ? (
                  <span className="ml-2 font-mono text-xs text-muted">
                    too few to say
                  </span>
                ) : run.passing.includes(asset.asset) ? (
                  <span className="ml-2 font-mono text-xs text-up">cleared</span>
                ) : null}
              </th>
              <td className="py-1 text-right font-mono text-xs">{asset.trades}</td>
              <td className="py-1 text-right font-mono text-xs text-muted">
                {r(asset.expectancy)}
              </td>
              {showsBaseline ? (
                <td className="py-1 text-right font-mono text-xs text-muted">
                  {r(asset.baselineR)}
                </td>
              ) : null}
              <td className="py-1 text-right font-mono text-xs">{r(asset.totalR)}</td>
              <td className="py-1 text-right font-mono text-xs text-muted">
                {asset.maxDrawdownR.toFixed(2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EquityCurve equityR={run.equityR} />

      <div className="flex flex-col gap-1 font-mono text-xs text-muted">
        {run.classesPassing.length > 0 ? (
          <p>
            Asset classes cleared: {run.classesPassing.join(", ")}. Three equities are one
            asset class, which is why this line counts classes rather than markets.
          </p>
        ) : null}
        {holdback > 0 ? (
          <p>
            {holdback} window{holdback === 1 ? "" : "s"} held back from this run. Nothing you
            do here can tune on them.
          </p>
        ) : null}
        {showsBaseline ? (
          <p>
            &ldquo;Doing nothing&rdquo; is the same stop and target with no entry condition at all —
            a trade on every bar the position was flat. On this data that pays +0.27R a trade on the
            index and +0.40R on Apple, so a positive expectancy is not on its own an edge. Your entry
            has to beat that column.
          </p>
        ) : null}
        {run.perAsset.some((a) => a.underpowered) ? (
          <p>
            A market marked &ldquo;too few to say&rdquo; has neither passed nor failed. A sample
            that size can rule a strategy out; it cannot rule one in.
          </p>
        ) : null}
      </div>
    </div>
  );
}
