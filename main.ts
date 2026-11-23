// Hybrid dip + trend-reentry bot for the btc-race-24h-20261123-0511 dev window.
//
// Idea: BTC minute bars mean-revert around a slow average on quiet days and
// grind in one direction on trending days, so the bot enters on EITHER signal:
//   (a) a dip — the close prints at least 60 bps under the slow average, or
//   (b) a re-entry — the close crosses back above the slow average after
//       having sat at or under it on the previous bar.
// It exits on the first of: the close recovers to 120 bps above the slow
// average, a 100 bps trailing stop off the highest close since entry, or a
// 150 bps hard stop off the position's cost. No entries in the final 45 bars
// (a late buy has no time to reach its target and just pays the round trip).
//
// All money math is exact bigint cross-multiplication on the raw integer
// closes — no floats, no clock, no environment, no randomness — so the two
// graded executions agree byte for byte. The slow average is the exact
// integer mean of the last 120 closes (kept as a running sum).
//
// Deliberately unlike the kit baselines: no EMA cross, no 24-bar momentum
// rebalance, no RSI/Bollinger, no buy-and-hold.

import { runBars, type BarsState, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Slow-average lookback, in closes. */
const LOOKBACK = 120;
/** Entry (a): close at least this far under the slow average, in bps. */
const DIP_BPS = 60n;
/** Exit: close at least this far above the slow average, in bps. */
const EXIT_BPS = 120n;
/** Trailing stop: exit once the close falls this far under the peak close since entry, in bps. */
const TRAIL_BPS = 100n;
/** Hard stop: exit once the position is worth this far under its cost, in bps. */
const STOP_BPS = 150n;
/** No new entries in the last this many bars of the window. */
const NO_ENTRY_LAST = 45;
/** Orders may fill at most this far from the latest close, in bps. */
const MAX_SLIPPAGE_BPS = 300;

/** Latest close per batch (a missing bar repeats the previous close). */
const closes: bigint[] = [];
/** Highest close since the current entry (null while flat). */
let peakClose: bigint | null = null;
/** Close and slow-average sum as of the previous batch (for the cross test). */
let prevClose: bigint | null = null;
let prevSum: bigint | null = null;

/** Sum of the last LOOKBACK closes (exact; closes.length >= LOOKBACK when called). */
function slowSum(): bigint {
  let sum = 0n;
  for (let i = closes.length - LOOKBACK; i < closes.length; i++) sum += closes[i]!;
  return sum;
}

await runBars({
  onBatch(state: BarsState): OrderInput[] | void {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    if (state.warmingUp) {
      prevClose = close;
      prevSum = closes.length >= LOOKBACK ? slowSum() : null;
      return [];
    }
    if (closes.length < LOOKBACK) {
      prevClose = close;
      prevSum = null;
      return [];
    }

    const sum = slowSum();
    const n = BigInt(LOOKBACK);
    const held = state.positions.get(SYMBOL);
    const orders: OrderInput[] = [];

    if (held === undefined) {
      peakClose = null;
      // Entries stop NO_ENTRY_LAST bars before the window ends: the scored
      // window is 1440 bars, starting after the warm-up batches.
      const lastEntrySeq = state.warmupBars + 1440 - NO_ENTRY_LAST;
      if (state.seq < lastEntrySeq) {
        // (a) dip: close * LOOKBACK <= sum * (1 - DIP_BPS / 10000)
        const dipped = close * n * 10_000n <= sum * (10_000n - DIP_BPS);
        // (b) cross up: previous close at/under its average, this close above it.
        const crossed =
          prevClose !== null &&
          prevSum !== null &&
          prevClose * n <= prevSum &&
          close * n > sum;
        if (dipped || crossed) {
          const cash = state.cash;
          const room = state.weightRoom(SYMBOL);
          const spend = cash < room ? cash : room;
          if (spend >= BigInt(state.hello.fees.min_notional_quote_units) && spend > 0n) {
            const buy: BuyInput = {
              side: 'buy',
              symbol: SYMBOL,
              notional_quote_units: spend,
              max_slippage_bps: MAX_SLIPPAGE_BPS,
            };
            orders.push(buy);
          }
        }
      }
    } else {
      if (peakClose === null || close > peakClose) peakClose = close;
      // Exit: close >= average + EXIT_BPS.
      const recovered = close * n * 10_000n >= sum * (10_000n + EXIT_BPS);
      // Trailing stop: close <= peak * (1 - TRAIL_BPS / 10000).
      const trailed = close * 10_000n <= peakClose * (10_000n - TRAIL_BPS);
      // Hard stop: position value <= cost * (1 - STOP_BPS / 10000).
      const value = state.value(SYMBOL, held.qty);
      const stopped = value * 10_000n <= held.cost * (10_000n - STOP_BPS);
      if (recovered || trailed || stopped) {
        const sell: SellInput = {
          side: 'sell',
          symbol: SYMBOL,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        orders.push(sell);
      }
    }

    prevClose = close;
    prevSum = sum;
    return orders;
  },
});
