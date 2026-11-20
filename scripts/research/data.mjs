import { readFileSync, existsSync } from 'node:fs';
import { getHistoricalRates } from 'dukascopy-node';
import { createHash } from 'node:crypto';

export const minute = 60_000;
export const day = 1440 * minute;
export const isoDay = t => new Date(t).toISOString().slice(0, 10);
export const cache = '.cache/dukascopy';

export const splits = {
  development: ['2026-01-05', '2026-05-01'],
  validation: ['2026-05-04', '2026-08-08'],
};
export const holdouts = {
  fib: ['2026-09-07', '2026-10-19', []],
  opening: ['2026-10-19', '2026-11-02', ['2026-10-20', '2026-10-21']],
  failed: ['2026-11-02', '2026-11-09', ['2026-11-03']],
  vwap: ['2026-11-09', '2026-11-19', []],
};

export function cacheFile(t) {
  const d = new Date(t);
  return `${cache}/${encodeURIComponent(`candles/minute/XAU-USD/BID/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`)}.json`;
}

export async function loadSessions([start, end, excluded = []]) {
  const sessions = [];
  const unavailable = [];
  const hash = createHash('sha256');
  for (let t = Date.parse(start); t < Date.parse(end); t += day) {
    const date = isoDay(t);
    const weekday = new Date(t).getUTCDay();
    if (weekday === 0 || weekday === 6 || excluded.includes(date)) continue;
    const file = cacheFile(t);
    if (!existsSync(file)) { unavailable.push(date); continue; }
    const raw = readFileSync(file);
    hash.update(date).update(raw);
    const rows = await getHistoricalRates({
      instrument: 'xauusd', dates: { from: new Date(t), to: new Date(t + day) },
      timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true,
      useCache: true, cacheFolderPath: cache,
    });
    const bars = [];
    let previous = -Infinity;
    for (const { timestamp: time, open: o, high: h, low: l, close: c, volume: v } of rows) {
      if (![time, o, h, l, c, v].every(Number.isFinite) || time % minute || time <= previous ||
          time < t || time >= t + day || l <= 0 || l > Math.min(o, c) || h < Math.max(o, c) || v < 0) {
        throw new Error(`Invalid M1 row in ${file}: ${time}`);
      }
      previous = time;
      if (time >= t + 420 * minute) bars.push({ t: time, o, h, l, c, v });
    }
    const inSession = bars.filter(b => b.t < t + 1140 * minute);
    const after = bars.find(b => b.t >= t + 1140 * minute);
    const missing = 720 - inSession.length;
    // A session without 90% of its scheduled minutes, or without an observable
    // end-of-session execution quote, stays outside the estimand.
    const eligible = missing <= 72 && !!after;
    sessions.push({ date, t, missing, eligible, bars: eligible ? [...inSession, after] : [] });
  }
  if (unavailable.length) throw new Error(`Missing cache files (${unavailable.length}): ${unavailable.join(', ')}`);
  return { start, end, excluded, hash: hash.digest('hex'), sessions };
}
