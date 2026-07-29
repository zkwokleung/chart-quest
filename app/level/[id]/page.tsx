import Link from "next/link";
import { LevelPlayer } from "@/components/level/LevelPlayer";
import { CHAPTERS, levelIds } from "@/lib/levels/chapters";
import { getLevel } from "@/lib/levels/registry";

export function generateStaticParams() {
  return CHAPTERS.flatMap((c) => levelIds(c).map((id) => ({ id })));
}

/**
 * Every level is prerendered, and anything outside that set 404s without
 * reaching this component. There is no backend, so an on-demand route here would
 * mean a serverless function per level view for entirely static content.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const level = getLevel(id);
  return { title: level ? `${level.id} · ${level.title}` : `Level ${id}` };
}

/**
 * Thin by design. Dispatch happens inside LevelPlayer via the kind registry, and
 * neither this page nor the player may branch on `level.kind` — that rule is what
 * keeps ~73 levels from becoming ~73 components. See docs/ARCHITECTURE.md.
 */
export default async function LevelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const level = getLevel(id);
  const chapter = id.split("-")[0] ?? "1";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      {level ? (
        <LevelPlayer level={level} />
      ) : (
        <>
          <nav>
            <Link
              href={`/chapter/${chapter}`}
              className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              ← Chapter {chapter}
            </Link>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Level {id}</h1>
          <p className="max-w-prose text-muted">
            Not authored yet. This chapter arrives in a later milestone.
          </p>
        </>
      )}
    </main>
  );
}
