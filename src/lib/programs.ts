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
  rules: Rules;
}

const base = { rulesVersion: '2026-11-10', split: 80, payoutMin: 0, payoutMinUsd: 150, commissionPct: 0.001 };

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
];

export const salePrice = (list: number) => Math.round(list * (1 - DISCOUNT) * 100) / 100;

/** Profit targets per step; old accounts only carry `target`. */
export const stepTargets = (r: Rules) => (r.targets && r.targets.length ? r.targets : [r.target]);

/** The prop day runs 22:00 → 22:00 UTC. */
export const propDay = (ms: number) => new Date(ms + 2 * 3_600_000).toISOString().slice(0, 10);
