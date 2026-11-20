# XAU/USD 1m indicator coverage and execution audit

## Scope and results

This follow-up is **additional** to `research-1m-indicators.mjs`; its 49 added signal/filter configurations do not repeat that sweep's 17 registry IDs. Together the two scripts cover all 67 IDs in `INDICATORS`: 64 conventional indicators and the three Parça custom engines. The expanded grid includes four completed-candle context choices (none, 15m EMA50, 4h EMA20, both), 0.8/1.2 ATR(14) stops for ordinary indicators, engine stops for Parça presets, and 1/1.5/2R targets. The default run has 1,212 candidates. A runtime coverage audit is included in the JSON.

The 0.20 spread run ranks only on TRAIN with at least 50 trades; TEST does not select candidates. It evaluates each signal at the **next 1m open**, with 0.20 spread added on long buys and short covers. It accounts for a stop gap at any bar open, counts a same-bar stop before target, blocks overlapping trades, and drops signals too close to the end of a data window to complete the 240-bar holding period.

The highest TRAIN-ranked candidate is a Mass Index gate on an EMA 9/21 cross with 4h agreement, a 1.2 ATR stop, and 2R target. It returned **+0.0746R on 67 TRAIN trades and +0.0946R on 74 TEST trades**. Its test win rate was 36.5%. It is one of 1,212 trials and the sample is small, so this is exploratory and subject to selection bias.

The $0.50 fixed-spread stress replays the same 1,212 candidates and execution model. The default-spread top candidate fell to **−0.1494R on TRAIN and −0.0270R on TEST**. The stress run had no TRAIN-positive candidate and no TEST-positive among its TRAIN-selected top 25. Scanning all 1,212 TEST rows after the fact shows six positive rows at $0.50; they are not evidence of a selected strategy. At $0.20, 13 rows were positive on TRAIN, 31 on TEST, and only three on both; the TRAIN-selected top 25 contained one positive TEST row. The JSON retains every trial, signal-direction counts, and TRAIN ranking. Any TEST winner found by scanning the full file is post-selection evidence, not a new validation.

## Indicator coverage

The earlier 17-ID sweep covered EMA/SMA cross, Supertrend, RSI, MACD, Stoch/Stoch RSI, CCI, Williams %R, Donchian, Bollinger, VWAP, Aroon, TRIX, AO, PPO, and CMF. The added rules cover the remaining registry IDs:

- **Moving averages:** EMA, ALMA, KAMA, WMA, HMA, DEMA, TEMA, VWMA, SMMA, LSMA, and McGinley, tested as 9/21 crossings. SMA and EMA-cross outputs are in the earlier sweep.
- **Channels and structure:** Keltner basis/outer re-entry, envelope re-entry, Ichimoku Tenkan/Kijun cross, Alligator lips/teeth cross, and prior-day pivot cross/reclaim.
- **Trend:** Parabolic SAR close cross, DMI `+DI/−DI` cross with ADX≥20, and Vortex cross. Choppiness and Mass Index are tested as gates on an EMA 9/21 directional cross; neither is treated as a direction signal by itself.
- **Momentum:** Momentum, ROC, Ultimate Oscillator, TSI, CMO, DPO, Coppock, Fisher/trigger, KST/signal, Bull/Bear Power, RVI/signal, and BOP crosses/re-entries.
- **Volatility:** Bollinger %B re-entry; ATR, standard deviation, historical volatility, and Bollinger width are used as above-their-288-bar-SMA gates on an EMA 9/21 cross.
- **Volume:** raw provider volume above its MA gates EMA 9/21; OBV/EMA cross, MFI re-entry, A/D and PVT slope turns, Chaikin oscillator, EOM, EFI, and volume oscillator are directional rules. Dukascopy bar volume is provider-specific tick volume, not consolidated traded volume for global spot gold.
- **Custom engines:** Parça Classic, Gold, and Gold A+ marks use the repository engine's signal and stop, with common target-R and optional HTF filters for comparison.

The rules only use price, bar volume, and the available higher-timeframe bars. The Ichimoku lagging output is excluded because it references future closes. The other Ichimoku rule uses Tenkan/Kijun only. Volume formulas need the provider's bar-volume field; absent or unrepresentative feed volume would invalidate those families.

## Data and lookahead audit

The backtest loads 1m Dukascopy BID bars. 15m bars are aggregated from those 1m bars; 4h bars are aggregated from historical 1h bars, with about 90 days of hourly history for EMA warm-up. These are not independently sourced 15m/4h feeds. The first three calendar days of each period are excluded. The period split remains chronological: 2024–January 2025 TRAIN and April 2025–June 2026 TEST, in separated windows.

Ordinary indicator rules use the current bar's closed values and enter at the next 1m open. The 15m/4h trend filter selects the last candle whose nominal close is no later than the signal close. Prior-day pivots use completed daily candles. No future Ichimoku lag values are used. 4h candles aggregated from hourly history can be partial around market closures and may not match a broker's native 4h boundary convention; this affects the filter definition, not access to future prices.

Parça's `analyzeParcaSetup` calls the incremental setup engine over each complete historical segment in one pass. The engine processes candles in time order and gates higher-timeframe series by close time; source comments say its marks match candle-by-candle replay. This study does not compare those marks against a live app replay trace. The setup engine also builds a historical news exclusion list from a finite hard-coded calendar; it filters around listed releases, and the calendar's completeness/known-at-the-time status is not established here.

## What the original 888 sweep gets wrong or simplifies

The original script is `scripts/research-1m-indicators.mjs`. Its trial ranking is TRAIN-only, but its fills use the signal candle close even though the signal is only known after that candle closes; execution starts on the following minute. The close fill therefore assumes a price unavailable to a close-confirmed strategy. It also tests with a fixed $0.20 spread and no commission, variable spread, or slippage. Stop/target fills are at the exact threshold on intrabar touches, so stop gaps can be understated. Its `last` variable prevents two signals only within one timeframe bar and does not block a new trade while an earlier trade is open. The expanded run fixes the next-open entry, overlap, and stop-gap issues for its own added grid; it does not retroactively rewrite the original JSON.

Neither script runs the application's account simulator, sizing, margin, execution, or prop-firm rules. This is a candle-level research harness, not an app simulation or a forward test. The windows skip intervening dates; each candidate family, parameter choice, target, filter and spread setting adds selection degrees of freedom. TEST results have been inspected, so a fresh untouched holdout would be needed for validation.

## Reproduction

Run `node scripts/research-1m-expanded.mjs` for the default fixed $0.20 spread. Run `$env:SPREAD='0.5'; node scripts/research-1m-expanded.mjs` for the $0.50 stress. The runs write `analysis/research-1m-expanded-results.json` and `analysis/research-1m-expanded-results-spread-0.5.json`, respectively.
