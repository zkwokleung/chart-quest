"use client";

import Link from "next/link";
import { Stars } from "@/components/ui/Stars";
import { levelIds, type Chapter } from "@/lib/levels/chapters";
import { isLevelUnlocked } from "@/lib/levels/unlock";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

export function LevelList({ chapter }: { chapter: Chapter }) {
  const hydrated = useHydrated();
  const progress = useGameStore((s) => s.progress);
  const ids = levelIds(chapter);

  return (
    <ol className="flex flex-col gap-1.5">
      {ids.map((id, index) => {
        const isBoss = id.endsWith("-B");
        const unlocked = hydrated && isLevelUnlocked(chapter, id, progress);
        const stars = progress[id]?.stars ?? 0;
        const label = isBoss ? "Boss" : `Level ${index + 1}`;

        const body = (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-muted">{id}</span>
              <span className={isBoss ? "font-medium text-accent" : ""}>
                {label}
              </span>
            </span>
            {hydrated ? (
              unlocked ? (
                <Stars earned={stars} />
              ) : (
                <span className="text-xs text-muted">Locked</span>
              )
            ) : (
              <span className="text-xs text-muted">…</span>
            )}
          </div>
        );

        return (
          <li key={id}>
            {unlocked ? (
              <Link
                href={`/level/${id}`}
                className="block rounded border border-border bg-surface px-4 py-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {body}
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="rounded border border-border/60 bg-surface/40 px-4 py-3 opacity-60"
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
