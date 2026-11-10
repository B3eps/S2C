# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Vite + React + TypeScript, TradingView Lightweight Charts (open source), IndexedDB for local storage. Approved by the user in PLAN.md. Desktop browser only.

## Users
One person: the owner, a trader developing their own gold (XAU) trading skill. Uses it alone on their own Windows desktop, in long focused practice sessions.

## Product Purpose
A private practice simulator. Real gold price history is replayed with price levels and dates hidden, so the trader judges price action alone. A virtual prop-firm layer (challenge accounts, rules, violation, funded status, virtual payouts) makes the practice carry stakes. Success means the trader can see honestly whether they are improving.

## Positioning
Blind replay: real market data with every absolute reference (price, date) removed during play and revealed only after the session.

## Operating Context
- Sessions start at a random historical point; weekend candles are hidden.
- Lot standard follows cTrader XAUUSD: 1 lot = 100 oz, min 0.01.
- New accounts copy a versioned BEM program or custom rules. Funded-account news, risk guard and payout timing restrictions are not fully simulated.
- Data source: Dukascopy historical XAU/USD bid candles via dukascopy-node and a local Vite endpoint. Replay currently uses one price series; bid/ask spread and slippage are not simulated.

## Capabilities and Constraints
Dashboard, challenge packages (5k–100k), live rule tracking, violation, funded, payouts; blind chart with replay, multi-timeframe, session clock, economic event markers; market/limit/stop orders placed and dragged on the chart; risk calculator; TradingView-style indicator set (phased); drawing tools; journal with automatic screenshots; trade replay; statistics and heatmap; local backup export/import. UI language: Turkish. Nothing outside PLAN.md is added without the user's approval.

## Brand Commitments
- Name: S2C. The user asked for a radical emblem.
- Everything is custom: no emoji, no stock icon sets, original sounds, original motion.
- Colours and professional finish are the user's red line. The reference bar is a dense, calm, precise dark trading terminal.
- No filler copy, slogans or fake numbers.

## Evidence on Hand
- No existing assets.
- Every number shown comes from real market data or from the user's own trades.

## Product Principles
- Honesty over comfort: the numbers show the truth about the trader's performance.
- The chart is the hero; chrome recedes.
- Stakes are felt: rules, violations and funding have weight.
- Nothing appears that the user did not ask for.
