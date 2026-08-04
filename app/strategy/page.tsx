import Link from "next/link";
import { StrategyComposer } from "@/components/strategy/StrategyComposer";

export const metadata = { title: "Strategy" };

export default function StrategyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
      <nav>
        <Link
          href="/"
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← All chapters
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
      <p className="max-w-prose text-muted">
        A workbench rather than a level. Nothing here is scored — compose a rule from what the
        chapters have taught you, run it on three markets at once, and see what it did. Chapter
        10&apos;s levels ask one question each about a strategy; this is where you try things.
      </p>
      <StrategyComposer />
    </main>
  );
}
