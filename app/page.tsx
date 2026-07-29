import { ChapterMap } from "@/components/ChapterMap";
import { Disclaimer } from "@/components/ui/Disclaimer";

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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Chapters
        </h2>
        <ChapterMap />
      </section>

      <footer className="max-w-prose border-t border-border pt-4">
        <Disclaimer />
      </footer>
    </main>
  );
}
