import { minute } from './data.mjs';

export const variants = [
  { id: 'opening-breakout', retest: false },
  { id: 'opening-retest', retest: true },
];

export function detector(variant) {
  let range, pending;
  const used = new Set();
  return (history, atr, start) => {
    const i = history.length - 1, b = history[i], prev = history[i - 1];
    const offset = (b.t - start) / minute;
    if (i === 29 && offset === 449) {
      range = { high: Math.max(...history.map(x => x.h)), low: Math.min(...history.map(x => x.l)) };
    }
    if (!range || !atr || offset < 450 || offset >= 660) return;
    const signal = (sign, stopBid, edge, minutesFromBreak) => ({
      side: sign > 0 ? 'long' : 'short', stopBid, rr: 1.5,
      context: { ...range, edge, atr, minutesFromBreak },
    });
    if (pending) {
      const { sign, level, at } = pending;
      if (i - at > 10 || sign * (b.c - level) < -0.5 * atr) pending = undefined;
      else if (sign * ((sign > 0 ? b.l : b.h) - level) <= 0.15 * atr &&
               sign * (b.c - level) > 0 && sign * (b.c - (sign > 0 ? prev.h : prev.l)) > 0) {
        pending = undefined;
        return signal(sign, (sign > 0 ? b.l : b.h) - sign * 0.20 * atr, level, i - at);
      }
    }
    for (const sign of [1, -1]) {
      const level = sign > 0 ? range.high : range.low;
      if (used.has(sign) || sign * (prev.c - level) > 0 || sign * (b.c - level) < 0.15 * atr) continue;
      used.add(sign);
      if (variant.retest) {
        pending = { sign, level, at: i };
      } else {
        const prices = history.slice(i - 2).map(x => sign > 0 ? x.l : x.h);
        const stop = sign > 0 ? Math.min(...prices) : Math.max(...prices);
        return signal(sign, stop - sign * 0.20 * atr, level, 0);
      }
    }
  };
}
