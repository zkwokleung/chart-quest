import type { SeriesId } from "@/lib/chart/types";
import { assetClassOf, type AssetClass } from "./asset-class";

/**
 * What it takes to turn a price move into money.
 *
 * Chapter 7 is the chapter that makes the rest of the game transfer. Without it a player can
 * size a Bitcoin trade and nothing else, because "risk 1% of the account" means a different
 * arithmetic on a fractional coin, a whole share, a 100-ounce contract and a 100,000-unit
 * currency lot. One formula and four of these tables is the whole difference.
 *
 * ## These numbers are specifications, not measurements
 *
 * This project's standing claim is that every number is measured rather than asserted, and
 * **it does not reach this file.** A gold future covers 100 troy ounces because CME defines
 * it that way; nothing in `GC-1d.json` implies it, and no amount of staring at the price
 * series would reveal it. The same goes for tick sizes, lot sizes and standard FX lots.
 *
 * So they are stated as what they are — exchange contract specifications, with the exchange
 * named — and the tests assert *internal consistency* rather than pretending to verify them:
 * that `tickValue` equals `tick × valuePerPoint`, that a rounded position never exceeds its
 * risk budget, that the four classes really do disagree about one trade. Being explicit about
 * which numbers are given and which are derived is the honest version of the claim, and
 * quietly presenting a contract multiplier as a measurement would be the dishonest one.
 *
 * Spreads are the one soft entry: `typicalSpreadBps` is a round order-of-magnitude figure for
 * the slippage lesson, not a quoted spread from any venue, and it is marked as such below.
 */
export type InstrumentSpec = {
  id: SeriesId;
  class: AssetClass;
  /**
   * Currency per 1.0 of price movement, per unit held.
   *
   * The number that makes sizing transfer. For a share it is 1 — a dollar move on one share
   * is a dollar. For gold it is 100, because the contract is 100 ounces. Getting this wrong
   * is not a rounding error; it is a position a hundred times the intended size.
   */
  valuePerPoint: number;
  /** Smallest tradeable increment of position size. */
  lotSize: number;
  /** Minimum price increment, where the contract defines one. */
  tick?: number;
  /** Currency per tick. Always `tick × valuePerPoint`; stored so a level can quote it. */
  tickValue?: number;
  quoteCcy: string;
  /**
   * Round order-of-magnitude round-trip cost, in basis points of notional.
   *
   * Deliberately approximate and not sourced from a venue: it exists so Chapter 7 can show
   * that costs scale with the number of trades, and a level quoting it says "about".
   */
  typicalSpreadBps: number;
  /** What one unit is called, for a level's prompt and answer label. */
  unitLabel: string;
  /** Where the contract terms come from, for the level that quotes them. */
  source: string;
};

const SPECS: Record<SeriesId, InstrumentSpec> = {
  // Spot crypto: one unit is one coin, and exchanges accept eight decimal places.
  "BTCUSDT-1d": spot("BTCUSDT-1d"),
  "BTCUSDT-4h": spot("BTCUSDT-4h"),

  // Cash equities: one unit is one share, one dollar of price is one dollar.
  "SPY-1d": share("SPY-1d"),
  "SPY-15m": share("SPY-15m"),
  "SPY-1h": share("SPY-1h"),
  "AAPL-1d": share("AAPL-1d"),
  "AAPL-1d-raw": share("AAPL-1d-raw"),
  "LAKE-1d": share("LAKE-1d"),

  /**
   * FX, sized in standard lots of 100,000 base units, tradeable down to a micro-lot.
   *
   * So one pip — 0.0001 on this pair — is $10 on a standard lot and $0.10 on a micro. The
   * `valuePerPoint` here is per *lot*, which is why it is 100,000: a 1.0 move in EURUSD would
   * be $100,000 on one lot, and the fact that such a move is absurd is exactly why FX is
   * quoted in pips rather than points.
   */
  "EURUSD-1d": fx("EURUSD-1d"),
  "EURUSD-1h": fx("EURUSD-1h"),
  "EURUSD-4h": fx("EURUSD-4h"),

  /**
   * COMEX gold, 100 troy ounces per contract, in $0.10 ticks worth $10 each.
   *
   * The instrument that makes 7.3 land: the same dollar risk buys a fractional position here,
   * where one contract already carries $100 of exposure per dollar of price.
   */
  "GC-1d": {
    id: "GC-1d",
    class: "futures",
    valuePerPoint: 100,
    lotSize: 1,
    tick: 0.1,
    tickValue: 10,
    quoteCcy: "USD",
    typicalSpreadBps: 1,
    unitLabel: "contracts",
    source: "CME Group contract specification, COMEX Gold (GC): 100 troy ounces, $0.10 tick",
  },

  // Synthetic, for the chart harness. Priced like a share so tests need no special case.
  "FIXTURE-1d": share("FIXTURE-1d"),
};

function spot(id: SeriesId): InstrumentSpec {
  return {
    id,
    class: assetClassOf(id),
    valuePerPoint: 1,
    // Eight decimals: the smallest unit Bitcoin itself is denominated in.
    lotSize: 1e-8,
    quoteCcy: "USDT",
    typicalSpreadBps: 2,
    unitLabel: "BTC",
    source: "Bitcoin is divisible to 1e-8 (one satoshi); Binance quotes BTCUSDT in USDT",
  };
}

function share(id: SeriesId): InstrumentSpec {
  return {
    id,
    class: assetClassOf(id),
    valuePerPoint: 1,
    lotSize: 1,
    quoteCcy: "USD",
    typicalSpreadBps: 3,
    unitLabel: "shares",
    source: "US cash equity: one share, one dollar of price is one dollar of value",
  };
}

function fx(id: SeriesId): InstrumentSpec {
  return {
    id,
    class: assetClassOf(id),
    valuePerPoint: 100_000,
    lotSize: 0.01,
    tick: 0.0001,
    tickValue: 10,
    quoteCcy: "USD",
    typicalSpreadBps: 1,
    unitLabel: "lots",
    source:
      "FX convention: standard lot is 100,000 base units, micro-lot 0.01, one pip is 0.0001",
  };
}

export function specFor(id: SeriesId): InstrumentSpec {
  return SPECS[id];
}

export const ALL_SPECS: readonly InstrumentSpec[] = Object.values(SPECS);
