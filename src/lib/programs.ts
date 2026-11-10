import type { Rules } from './types';

/**
 * Challenge programs modelled on BEM Funding (bemfunding.com, cTrader listing, Nov 2026).
 * Prices are list prices; the trader always buys at the standing discount.
 * - Profitable day: a replay day whose realised profit is at least 0.5% of the account size.
 * - Payouts: trader share of at least $150.
 * - Commission on metals: 0.001% of notional per side.
 * Unknowns (drawdown type) are modelled as static.
 */
export const DISCOUNT = 0.4;

export interface Program {
  id: string;
  name: string;
  kind: string;
  prices: Record<number, number>;
  rules: Rules;
}

const common = { minDays: 3, minDayPct: 0.5, split: 80, payoutMin: 0, payoutMinUsd: 150, commissionPct: 0.001 };

export const PROGRAMS: Program[] = [
  {
    id: 'bem-classic',
    name: 'BEM Classic Normal',
    kind: '2 aşama',
    prices: { 5000: 39, 10000: 99, 25000: 211, 50000: 321, 100000: 519 },
    rules: { ...common, target: 9, targets: [9, 4.5], dailyLoss: 4.5, maxLoss: 9 },
  },
  {
    id: 'bem-swing',
    name: 'BEM Classic Swing',
    kind: '2 aşama',
    prices: { 5000: 69, 10000: 155, 25000: 296, 50000: 447, 100000: 890 },
    rules: { ...common, target: 9, targets: [9, 5], dailyLoss: 5, maxLoss: 9 },
  },
  {
    id: 'bem-extended',
    name: 'BEM Extended',
    kind: '2 aşama',
    prices: { 5000: 39, 10000: 95, 25000: 199, 50000: 299, 100000: 499 },
    rules: { ...common, target: 10, targets: [10, 5], dailyLoss: 4, maxLoss: 8 },
  },
  {
    id: 'bem-one',
    name: 'BEM One',
    kind: '1 aşama',
    prices: { 5000: 47, 10000: 89, 25000: 194, 50000: 285, 100000: 520 },
    rules: { ...common, target: 9, targets: [9], dailyLoss: 3, maxLoss: 6 },
  },
];

export const salePrice = (list: number) => Math.round(list * (1 - DISCOUNT) * 100) / 100;

/** Profit targets per step; old accounts only carry `target`. */
export const stepTargets = (r: Rules) => (r.targets && r.targets.length ? r.targets : [r.target]);
