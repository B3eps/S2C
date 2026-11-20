import { minute } from './data.mjs';

export const variants = [
  { id: 'reentry', confirm: false },
  { id: 'reentry-confirm', confirm: true },
];

export function detector(variant) {
  const latest = new Map();
  let pending;
  return (history, atr, start) => {
    const i = history.length - 1, b = history[i];
    const offset = (b.t - start) / minute;
    if (i < 60 || !atr || offset < 480 || offset >= 960) return;
    const build = setup => ({
      side: setup.sign > 0 ? 'long' : 'short', stopBid: setup.extreme - setup.sign * 0.20 * setup.atr, rr: 1.5,
      context: { low: setup.low, high: setup.high, sweep: setup.extreme, atr: setup.atr, waited: i - setup.at },
    });
    if (pending) {
      const { sign, extreme, trigger, at } = pending;
      if (i - at > 3 || sign * ((sign > 0 ? b.l : b.h) - extreme) < 0) pending = undefined;
      else if (sign * (b.c - trigger) > 0) {
        const signal = build(pending);
        pending = undefined;
        return signal;
      } else return;
    }
    const channel = history.slice(i - 60, i);
    const low = Math.min(...channel.map(x => x.l));
    const high = Math.max(...channel.map(x => x.h));
    if (high - low < 4 * atr || (b.l < low && b.h > high)) return;
    for (const sign of [1, -1]) {
      const edge = sign > 0 ? low : high;
      const extreme = sign > 0 ? b.l : b.h;
      if (i - (latest.get(sign) ?? -Infinity) < 45 ||
          sign * (extreme - edge) > -0.15 * atr || sign * (b.c - edge) < 0.10 * atr) continue;
      latest.set(sign, i);
      const setup = { sign, low, high, extreme, atr, at: i, trigger: sign > 0 ? b.h : b.l };
      if (!variant.confirm) return build(setup);
      pending = setup;
      return;
    }
  };
}
