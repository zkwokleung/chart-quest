import Link from "next/link";
import { notFound } from "next/navigation";
import { LevelList } from "@/components/LevelList";
import { CHAPTERS, getChapter } from "@/lib/levels/chapters";

export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ n: String(c.n) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const chapter = getChapter(Number(n));
  return { title: chapter ? `${chapter.n}. ${chapter.title}` : "Chapter" };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const chapter = getChapter(Number(n));
  if (!chapter) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <nav>
        <Link
          href="/"
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← All chapters
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs text-muted">
          Chapter {String(chapter.n).padStart(2, "0")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{chapter.title}</h1>
        <p className="max-w-prose text-muted">{chapter.blurb}</p>
      </header>

      <LevelList chapter={chapter} />
    </main>
  );
}
