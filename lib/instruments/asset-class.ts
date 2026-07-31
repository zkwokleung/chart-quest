import type { SeriesId } from "@/lib/chart/types";

/**
 * Which kind of market a series is.
 *
 * The minimum M5 needs: every journal entry records it, because Chapter 9.6 splits
 * the player's own trade record by asset class and can only do that if the very
 * first trade already carried the field.
 *
 * The full `InstrumentSpec` — `valuePerPoint`, lot sizes, ticks, trading hours —
 * is M7, where sizing in currency arrives. Chapter 3 risks in R, so none of that
 * is needed yet. The class names match the spec in docs/ARCHITECTURE.md so M7
 * widens this rather than replacing it.
 */
export type AssetClass = "crypto-spot" | "equity" | "fx" | "futures";

const CLASSES: Record<SeriesId, AssetClass> = {
  "BTCUSDT-1d": "crypto-spot",
  "BTCUSDT-4h": "crypto-spot",
  "SPY-1d": "equity",
  "SPY-15m": "equity",
  "SPY-1h": "equity",
  "AAPL-1d": "equity",
  "AAPL-1d-raw": "equity",
  "EURUSD-1d": "fx",
  "EURUSD-1h": "fx",
  "EURUSD-4h": "fx",
  // Gold trades as a futures contract, which is why it is in the spine at all:
  // Chapter 7 sizes a contract rather than shares or coins.
  "GC-1d": "futures",
  "LAKE-1d": "equity",
  "FIXTURE-1d": "equity",
};

export function assetClassOf(id: SeriesId): AssetClass {
  return CLASSES[id];
}
