"use client";

import { useMemo, useState } from "react";
import type { Block } from "@/lib/backtest/blocks";
import { reportOn } from "@/lib/journal/analytics";
import type { ExitRule, OverlaySpec, RiskRule } from "@/lib/levels/schema";
import { playbookMarkdown } from "@/lib/playbook/export";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * The artefact the player leaves with.
 *
 * Markdown, with the browser's own print dialogue as the PDF path — issue #28 asked for
 * "markdown + PDF" and a PDF library is over 100 KB against a shared bundle at 94%, for worse
 * typography than the browser produces. The `@media print` rules in `globals.css` are the other half.
 *
 * The download is a Blob and an anchor click, which needs no library and no server. That it works
 * offline matters: the whole game does, and an export that needed a round trip would be the one part
 * of it that could stop working.
 */

type Run = Extract<OverlaySpec, { kind: "run" }>;

export function PlaybookExport({
  run,
  exit,
  risk,
  blocks,
}: {
  run: Run | null;
  exit: ExitRule;
  risk: RiskRule;
  blocks: Block[];
}) {
  const hydrated = useHydrated();
  const journal = useGameStore((state) => state.journal);
  const strategies = useGameStore((state) => state.strategies);
  const [copied, setCopied] = useState(false);

  const saved = [...strategies]
    .sort((a, b) => (a.savedAt ?? "").localeCompare(b.savedAt ?? ""))
    .at(-1);

  const markdown = useMemo(() => {
    if (!hydrated) return "";
    return playbookMarkdown({
      name: saved?.name ?? "My strategy",
      blocks,
      exit,
      risk,
      inSample: run,
      // The holdback run lives on 10.6's page rather than here; a playbook that invented one would be
      // the exact dishonesty the document spends its length warning about.
      holdback: null,
      journal: reportOn(journal),
      variants: saved?.variants ?? 0,
      // Stamped here rather than inside the generator, which stays free of the clock so it is testable.
      generatedOn: new Date().toISOString().slice(0, 10),
    });
  }, [hydrated, saved?.name, saved?.variants, blocks, exit, risk, run, journal]);

  if (!hydrated) return null;

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(saved?.name ?? "playbook").replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="playbook flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Your playbook</h2>
        <p className="max-w-prose text-sm text-muted">
          The rule in words, what it did on every market with the number of trades behind each figure,
          and what it is known to do badly. Take it with you — and read the failure modes first, because
          in six months they are the part you will have forgotten.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          onClick={download}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Download as Markdown
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(markdown).then(() => setCopied(true));
          }}
          className="rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Print or save as PDF
        </button>
      </div>

      {/* The document itself, not a preview of it: this is what prints. */}
      <pre className="playbook-document max-h-96 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-bg p-3 font-mono text-xs print:max-h-none print:overflow-visible print:border-0 print:bg-transparent">
        {markdown}
      </pre>
    </section>
  );
}
