import Link from "next/link";

export const metadata = { title: "Practice" };

export default function PracticePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
      <nav>
        <Link
          href="/"
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← All chapters
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
      <p className="max-w-prose text-muted">Not built yet.</p>
    </main>
  );
}
