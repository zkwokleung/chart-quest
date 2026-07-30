"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Feedback } from "@/components/level/Feedback";
import { Hints } from "@/components/level/Hints";
import type { Series } from "@/lib/chart/types";
import { loadSeries } from "@/lib/data/load-series";
import { getChapter, levelIds } from "@/lib/levels/chapters";
import type { Grade } from "@/lib/levels/grade";
import {
  componentFor,
  gradeAny,
  journalEntryFor,
  primedBarsFor,
  revealHorizonFor,
} from "@/lib/levels/kinds";
import { getLevel, isAuthored } from "@/lib/levels/registry";
import type { AnyLevel, Attempt, LevelKind } from "@/lib/levels/schema";
import { createLevelFeed, type ReplayFeed } from "@/lib/replay/feed";
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
  const level = getLevel(levelId);
  if (!level) return <NotAuthored levelId={levelId} />;
  return <Player level={level} />;
}

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
  const logTrade = useGameStore((s) => s.logTrade);

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
    return level.data.map((slice, i) => {
      const series = data[i];
      if (!series)
        throw new Error(`${level.id}: no series loaded for slice ${i}`);
      return createLevelFeed(series, slice, { horizon, primedBars });
    });
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
    const trade = journalEntryFor(level, submitted, result);
    if (trade) logTrade(trade);
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
          dynamic lookup is a static component. */}
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
