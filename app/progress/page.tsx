import Link from "next/link";
import { JournalPanel } from "@/components/JournalPanel";
import { ProgressTransfer } from "@/components/ProgressTransfer";
import { SkillRadar } from "@/components/SkillRadar";

export const metadata = { title: "Progress" };

export default function ProgressPage() {
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
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <SkillRadar />
      <JournalPanel />
      <ProgressTransfer />
    </main>
  );
}
