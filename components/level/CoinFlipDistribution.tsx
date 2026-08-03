"use client";

import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * What five coin flips look like, with the player's own Chapter 1 boss score marked on it.
 *
 * The binomial for five fair flips, computed here because it is four lines of arithmetic and a
 * committed artefact would be absurd for it:
 *
 *   0 right  1/32   3.1%        3 right  10/32  31.2%
 *   1 right  5/32  15.6%        4 right   5/32  15.6%
 *   2 right 10/32  31.2%        5 right   1/32   3.1%
 *
 * **The recall is display-only, and that is a rule rather than a convenience.** A grader cannot
 * read the store, `predictions["1-B"]` is absent on a fresh save, after `resetProgress` and in
 * private mode where storage degraded to memory — so a level whose *answer* depended on it would
 * be unanswerable for those players. The graded question is the arithmetic; this marker is
 * evidence beside it, and it degrades to a sentence saying so.
 *
 * A player who went five for five reads "3.1% of coin-flippers do this", which is the sentence
 * 1.B was built to earn.
 */

const ROUNDS = 5;

/** `C(5, k) / 32`, exact in floating point at these sizes. */
function binomial(k: number): number {
  const choose = [1, 5, 10, 10, 5, 1][k] ?? 0;
  return choose / 2 ** ROUNDS;
}

export function CoinFlipDistribution() {
  const hydrated = useHydrated();
  const predictions = useGameStore((state) => state.predictions);

  // `recordPrediction` stores the grade's own `detail`, which for 1.B is
  // `{ right: "3 of 5", accuracy: 60 }`. Read defensively: it is `unknown` by design, because
  // every kind's detail has a different shape and the store must not know any of them.
  const stored = predictions["1-B"];
  const accuracy =
    typeof stored === "object" &&
    stored !== null &&
    typeof (stored as { accuracy?: unknown }).accuracy === "number"
      ? (stored as { accuracy: number }).accuracy
      : null;
  const mine = accuracy === null ? null : Math.round((accuracy / 100) * ROUNDS);

  const peak = binomial(2);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-muted">
        five coin flips, all 32 equally likely outcomes
      </p>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          How often a fair coin gets each number of five calls right
        </caption>
        <thead>
          <tr className="font-mono text-xs text-muted">
            <th scope="col" className="py-1 text-left font-normal">
              right
            </th>
            <th scope="col" className="py-1 text-left font-normal">
              how often
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              chance
            </th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const p = binomial(k);
            const isMine = hydrated && mine === k;
            return (
              <tr key={k} className="border-t border-border/40">
                <th
                  scope="row"
                  className="py-1 pr-3 text-left font-normal"
                  style={{ color: isMine ? "var(--color-accent)" : undefined }}
                >
                  {k} of 5
                  {isMine ? (
                    <span className="ml-2 font-mono text-xs text-accent">you</span>
                  ) : null}
                </th>
                <td className="w-1/2 py-1 pr-3">
                  <div className="h-3 rounded-sm bg-bg">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(p / peak) * 100}%`,
                        backgroundColor: isMine
                          ? "var(--color-accent)"
                          : "var(--color-muted, #39424f)",
                      }}
                    />
                  </div>
                </td>
                <td className="py-1 text-right font-mono text-xs">
                  {(p * 100).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="max-w-prose text-xs text-muted">
        {!hydrated
          ? "Reading your Chapter 1 score…"
          : mine === null
            ? "No Chapter 1 boss score recorded, so nothing is marked — the arithmetic below is the same either way."
            : `You called ${mine} of 5 correctly in the Chapter 1 boss. A fair coin manages that ${(
                binomial(mine) * 100
              ).toFixed(1)}% of the time.`}
      </p>
    </div>
  );
}
