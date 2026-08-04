import { describeBlock } from "@/lib/backtest/describe";
import type { Block } from "@/lib/backtest/blocks";
import type { JournalReport } from "@/lib/journal/analytics";
import { UNDERPOWERED_BELOW } from "@/lib/journal/analytics";
import type { ExitRule, OverlaySpec, RiskRule } from "@/lib/levels/schema";

/**
 * The document the player leaves with.
 *
 * ## Markdown, and the browser's own print dialogue instead of a PDF
 *
 * Issue #28 asks for "markdown + PDF". A generated PDF needs a library — jsPDF is over 100 KB — on a
 * route where the shared bundle already sits at 94% of its budget, and it produces worse typography
 * than the browser does. So the export is markdown, and `@media print` makes Save-as-PDF produce the
 * document. Zero payload, better output, and it works offline like everything else here.
 *
 * ## Every figure travels with its sample size, including the uncomfortable ones
 *
 * The rule this module exists to enforce. A playbook is the one artefact that leaves the game, so it is
 * the one place a figure without its `n` would do real damage — the player would read it in six months
 * with none of the context that made them careful. So:
 *
 * - Every per-market row carries its trade count, and a row under `UNDERPOWERED_BELOW` says so in words.
 * - The out-of-sample section states what it *cannot* establish before what it can. On this data the
 *   holdback yields single-digit trade counts, and a playbook that led with "+8.5R out of sample" would
 *   undo Chapter 10.6 on the way out of the door.
 * - The known-failure-modes section is generated from the run rather than left blank for the player to
 *   fill in optimistically.
 *
 * Pure and tested, because a document generator is a function. Asserting its output is how the numbers
 * in it stay attached to the run that produced them.
 */

type Run = Extract<OverlaySpec, { kind: "run" }>;

export type PlaybookInput = {
  name: string;
  blocks: Block[];
  exit: ExitRule;
  risk: RiskRule;
  /** The in-sample run. */
  inSample: Run | null;
  /** The holdback run, where the player has reached it. */
  holdback: Run | null;
  /** The player's own trade record, for the discipline section. */
  journal: JournalReport | null;
  /** How many variants were tried before this one. 9.5's lesson, carried out of the game. */
  variants: number;
  /** Stamped by the caller — this module stays free of the clock so it can be tested. */
  generatedOn: string;
};

const r = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;

function rulesSection(input: PlaybookInput): string[] {
  const lines = ["## The rule", ""];
  if (input.blocks.length === 0) {
    lines.push("_No entry conditions — this strategy would never trade._", "");
    return lines;
  }
  lines.push("Enter long when **all** of these hold on the same bar:", "");
  input.blocks.forEach((block, i) => {
    lines.push(`${i + 1}. ${describeBlock(block)}`);
  });
  lines.push(
    "",
    `Stop **${input.exit.stopAtr} ATR** below entry. ` +
      (input.exit.targetR === null
        ? "No target — the trade runs to the stop or the clock."
        : `Target **${input.exit.targetR}R** above entry.`) +
      ` Closed after **${input.exit.timeStopBars} bars** either way.`,
    "",
    `Risk **${(input.risk.perTradePct * 100).toFixed(2)}%** of the account per trade.`,
    "",
    "Stated in ATR and R rather than in prices, so it means the same thing on every market and at every account size.",
    "",
  );
  return lines;
}

function resultsTable(run: Run): string[] {
  const lines = [
    "| Market | Trades | Expectancy | Doing nothing | Total | Worst run |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const asset of run.perAsset) {
    lines.push(
      `| ${asset.asset} | ${asset.trades} | ${r(asset.expectancy)} | ${r(asset.baselineR)} | ${r(
        asset.totalR,
      )} | ${asset.maxDrawdownR.toFixed(2)}R |`,
    );
  }
  return lines;
}

function underpoweredNote(run: Run): string[] {
  const thin = run.perAsset.filter((asset) => asset.underpowered);
  if (thin.length === 0) return [];
  return [
    "",
    `**Too few trades to conclude from: ${thin
      .map((asset) => `${asset.asset} (${asset.trades})`)
      .join(", ")}.** Fewer than ${UNDERPOWERED_BELOW} trades is not a result. ` +
      "Those rows are here because hiding them would be worse, not because they support anything.",
  ];
}

/** What this strategy is known to do badly, from the run rather than from imagination. */
function failureModes(input: PlaybookInput): string[] {
  const lines = ["## Known failure modes", ""];
  const runs = [input.inSample, input.holdback].filter((run): run is Run => run !== null);

  if (runs.length === 0) {
    lines.push("_Not backtested, so nothing is known about how it fails._", "");
    return lines;
  }

  const worst = Math.max(
    ...runs.flatMap((run) => run.perAsset.map((asset) => asset.maxDrawdownR)),
  );
  lines.push(
    `- **Expect to be ${worst.toFixed(1)}R down at some point.** That is the deepest run of losses in the test, and a real one will be worse, because the test is over.`,
  );

  const beaten = runs[0]!.perAsset.filter(
    (asset) =>
      asset.baselineR !== null &&
      asset.expectancy !== null &&
      asset.expectancy <= asset.baselineR,
  );
  if (beaten.length > 0) {
    lines.push(
      `- **On ${beaten
        .map((a) => a.asset)
        .join(
          ", ",
        )} the entry did no better than entering on every bar.** Whatever this rule earns there is the market and the exit, not the rule.`,
    );
  }

  const failing = runs[0]!.perAsset.filter(
    (asset) => (asset.expectancy ?? 0) <= 0 && !asset.underpowered,
  );
  if (failing.length > 0) {
    lines.push(
      `- **Loses money on ${failing.map((a) => a.asset).join(", ")}** over a real sample. Do not trade it there.`,
    );
  }

  if (input.variants >= 10) {
    lines.push(
      `- **${input.variants} variants were tried before this one.** In Chapter 9.5 the best of twenty-six settings placed 25th of 26 on the years it was not chosen on. The more you searched, the more likely it is that what you found is the luckiest rather than the truest.`,
    );
  }

  lines.push(
    "- **The out-of-sample sample is too small to confirm anything.** It can tell you the rule is broken. It cannot tell you it works — that is not a limitation of this test, it is the shape of the problem.",
    "",
  );
  return lines;
}

export function playbookMarkdown(input: PlaybookInput): string {
  const lines: string[] = [
    `# ${input.name}`,
    "",
    `_Built in Chart Quest, ${input.generatedOn}. Every figure below carries the number of trades behind it, which is the only reason any of them mean anything._`,
    "",
    ...rulesSection(input),
  ];

  lines.push("## In sample — the part you could see", "");
  if (input.inSample) {
    lines.push(...resultsTable(input.inSample), ...underpoweredNote(input.inSample), "");
    lines.push(
      "The **doing nothing** column is the same stop and target with no entry rule at all. ",
      "It is the bar this rule had to clear: a positive expectancy that loses to it is the market, not an edge.",
      "",
    );
  } else {
    lines.push("_Not run._", "");
  }

  lines.push("## Out of sample — the part you could not", "");
  if (input.holdback) {
    // Deliberately before the table. A reader who sees the numbers first has already formed a view.
    lines.push(
      "**Read the trade counts before the returns.** This window is the most recent 15% of each series, held out of the whole game, and a selective rule fires only a handful of times in it. A good result here is not evidence; a bad one is a warning.",
      "",
      ...resultsTable(input.holdback),
      ...underpoweredNote(input.holdback),
      "",
    );
  } else {
    lines.push("_Not run — so nothing here has been tested on unseen data._", "");
  }

  lines.push(...failureModes(input));

  lines.push("## Your own record", "");
  if (input.journal && input.journal.planned.n > 0) {
    const { planned } = input.journal;
    lines.push(
      `${planned.n} trades you planned yourself: expectancy ${r(planned.expectancy)}, total ${r(
        planned.totalR,
      )}, worst run ${planned.maxDrawdownR.toFixed(2)}R.`,
      "",
    );
    if (input.journal.underpowered.length > 0) {
      lines.push(
        `Too few trades to split by ${input.journal.underpowered.join(", ")}. That is how much a handful of trades can tell you, and it does not improve by being averaged differently.`,
        "",
      );
    }
    if (input.journal.discipline.unreasoned > 0) {
      lines.push(
        `${input.journal.discipline.unreasoned} of them carry no stated reason. Write the reason down before the trade, or the record cannot tell you anything later.`,
        "",
      );
    }
  } else {
    lines.push("_No trades logged._", "");
  }

  lines.push(
    "## Review cadence",
    "",
    `- Re-run this on new data every **${REVIEW_EVERY_TRADES} trades**, not every month. Time is not what makes a sample.`,
    "- Compare against the *doing nothing* column each time. If the gap has closed, the edge has gone, whatever the total says.",
    "- Do not re-tune when it stops working. Re-tuning is how a broken rule becomes an overfitted rule.",
    `- If a market goes ${WALK_AWAY_R}R against you from its peak, stop trading it there and find out why before deciding.`,
    "",
    "---",
    "",
    "_This is educational software and not financial advice. The strategy above was fitted to historical data by a person learning how fitting works._",
    "",
  );

  return lines.join("\n");
}

/**
 * Trades, not weeks.
 *
 * A monthly review of a rule that fires twice a year is eleven months of reading noise, and Chapter 9
 * is entirely about the difference. Twenty is `UNDERPOWERED_BELOW`, so a review always has at least as
 * much evidence as the game is willing to draw a conclusion from.
 */
const REVIEW_EVERY_TRADES = UNDERPOWERED_BELOW;

/** Deep enough to be outside the tested range on any market in the spine. */
const WALK_AWAY_R = 8;
