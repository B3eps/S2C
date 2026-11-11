import type { Bar } from './types';

const HOUR = 3_600_000;
const DAY = 86_400_000;

function nthSunday(year: number, month: number, n: number) {
  const first = (7 - new Date(Date.UTC(year, month, 1)).getUTCDay()) % 7;
  return Date.UTC(year, month, 1 + first + (n - 1) * 7);
}

/** US daylight time: 2nd Sunday of March → 1st Sunday of November, switching at 02:00 local. */
export function usDst(ms: number) {
  const y = new Date(ms).getUTCFullYear();
  return ms >= nthSunday(y, 2, 2) + 7 * HOUR && ms < nthSunday(y, 10, 1) + 6 * HOUR;
}

/** New York wall clock as a UTC-shaped timestamp (read it with getUTC*). */
const nyLocal = (ms: number) => ms - (usDst(ms) ? 4 : 5) * HOUR;

/**
 * Spot gold follows New York: closed Friday 17:00 → Sunday 18:00 New York time. In UTC that is
 * 21:00 → 22:00 in summer and 22:00 → 23:00 in winter, so a fixed UTC rule drops a real hour.
 */
export function isClosed(t: number) {
  const d = new Date(nyLocal(t));
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  return (day === 5 && h >= 17) || day === 6 || (day === 0 && h < 18);
}

/** UTC start (17:00 New York) of the trading day that contains `t`. Sunday evening belongs to Monday. */
export function dayStart(t: number) {
  const offset = (usDst(t) ? 4 : 5) * HOUR;
  const key = Math.floor((t - offset + 7 * HOUR) / DAY);
  return key * DAY - 7 * HOUR + offset;
}

/** A trading-day candle. `t` is the first traded hour, `end` the 17:00 New York close. */
export interface DayBar extends Bar {
  end: number;
}

/** Daily candles on the 17:00 New York cut, the convention of gold brokers and TradingView. */
export function dailyBars(h1: Bar[]): DayBar[] {
  const out: DayBar[] = [];
  for (const b of h1) {
    const end = dayStart(b.t) + DAY;
    const last = out[out.length - 1];
    if (last && last.end === end) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else out.push({ ...b, end });
  }
  return out;
}
