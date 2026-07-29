"use client";

import Link from "next/link";
import { Stars } from "@/components/ui/Stars";
import { CHAPTERS } from "@/lib/levels/chapters";
import {
  chapterMaxStars,
  chapterStars,
  isChapterUnlocked,
} from "@/lib/levels/unlock";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

export function ChapterMap() {
  const hydrated = useHydrated();
  const progress = useGameStore((s) => s.progress);

  return (
    <ol className="flex flex-col gap-2">
      {CHAPTERS.map((chapter) => {
        // Before rehydration the store holds initial state, so every chapter but
        // the first would render locked and then pop open. Treating it as
        // "loading" avoids both the flicker and a hydration mismatch.
        const unlocked = hydrated ? isChapterUnlocked(chapter.n, progress) : false;
        const earned = hydrated ? chapterStars(chapter, progress) : 0;

        const inner = (
          <>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-muted">
                {String(chapter.n).padStart(2, "0")}
              </span>
              <span className="font-medium">{chapter.title}</span>
            </div>
            <p className="mt-1 pl-9 text-sm text-muted">{chapter.blurb}</p>
            <div className="mt-2 flex items-center gap-3 pl-9">
              {hydrated ? (
                <>
                  {/* A real count, not three glyphs scaled to a chapter's total:
                      squeezing 3 of 24 into three stars rounds to none, which
                      reads as "you have done nothing" right after clearing a boss. */}
                  <span className="font-mono text-sm text-accent">
                    ★ {earned}
                    <span className="text-muted">/{chapterMaxStars(chapter)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {unlocked
                      ? `${chapter.levelCount} levels + boss`
                      : "Clear the previous boss to unlock"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted">Loading progress…</span>
              )}
            </div>
          </>
        );

        return (
          <li key={chapter.n}>
            {unlocked ? (
              <Link
                href={`/chapter/${chapter.n}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {inner}
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="rounded-lg border border-border/60 bg-surface/40 p-4 opacity-60"
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
