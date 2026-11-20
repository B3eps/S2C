import { splitFor, stepTargets } from './programs';
import type { Account, SessionRec } from './types';

export function maximumLossFloor(a: Pick<Account, 'size' | 'rules'>, peak: number) {
  const loss = a.size * a.rules.maxLoss / 100;
  const initialFloor = a.size - loss;
  return a.rules.maxType === 'trailing' ? Math.min(a.size, Math.max(initialFloor, peak - loss)) : initialFloor;
}

export function accountLimits(a: Account, s: SessionRec | null) {
  const size = a.size;
  const targets = stepTargets(a.rules);
  const step = Math.min(a.step ?? 0, targets.length - 1);
  const dayFloor = (s?.dayStartEquity ?? a.balance) - (size * a.rules.dailyLoss) / 100;
  const maxFloor = maximumLossFloor(a, a.peak ?? size);
  const buffer = (a.rules.retainedProfitUsd ?? 0) + ((a.rules.payoutBufferPct ?? 0) / 100) * ((size * a.rules.dailyLoss) / 100);
  const targetPct = targets[step];
  const target = size * (1 + targetPct / 100);
  const minGross = Math.max(a.rules.payoutMinUsd ?? 0, size * a.rules.dailyLoss * (a.rules.payoutMinimumDailyPct ?? 0) / 10000) / (splitFor(a.rules, a.payouts.length) / 100);
  const payoutAt = Math.max(size * (1 + a.rules.payoutMin / 100), size + buffer + minGross, size + 0.01);
  return { dayFloor, maxFloor, target, targetPct, step, steps: targets.length, payoutAt, buffer };
}

/** Days that count toward the minimum: profitable days when the program asks for them, else any traded day. */
export function countedDays(a: Account) {
  const pct = a.rules.minDayPct ?? 0;
  if (!pct) return new Set(a.tradingDays).size;
  const need = (a.size * pct) / 100;
  return Object.values(a.dayPnl ?? {}).filter((v) => v >= need).length;
}

