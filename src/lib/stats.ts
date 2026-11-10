import type { Trade } from './types';

export interface Summary {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number | undefined;
  totalR: number;
  profitFactor: number | undefined;
  net: number;
  avgWin: number;
  avgLoss: number;
  maxDD: number;
  bestStreak: number;
  worstStreak: number;
  curve: { i: number; v: number; t: number; tradeId?: string; pnl?: number }[];
}

export function summarize(trades: Trade[]): Summary {
  const ts = [...trades].sort((a, b) => a.realClosedAt - b.realClosedAt);
  const wins = ts.filter((t) => t.pnl > 0);
  const losses = ts.filter((t) => t.pnl < 0);
  const grossW = wins.reduce((a, t) => a + t.pnl, 0);
  const grossL = -losses.reduce((a, t) => a + t.pnl, 0);
  const withR = ts.filter((t) => t.r !== undefined && isFinite(t.r));
  let eq = 0, peak = 0, maxDD = 0, run = 0, best = 0, worst = 0;
  const curve: Summary['curve'] = [{ i: 0, v: 0, t: ts[0]?.realClosedAt ?? 0 }];
  ts.forEach((t, i) => {
    eq += t.pnl;
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, peak - eq);
    if (t.pnl > 0) run = run > 0 ? run + 1 : 1;
    else if (t.pnl < 0) run = run < 0 ? run - 1 : -1;
    best = Math.max(best, run);
    worst = Math.min(worst, run);
    curve.push({ i: i + 1, v: eq, t: t.realClosedAt, tradeId: t.id, pnl: t.pnl });
  });
  return {
    count: ts.length,
    wins: wins.length,
    losses: losses.length,
    winRate: ts.length ? (wins.length / ts.length) * 100 : 0,
    avgR: withR.length ? withR.reduce((a, t) => a + (t.r as number), 0) / withR.length : undefined,
    totalR: withR.reduce((a, t) => a + (t.r as number), 0),
    profitFactor: grossL > 0 ? grossW / grossL : grossW > 0 ? Infinity : undefined,
    net: grossW - grossL,
    avgWin: wins.length ? grossW / wins.length : 0,
    avgLoss: losses.length ? grossL / losses.length : 0,
    maxDD,
    bestStreak: best,
    worstStreak: -worst,
    curve,
  };
}

export type HeatMetric = 'count' | 'winrate' | 'r';
export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];

/** hour (UTC) × weekday grid from replay entry times. */
export function heatGrid(trades: Trade[], metric: HeatMetric) {
  const cells: { n: number; w: number; r: number }[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 24 }, () => ({ n: 0, w: 0, r: 0 })),
  );
  for (const t of trades) {
    const d = new Date(t.openedAt);
    const wd = d.getUTCDay() - 1;
    if (wd < 0 || wd > 4) continue;
    const c = cells[wd][d.getUTCHours()];
    c.n++;
    if (t.pnl > 0) c.w++;
    c.r += t.r ?? 0;
  }
  return cells.map((row) =>
    row.map((c) => ({
      n: c.n,
      value: c.n === 0 ? undefined : metric === 'count' ? c.n : metric === 'winrate' ? (c.w / c.n) * 100 : c.r,
    })),
  );
}
