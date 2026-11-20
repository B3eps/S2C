---
name: parca-research
description: Use when changing or evaluating the Parça Setup / Parça Gold signal rules in S2C, or when asked why signals are rare, late or unprofitable on XAU/USD.
---

# Parça signal research

Rules live in `src/lib/parcaSetup.ts` (one causal engine); presets in `src/lib/parcaVariants.ts`.
Source of the rules: Parca Trades video youtu.be/Mdxv5SV2qHY — bias (1h/4h/daily), engulf = candle
closing through an opposing FVG / order block (stacked FVGs are one zone), mini structure point =
close beyond the last swing, session liquidity as an extra. The trader takes an engulf OR a
structure break when the bias is clear; both on one candle is his "double confirmation".

## Always measure, never tune by eye

```bash
node scripts/backtest-parca.mjs 5m engines    # both presets, train vs test periods
node scripts/backtest-parca.mjs 5m research   # entry models x bias x session, ranked by the worse of train/test
```

- Fills follow the app: bid candles, spread on the ask side (`SPREAD` env, default 0.2), stop first.
- A change is kept only if avgR is positive on TRAIN and on TEST, and most periods are not negative.
- Report signals per day next to avgR: frequency is a requirement, not a side effect.

## What the data showed (Nov 2026)

- Requiring engulf + structure break + sweep/zone made signals rare (<0.5/day) without making them better.
- Engulf alone in the bias direction: ~3/day on 5m, positive on train and test; 15m also positive.
- 1m loses to the spread; bias modes "daily first" and "majority" are worse than "no opposing vote".
- "Late signal" check (scripts/research-late.mjs): filtering out signals after a big run or far
  from EMA21 flipped sign between train and test (overfit) — lateness is not what loses.
- Pullback limit entries missed the best moves and were unstable; market entry at the close stays.
- Robust filter: chart EMA21 sloping our way (5 candles) + last closed 15m candle beyond its EMA50.
  5m: 3.5→2.7 signals/day, avgR train 0.029→0.056, test 0.127→0.166. Now Gold default (`ema: 1`).
- Taking only the first 2 signals of the day is worse (−0.05 / −0.01R): don't cap by order.
- Win-rate study (scripts/research-winrate.mjs, 1R target): trend strength decides. Train win%
  by ADX quartile 32/47/51/61, by ATR-vs-daily-average 35/51/37/68. Breakout stop-entry triggers,
  tighter or ATR-fixed stops did not beat buying the close with the structure stop.
- Presets now: Gold = EMA + ADX>=20, 1R (5m ~1.5/day, win 57/61%, avgR .17/.20).
  Gold A+ = also ADX>=27.5 and ATR>=1.2x daily avg (5m ~0.2-0.4/day, win 79/73%). A+ on 15m has
  too few trades to judge; use it on 5m.
- Probability model (src/lib/parcaModel.ts, fitted by scripts/fit-gold-model.mjs on TRAIN only):
  logistic regression on 10 causal features; strongest: ATR vs daily average (+), RSI from the
  trade side (+), room to the opposing swing (+), stop distance in ATR (−), higher-TF zone (−).
  Gold A+ = Gold engulf with P>=0.55: 5m win 77% train / 75% test at 0.8 / 0.4 signals a day.
  Refit after changing any feature, and keep the TEST periods out of the fit.
- 70% win at 1R with ~2 signals a day did not exist in any tested combination; it is one or the other.
- Published claims about Asia-range sweeps on gold are near coin flip; do not add a rule on their word.
