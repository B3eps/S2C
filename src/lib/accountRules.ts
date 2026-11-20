import { splitFor, stepTargets } from './programs';
import type { Account, SessionRec } from './types';
import { money0 } from './format';

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


/** Best day as a % of total realised profit (the firm's consistency score). */
export function consistencyScore(a: Account) {
  const days = Object.values(a.dayPnl ?? {});
  const total = days.reduce((x, y) => x + y, 0);
  if (total <= 0) return 0;
  return (Math.max(...days) / total) * 100;
}

/** Why a payout cannot be requested now, or null. */
export function payoutBlocker(a: Account, openPositions: number): string | null {
  if (a.phase !== 'funded' || a.status !== 'active') return null;
  const lim = accountLimits(a, null);
  if (openPositions) return 'Ödeme için açık pozisyon olmamalı.';
  if (a.balance < lim.payoutAt) return `Ödeme için bakiye en az ${money0(lim.payoutAt)} olmalı.`;
  const need = a.rules.payoutMinDays ?? 0;
  const have = new Set(a.payoutDays ?? []).size;
  if (have < need) return `Ödeme için ${need - have} işlem günü daha gerekli.`;
  const cap = a.rules.payoutConsistencyPct;
  if (cap && consistencyScore(a) > cap) return `Tutarlılık: en iyi gün toplam kârın %${consistencyScore(a).toFixed(0)}’i (sınır %${cap}).`;
  return null;
}

/** Why a reached target has not passed yet, or null when it can pass now. */
export function passBlocker(a: Account, openPositions: number): string | null {
  const lim = accountLimits(a, null);
  if (a.phase !== 'challenge' || a.status !== 'active' || a.balance < lim.target) return null;
  const days = countedDays(a);
  if (days < a.rules.minDays) {
    const left = a.rules.minDays - days;
    return a.rules.minDayPct ? `Hedef tamam · ${left} kârlı gün daha (günde en az %${String(a.rules.minDayPct).replace('.', ',')})` : `Hedef tamam · ${left} işlem günü daha`;
  }
  if (openPositions) return 'Hedef tamam · açık pozisyonları kapat';
  const cap = a.rules.consistencyPct;
  if (cap && consistencyScore(a) > cap) return `Hedef tamam · tutarlılık: en iyi gün kârın %${consistencyScore(a).toFixed(0)}’i (sınır %${cap})`;
  return null;
}
