import type { Block, Signal } from "./blocks";

/**
 * A block in the words the chapters used for it.
 *
 * Pure and outside the components on purpose. Two callers need it — the composer's rule list and the
 * exported playbook — and one of those is in `lib/`, which may not import React. Keeping the wording in
 * one place also means the rule a player reads while building it is word-for-word the rule in the
 * document they leave with, which is the difference between an export and a summary.
 *
 * **The wording is the chapters', not the code's.** "Price breaks above the last swing high" rather than
 * `bos-up`; "the 20-bar average" rather than `sma(20)`. A rule the player cannot read back is not
 * theirs, and a playbook in identifiers is a configuration file.
 */

export function describeSignal(signal: Signal): string {
  switch (signal.kind) {
    case "close":
      return "the close";
    case "sma":
      return `the ${signal.period}-bar average`;
    case "ema":
      return `the ${signal.period}-bar exponential average`;
    case "rsi":
      return `RSI(${signal.period})`;
    case "atr-pct":
      return "ATR as a % of price";
    case "bollinger":
      return `the ${signal.band} Bollinger band`;
    case "macd":
      return `the MACD ${signal.line}`;
  }
}

export function describeBlock(block: Block): string {
  switch (block.kind) {
    case "structure":
      return {
        "bos-up": "price breaks above the last swing high",
        "bos-down": "price breaks below the last swing low",
        "swing-high": "a swing high has just confirmed",
        "swing-low": "a swing low has just confirmed",
        retest: "price comes back to a level it already broke",
      }[block.event];
    case "zone":
      return `price is at ${block.touching === "support" ? "support" : "resistance"}`;
    case "cross":
      return `${describeSignal(block.fast)} crosses ${
        block.dir === "above" ? "above" : "below"
      } ${describeSignal(block.slow)}`;
    case "compare":
      return `${describeSignal(block.left)} is ${
        block.op === ">" ? "above" : "below"
      } ${typeof block.right === "number" ? block.right : describeSignal(block.right)}`;
    case "volatility":
      return `ATR is ${block.atrPct.op === ">" ? "above" : "below"} ${block.atrPct.value}% of price`;
  }
}
