import Link from "next/link";
import { SettingsPanel } from "@/components/SettingsPanel";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
      <nav className="flex gap-4">
        <Link
          href="/"
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← All chapters
        </Link>
        <Link
          href="/progress"
          className="text-sm text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          Progress
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="max-w-prose text-muted">
        Everything here is kept in this browser along with your progress. Nothing is sent anywhere,
        because there is nowhere to send it.
      </p>
      <SettingsPanel />
    </main>
  );
}
