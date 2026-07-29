"use client";

import { createElement, useEffect, useState } from "react";
import Link from "next/link";
import { Feedback } from "@/components/level/Feedback";
import { Hints } from "@/components/level/Hints";
import type { Series } from "@/lib/chart/types";
import { loadSeries } from "@/lib/data/load-series";
import { getChapter, levelIds } from "@/lib/levels/chapters";
import type { Grade } from "@/lib/levels/grade";
import { componentFor, gradeAny } from "@/lib/levels/kinds";
import { isAuthored } from "@/lib/levels/registry";
import type { AnyLevel, Attempt, LevelKind } from "@/lib/levels/schema";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * Runs one level.
 *
 * Dispatches through the kind registry and contains no kind-specific logic. That
 * rule is what keeps ~73 levels from becoming ~73 components — if a branch on
 * `level.kind` ever appears here, the abstraction has failed.
 */
export function LevelPlayer({ level }: { level: AnyLevel }) {
  const hydrated = useHydrated();
  const recordAttempt = useGameStore((s) => s.recordAttempt);
  const recordPrediction = useGameStore((s) => s.recordPrediction);

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
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  function commit(submitted: Attempt[LevelKind]) {
    if (!data || grade) return;
    const result = gradeAny(level, submitted, data);
    setAttempt(submitted);
    setGrade(result);
    recordAttempt(level.id, result.score, result.stars);
    // Some levels store the player's answer for a much later chapter to hand
    // back — the coin-flip score in 1.B is recalled in 9.2.
    if (result.detail) recordPrediction(level.id, result.detail);
  }

  function retry() {
    setGrade(null);
    setAttempt(null);
    setHintsUsed(0);
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

  if (!data || !hydrated) {
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
        data,
        hintsUsed,
        grade,
        attempt,
        onCommit: commit,
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
