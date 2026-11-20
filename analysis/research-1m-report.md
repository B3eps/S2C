# 1m XAU/USD indicator sweep

## Result

The predefined sweep covered **888 trials** across 37 signal configurations, four higher-timeframe filters (none, completed 15m trend, completed 4h trend, both), two 1m ATR stop distances (0.8 and 1.2), and three targets (1R, 1.5R, 2R). The signals came from 17 implemented indicator types in `src/lib/indicators.ts`.

**No trial had positive mean R on TRAIN.** For inspection, the 25 highest TRAIN results were selected using TRAIN only (minimum 50 TRAIN trades). All 25 were negative on TEST too. The leading TRAIN candidate was TRIX 18 with both 15m and 4h agreement, 1.2 ATR stop, and 2R target: TRAIN 385 trades at −0.0727R/trade; TEST 458 trades at −0.0371R/trade. The JSON has full metrics for all 888 trials.

One of 888 trials was positive on TEST (+0.01R/trade, CCI 20 with both timeframe filters, 1.2 ATR stop and 2R target), but its TRAIN result was −0.19R/trade. This is a holdout winner found by scanning TEST after the fact, so it is evidence of selection bias, not a strategy result. TEST was not used to rank the displayed top 25.

For a 2R target and full 1R stop loss, the frictionless break-even win rate is 33.3%. The best TRAIN-selected candidate won 30.9% on TRAIN and 32.1% on TEST; its measured average R was negative in both periods. These returns include the configured spread, so the win-rate comparison is only an intuition for the observed expectancy, not an alternative calculation.

## Data and method

- Instrument and feed: XAU/USD Dukascopy bid candles via `dukascopy-node`.
- Entry timeframe: 1m. Historical 15m candles were aggregated from 1m bars; 4h context was aggregated from historical 1h bars. The trend filter uses only completed higher-timeframe candles.
- TRAIN: May 13, 2024–January 15, 2025 across five separated windows. TEST: April 7, 2025–June 26, 2026 across five later windows. The first three days of each window are excluded for indicator warm-up. Effective exposure represented is 79.3 TRAIN and 90.0 TEST five-day trading days.
- Trade timing: signal candle close, next 1m bar entry; 240-minute max hold; one position at a time per candidate; when stop and target are both touched within a minute, stop is counted first.
- Session: 03:00–16:00 New York time. Spread is fixed at $0.20 by default (`SPREAD` can override it). Stops are 0.8 or 1.2 times 1m ATR(14); targets are 1, 1.5, or 2 times initial risk.
- Candidate families: EMA/SMA crossovers, Supertrend flips, RSI and Stochastics reversals, MACD/PPO crosses, CCI and Williams %R reversals, Donchian breakouts, Bollinger re-entry, VWAP cross, Aroon, TRIX, AO, and CMF. These are explicit signal rules built from the repository's indicator calculations, not a sweep of every displayed indicator or of Parça's separate custom setup engine.

## Existing backtest caveats

`scripts/backtest-parca.mjs` has a TRAIN/TEST split, but its default ranking uses the minimum of TRAIN and TEST expectancy, so TEST affects which rows it surfaces. Its `last` guard blocks another signal only until the next timeframe interval; it does not prevent a new entry while the previous trade remains open. It also does not model commissions or account-level constraints. The new sweep ranks on TRAIN only and blocks entries through each simulated exit, but likewise has no commission, variable spread, slippage, margin, or account risk model.

## Reproduction

Run `node scripts/research-1m-indicators.mjs 1m`. It writes all metrics and the selected TRAIN ranking to `analysis/research-1m-results.json`. Dukascopy cache files are ignored by Git. This is historical strategy research, not a forward test; the windows omit intervening dates and the TEST periods have now been inspected.
