import Link from "next/link";
import { ChapterMap } from "@/components/ChapterMap";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 p-8">
      <header className="flex flex-col gap-3 pt-8">
        <h1 className="text-4xl font-semibold tracking-tight">Chart Quest</h1>
        <p className="text-lg text-muted">
          Learn to read any market, one level at a time.
        </p>
        <p className="max-w-prose leading-relaxed text-muted">
          Ten chapters, from what a candle is to building and backtesting your own
          strategy. Every level is something you do on a chart — draw it, click it,
          predict it, trade it. No account needed; progress is saved in this
          browser.
        </p>
      </header>

      {/* Until M11 nothing in the app linked to any of these, so the journal, the skill radar, the
          strategy composer and progress export were reachable only by typing a URL. The landing page
          is the hub every other route already links back to, so this is where they belong. */}
      <nav aria-label="Elsewhere in the game" className="flex flex-wrap gap-3">
        {/* Objects rather than tuples: `noUncheckedIndexedAccess` types a destructured tuple element
            as possibly undefined, and `href` may not be. */}
        {[
          {
            href: "/progress",
            label: "Your progress",
            hint: "Skills, trades, and a backup of your save",
          },
          {
            href: "/strategy",
            label: "Strategy",
            hint: "Build and backtest a rule of your own",
          },
          { href: "/settings", label: "Settings", hint: "Motion, chart units, starting over" },
        ].map(({ href, label, hint }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 basis-56 flex-col gap-0.5 rounded-lg border border-border bg-surface p-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Chapters
        </h2>
        <ChapterMap />
      </section>
    </main>
  );
}
