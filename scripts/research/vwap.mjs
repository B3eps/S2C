import { minute } from './data.mjs';

export const variants = [
  { id: 'vwap-reversion', slope: false },
  { id: 'vwap-flat', slope: true },
];

export function detector(variant) {
  let totalVolume = 0, weighted = 0, last = -Infinity;
  const references = [];
  const rr = 1.25;
  return (history, atr, start) => {
    const i = history.length - 1, b = history[i];
    if (history[0].t !== start + 420 * minute) return;
    const reference = references.at(-1);
    const before = references.at(-16);
    totalVolume += b.v;
    weighted += (b.h + b.l + b.c) / 3 * b.v;
    references.push(totalVolume > 0 ? weighted / totalVolume : undefined);
    const offset = (b.t - start) / minute;
    if (reference === undefined || !atr || offset < 480 || offset >= 960 || i - last < 30) return;
    const slope = before === undefined ? undefined : Math.abs(reference - before) / atr;
    if (variant.slope && (slope === undefined || slope > 0.50)) return;
    if (b.l <= reference - 2 * atr && b.h >= reference + 2 * atr) return;
    for (const sign of [1, -1]) {
      const extreme = sign > 0 ? b.l : b.h;
      const distance = sign * (reference - b.c);
      if (sign * (reference - extreme) < 2 * atr || distance < atr || distance > 1.5 * atr ||
          sign * (b.c - b.o) <= 0) continue;
      const stopBid = extreme - sign * 0.25 * atr;
      if (distance < rr * sign * (b.c - stopBid)) continue;
      last = i;
      return { side: sign > 0 ? 'long' : 'short', stopBid, rr, context: { reference, slope, atr, extreme } };
    }
  };
}
