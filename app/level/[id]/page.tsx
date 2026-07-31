import { LevelPlayer } from "@/components/level/LevelPlayer";
import { CHAPTERS, levelIds } from "@/lib/levels/chapters";
import { loadLevel } from "@/lib/levels/registry";

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
  const level = await loadLevel(id);
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

  // Only the id crosses the boundary. Levels hold misconception test functions,
  // which React cannot serialize — and need not, since the client imports the
  // level registry directly.
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <LevelPlayer levelId={id} />
    </main>
  );
}
