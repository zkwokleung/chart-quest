"use client";

import { createElement, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Feedback } from "@/components/level/Feedback";
import { Hints } from "@/components/level/Hints";
import type { Series, Timeframe } from "@/lib/chart/types";
import { loadSeries } from "@/lib/data/load-series";
import { getChapter, levelIds } from "@/lib/levels/chapters";
import type { Grade } from "@/lib/levels/grade";
import {
  componentFor,
  gradeAny,
  journalEntriesFor,
  primedBarsFor,
  revealHorizonFor,
} from "@/lib/levels/kinds";
import { isAuthored, loadLevel } from "@/lib/levels/registry";
import type { AnyLevel, Attempt, LevelKind, LevelSlice } from "@/lib/levels/schema";
import { createLevelFeed, type ReplayFeed } from "@/lib/replay/feed";
import { linkFeeds } from "@/lib/replay/linked";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * Runs one level.
 *
 * Takes an id rather than a level, and resolves it from the registry here on the
 * client. Levels carry misconception `test` functions, and functions cannot cross
 * the server/client boundary — but they also never need to: level content is
 * static code the client can import directly.
 *
 * Dispatches through the kind registry and contains no kind-specific logic. That
 * rule is what keeps ~73 levels from becoming ~73 components — if a branch on
 * `level.kind` ever appears here, the abstraction has failed.
 */
export function LevelPlayer({ levelId }: { levelId: string }) {
  // Two stages rather than one: the level's own chunk, then the series it names.
  // They cannot be parallelised, because which series to fetch is a fact inside the
  // level — and the alternative, duplicating the series ids into the static index,
  // would mean two places to keep in step for one saved round trip on a file the
  // CDN is already serving.
  // The loaded id travels with the result rather than being reset in the effect
  // body. Clearing state synchronously there would work and is disallowed for a
  // reason — it cascades an extra render — so a result for the wrong id is simply
  // read as "still loading".
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLevel(levelId)
      .then((level) => {
        if (!cancelled) setResult({ id: levelId, level });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            id: levelId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [levelId]);

  const current = result?.id === levelId ? result : null;

  if (!current)
    return <p className="text-sm text-muted">Loading level&hellip;</p>;
  if (current.error) {
    return (
      <p className="rounded border border-down/50 bg-surface p-4 text-sm">
        Could not load this level: {current.error}
      </p>
    );
  }
  if (!current.level) return <NotAuthored levelId={levelId} />;
  return <Player level={current.level} />;
}

type LoadResult = {
  id: string;
  level?: AnyLevel | undefined;
  error?: string;
};

function NotAuthored({ levelId }: { levelId: string }) {
  const chapter = levelId.split("-")[0] ?? "1";
  return (
    <>
      <Link
        href={`/chapter/${chapter}`}
        className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        ← Chapter {chapter}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Level {levelId}</h1>
      <p className="max-w-prose text-muted">
        Not authored yet. This chapter arrives in a later milestone.
      </p>
    </>
  );
}

function Player({ level }: { level: AnyLevel }) {
  const hydrated = useHydrated();
  const recordAttempt = useGameStore((s) => s.recordAttempt);
  const recordPrediction = useGameStore((s) => s.recordPrediction);
  const logTrades = useGameStore((s) => s.logTrades);

  // The full series stays here and goes to the grader. Kind components get feeds
  // built from it, which is the only thing standing between a player and the
  // answer on a replay level — see lib/replay/feed.ts.
  const [data, setData] = useState<Series<string>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [attempt, setAttempt] = useState<Attempt[LevelKind] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // One request per slice; loadSeries dedupes and caches, so a level naming the
    // same series twice does not fetch it twice.
    Promise.all(level.data.map((slice) => loadSeries(slice.series)))
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  // One feed per slice, rebuilt when the data or the level changes. `retry`
  // bumps a nonce so a replayed level starts from a fresh reveal point rather
  // than wherever the last attempt left the bars.
  const [feedNonce, setFeedNonce] = useState(0);
  const feeds = useMemo<ReplayFeed[] | null>(() => {
    if (!data) return null;
    void feedNonce;
    // How far a kind may reveal, and how much it starts with, are the kind's own
    // business — asked of the registry so nothing here branches on level.kind.
    const horizon = revealHorizonFor(level);
    const primedBars = primedBarsFor(level) ?? undefined;
    const built = level.data.map((slice, i) => {
      const series = data[i];
      if (!series)
        throw new Error(`${level.id}: no series loaded for slice ${i}`);
      return createLevelFeed(series, slice, { horizon, primedBars });
    });

    // A multi-timeframe level gets one transport, not two.
    //
    // Decided from the *data* rather than from the kind, which is why there is still no
    // branch on `level.kind` here: two slices of the same instrument at different bar
    // sizes is a multi-timeframe level, whatever kind is reading it. The finer timeframe
    // drives and the coarser one follows, so the coarse pane cannot show a bar that has
    // not finished — see `lib/replay/linked.ts` for why that is the whole problem.
    //
    // Harmless for a kind that does not replay: both feeds are fully revealed, and the
    // follower simply sits at its last *closed* bar, which is the honest position anyway.
    const pair = linkablePair(level.data, data);
    if (pair) {
      const { driver, follower } = pair;
      const series = data[follower];
      const slice = level.data[follower];
      if (series && slice && built[driver]) {
        built[follower] = linkFeeds(built[driver], {
          series,
          from: slice.from,
          to: slice.to - 1 + horizon,
        });
      }
    }
    return built;
  }, [data, level, feedNonce]);

  function commit(submitted: Attempt[LevelKind]) {
    if (!data || grade) return;
    const result = gradeAny(level, submitted, data);
    setAttempt(submitted);
    setGrade(result);
    recordAttempt(level.id, result.score, result.stars);
    // Some levels store the player's answer for a much later chapter to hand
    // back — the coin-flip score in 1.B is recalled in 9.2.
    if (result.detail) recordPrediction(level.id, result.detail);
    // Asked of the kind, not decided here: kinds that produce a trade say so, and
    // this file stays free of any branch on level.kind.
    // Plural: a boss writes one entry per replay stage and 7.B writes ten. Still no branch on
    // `level.kind` here — the kinds say what they produce.
    const trades = journalEntriesFor(level, submitted, result);
    if (trades.length > 0) logTrades(trades);
  }

  function retry() {
    setGrade(null);
    setAttempt(null);
    setHintsUsed(0);
    setFeedNonce((n) => n + 1);
  }

  const chapter = getChapter(level.chapter);
  const ids = chapter ? levelIds(chapter) : [];
  const position = ids.indexOf(level.id);
  const nextId = position >= 0 ? ids[position + 1] : undefined;
  const nextHref = nextId && isAuthored(nextId) ? `/level/${nextId}` : null;

  if (error) {
    return (
      <p className="rounded border border-down/50 bg-surface p-4 text-sm">
        Could not load this level&rsquo;s data: {error}
      </p>
    );
  }

  if (!data || !feeds || !hydrated) {
    return <p className="text-sm text-muted">Loading level&hellip;</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/chapter/${level.chapter}`}
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← Chapter {level.chapter}
        </Link>
        <p className="font-mono text-xs text-muted">Level {level.id}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{level.title}</h1>
        <p className="max-w-prose leading-relaxed text-muted">{level.brief}</p>
      </header>

      {/* createElement rather than a capitalised local: the component genuinely
          varies by kind, and this is the form that says so without pretending a
          dynamic lookup is a static component.

          Suspense because the component now arrives in its own chunk — a
          `classify` level does not ship `ReplayTrade`, so the one it needs is
          fetched when it renders. The fallback matches the level-loading line, as
          from the player's side it is the same wait continuing. */}
      <Suspense fallback={<p className="text-sm text-muted">Loading level&hellip;</p>}>
        {createElement(componentFor(level), {
          level,
          feeds,
          hintsUsed,
          grade,
          attempt,
          onCommit: commit,
          // Only the composite, which grades its own stages as the player finishes
          // them. Every other kind is sealed to what its feed has revealed.
          ...(level.kind === "composite" ? { truth: data } : {}),
        })}
      </Suspense>

      <Hints
        hints={level.hints}
        used={hintsUsed}
        locked={grade !== null}
        onTake={() => setHintsUsed((n) => Math.min(level.hints.length, n + 1))}
      />

      {grade ? (
        <Feedback
          level={level}
          grade={grade}
          nextHref={nextHref}
          onRetry={retry}
        />
      ) : null}
    </div>
  );
}

/** Bar sizes, coarsest last, so "which of these two is finer" has one answer. */
const GRANULARITY: Record<Timeframe, number> = {
  "15m": 0,
  "1h": 1,
  "4h": 2,
  "1d": 3,
};

/**
 * The two slices to link, or null when a level is not multi-timeframe.
 *
 * Requires the *same instrument* at two different bar sizes. Two slices of different
 * instruments are a comparison — 1.6 shows three markets, 5.5 shows three — and linking
 * those would be meaningless, since one has no idea when the other's bar closed.
 *
 * Deliberately only handles exactly two such slices. A three-timeframe level would need a
 * chain and no level asks for one; returning null rather than guessing keeps the failure
 * loud if that changes.
 */
export function linkablePair(
  slices: readonly LevelSlice[],
  data: readonly Series<string>[],
): { driver: number; follower: number } | null {
  if (slices.length !== 2) return null;
  const [a, b] = [data[0], data[1]];
  if (!a || !b) return null;

  const instrument = (id: string) => id.replace(/-(1d|4h|1h|15m)$/, "");
  if (instrument(a.id) !== instrument(b.id)) return null;
  if (GRANULARITY[a.tf] === GRANULARITY[b.tf]) return null;

  return GRANULARITY[a.tf] < GRANULARITY[b.tf]
    ? { driver: 0, follower: 1 }
    : { driver: 1, follower: 0 };
}
