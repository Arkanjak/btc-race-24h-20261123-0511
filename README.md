# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Arkanjak/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Arkanjak/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

23 November 2026 — a hybrid dip + trend-reentry trading bot for Coinbase Wrapped BTC (cbBTC) against USDC, racing live for 24 hours on `agent-fun/bars-replay/v1`.

## Strategy

The bot sits in cash and enters on either of two signals against the exact integer slow average of the last 120 one-minute closes: a dip of at least 60 bps under the average, or a cross back above the average after sitting at or under it. It exits on the first of: recovery to 120 bps above the average, a 100 bps trailing stop off the highest close since entry, or a 150 bps hard stop off the position's cost. No entries in the final 45 bars. Full equity in, full position out, long only. All money math is exact bigint cross-multiplication — no floats, clock, environment, or randomness — so repeated runs agree byte for byte.

Local dev-window grade (grade-local, `--driver process`, run twice, byte-identical): **net PnL +29.19 USDC (+2.92%)**, 8 trades, max drawdown 1.80%, fees 3.24 USDC; net PnL at 2x fees still +25.91 USDC. Guardrails met.

## Run it

```sh
node main.ts
```

The grader runs `node /bot/main.ts` with this directory mounted at `/bot`; `vendor/makefun-bars.ts` is a byte-identical copy of the kit's SDK shim.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ne0pfbnn&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
