import type { Rules } from './types';

/**
 * Challenge programs as published on bemfunding.com (cTrader, read Nov 2026):
 * the challenge selector for prices and limits, /terms-of-use/<program> for the rules.
 * The trader always buys at the standing discount (DISCOUNT), as the user asked.
 *
 * Common to all programs:
 * - Day boundary is 22:00 UTC.
 * - Commissions count toward drawdown; the metals rate (0.001% per side) comes from the
 *   firm's cTrader listing.
 *
 * Not modelled (no effect in replay, or no number published):
 * - News window and Friday close after activation.
 * - Max risk per symbol / Equity Guard after activation.
 * - Payout calendar ("every 14 days" on Classic).
 */
export const DISCOUNT = 0.4;

export interface Program {
  id: string;
  name: string;
  kind: string;
  prices: Record<number, number>;
  /** this program's standing discount; DISCOUNT when missing */
  discount?: number;
  rules: Rules;
}

/** Trader share of the next payout, given how many were already approved. */
export const splitFor = (r: Rules, approved: number) => {
  const l = r.splitLadder;
  return l && l.length ? l[Math.min(approved, l.length - 1)] : r.split;
};

const base = { rulesVersion: '2026-11-10', split: 80, payoutMin: 0, payoutMinUsd: 150, payoutFeePct: 2, commissionPct: 0.001 };

/**
 * FTM Perps "Infinity" plans (ftmperps.com, read Nov 2026): $5K / $10K / $20K, one phase,
 * no time limit, no consistency rule, no minimum days, no payout buffer or cap, static max loss,
 * daily loss 3% of the initial balance measured from the higher of balance/equity at the daily reset,
 * payouts any day from $50 once the balance is 1% above the start, split 80/80/80/80/85/90,
 * commission 0.005% per side on gold, no swap, gold leverage 10x. The standing discount is 50%.
 * Infinity's max loss is 3% (FAQ, third-party listings); one marketing line on the site says 5%.
 * Not modelled: 24/7 trading and weekend candles, the $40K total allocation, the double-pay guarantee.
 */
const ftm = {
  rulesVersion: '2026-11-13',
  split: 80,
  splitLadder: [80, 80, 80, 80, 85, 90],
  payoutMin: 1,
  payoutMinUsd: 50,
  payoutFeePct: 0,
  commissionPct: 0.005,
  dailyLoss: 3,
  dailyBase: 'max' as const,
  maxType: 'static' as const,
  minDays: 0,
  goldLeverage: 10,
  cryptoLeverage: 8,
  cryptoCommissionPct: 0.03,
};

export const PROGRAMS: Program[] = [
  {
    id: 'bem-classic',
    name: 'BEM Classic Normal',
    kind: '2 aşama',
    prices: { 5000: 39, 10000: 99, 25000: 211, 50000: 321, 100000: 519 },
    rules: {
      ...base,
      target: 9,
      targets: [9, 4.5],
      dailyLoss: 4.5,
      dailyBase: 'max',
      maxLoss: 9,
      maxType: 'static',
      minDays: 3,
      minDayPct: 0.5,
      payoutMinDays: 3,
    },
  },
  {
    id: 'bem-swing',
    name: 'BEM Classic Swing',
    kind: '2 aşama',
    prices: { 5000: 69, 10000: 155, 25000: 296, 50000: 447, 100000: 890 },
    rules: {
      ...base,
      target: 9,
      targets: [9, 4.5],
      dailyLoss: 4.5,
      dailyBase: 'balance',
      maxLoss: 9,
      maxType: 'static',
      minDays: 3,
      minDayPct: 0.5,
      payoutMinDays: 3,
      commissionPct: 0.001,
    },
  },
  {
    id: 'bem-one',
    name: 'BEM One',
    kind: '1 aşama',
    prices: { 5000: 47, 10000: 89, 25000: 194, 50000: 285, 100000: 520, 200000: 790 },
    rules: {
      ...base,
      target: 9,
      targets: [9],
      dailyLoss: 3,
      dailyBase: 'max',
      maxLoss: 6,
      maxType: 'trailing',
      minDays: 0,
      payoutConsistencyPct: 35,
      payoutMinimumDailyPct: 50,
      retainedProfitUsd: 0.01, // simulation minimum positive residual; no numeric firm buffer published
    },
  },
  {
    id: 'bem-one-only',
    name: 'BEM One Only',
    kind: '1 aşama',
    prices: { 5000: 40, 10000: 90, 25000: 180, 50000: 270, 100000: 460, 200000: 750 },
    rules: {
      ...base,
      target: 6,
      targets: [6],
      dailyLoss: 3,
      dailyBase: 'balance',
      maxLoss: 6,
      maxType: 'trailing',
      minDays: 0,
      consistencyPct: 30,
      payoutConsistencyPct: 30,
      payoutBufferPct: 50,
    },
  },
  {
    id: 'ftm-infinity',
    name: 'FTM Infinity',
    kind: '1 aşama · Perps',
    discount: 0.5,
    prices: { 5000: 68, 10000: 138, 20000: 258 },
    rules: { ...ftm, target: 9, targets: [9], maxLoss: 3 },
  },
  {
    id: 'ftm-infinity-plus',
    name: 'FTM Infinity Plus',
    kind: '1 aşama · Perps',
    discount: 0.5,
    prices: { 5000: 78, 10000: 158, 20000: 298 },
    rules: { ...ftm, target: 10, targets: [10], maxLoss: 5 },
  },
];

export const salePrice = (list: number, discount = DISCOUNT) => Math.round(list * (1 - discount) * 100) / 100;
export const payoutNet = (gross: number, split: number, feePct = 0) => gross * (split / 100) * (1 - feePct / 100);

/** Profit targets per step; old accounts only carry `target`. */
export const stepTargets = (r: Rules) => (r.targets && r.targets.length ? r.targets : [r.target]);

/** The prop day runs 22:00 → 22:00 UTC. */
export const propDay = (ms: number) => new Date(ms + 2 * 3_600_000).toISOString().slice(0, 10);
