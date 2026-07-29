import type { CandlePart, Mark } from "./schema";

/**
 * The only place `Mark` strings are built or read.
 *
 * Keeping the encoding here means the `mark-bars` grader and its two render modes
 * share one set-overlap implementation without anyone parsing tagged strings by
 * hand.
 */

export function barMark(index: number): Mark {
  return `bar:${index}`;
}

export function partMark(part: CandlePart): Mark {
  return `part:${part}`;
}

export function isBarMark(mark: Mark): boolean {
  return mark.startsWith("bar:");
}

/** The bar index, or null when this is not a bar mark. */
export function barIndexOf(mark: Mark): number | null {
  if (!isBarMark(mark)) return null;
  const n = Number(mark.slice(4));
  return Number.isInteger(n) ? n : null;
}

/** The candle part, or null when this is not a part mark. */
export function partOf(mark: Mark): CandlePart | null {
  if (!mark.startsWith("part:")) return null;
  return mark.slice(5) as CandlePart;
}

export const CANDLE_PARTS: readonly CandlePart[] = [
  "upper-wick",
  "body",
  "lower-wick",
  "open",
  "close",
];

const PART_LABELS: Record<CandlePart, string> = {
  "upper-wick": "Upper wick",
  "lower-wick": "Lower wick",
  body: "Body",
  open: "Open",
  close: "Close",
};

export function partLabel(part: CandlePart): string {
  return PART_LABELS[part];
}
