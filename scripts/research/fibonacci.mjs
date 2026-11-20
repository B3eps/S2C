export const variants = [
  { id: 'fib-60-70', shallow: 0.60, deep: 0.70, fvg: false },
  { id: 'control-35-45', shallow: 0.35, deep: 0.45, fvg: false },
  { id: 'fib-fvg', shallow: 0.60, deep: 0.70, fvg: true },
];

function pivot(history, i) {
  const b = history[i];
  const neighbors = history.slice(i - 3, i + 4).filter(x => x !== b);
  const up = neighbors.every(x => x.h < b.h);
  const down = neighbors.every(x => x.l > b.l);
  if (up === down) return undefined;
  return { i, t: b.t, type: up ? 'high' : 'low', price: up ? b.h : b.l };
}

function hasImpulseGap(history, start, end, sign, low, high) {
  for (let i = start + 2; i <= end; i++) {
    const a = history[i - 2], c = history[i];
    const lower = sign > 0 ? a.h : c.h;
    const upper = sign > 0 ? c.l : a.l;
    if (Math.max(lower, low) < Math.min(upper, high)) return true;
  }
  return false;
}

export function detector(variant) {
  let lastPivot, setup;
  return (history, atr) => {
    const i = history.length - 1, b = history[i], prev = history[i - 1];
    if (i < 6) return;
    const next = pivot(history, i - 3);
    if (next && (!lastPivot || next.type !== lastPivot.type ||
      (next.type === 'high' ? next.price > lastPivot.price : next.price < lastPivot.price))) {
      if (lastPivot && next.type !== lastPivot.type) {
        setup = undefined;
        const n = next.i - lastPivot.i;
        const sign = next.type === 'high' ? 1 : -1;
        const size = sign * (next.price - lastPivot.price);
        if (atr && n >= 5 && n <= 60 && size >= 4 * atr) {
          const shallow = next.price - sign * size * variant.shallow;
          const deep = next.price - sign * size * variant.deep;
          const fvg = hasImpulseGap(history, lastPivot.i, next.i, sign, Math.min(shallow, deep), Math.max(shallow, deep));
          if (!variant.fvg || fvg) setup = { sign, shallow, deep, origin: lastPivot, tip: next, atr, fvg, known: i };
        }
      }
      lastPivot = next;
    }
    if (!setup || !atr) return;
    const { sign, shallow, deep, known, touched } = setup;
    const extreme = sign > 0 ? b.l : b.h;
    if (sign * (extreme - deep) < -0.05 * setup.atr ||
        (touched === undefined ? i - known > 18 : i - touched > 4)) {
      setup = undefined;
      return;
    }
    // Only later bars can touch a zone created at this bar's close.
    if (i === known) return;
    if (sign * (extreme - shallow) <= 0 && touched === undefined) {
      setup.touched = i;
      setup.extreme = extreme;
    }
    if (setup.touched === undefined) return;
    setup.extreme = sign > 0 ? Math.min(setup.extreme, extreme) : Math.max(setup.extreme, extreme);
    if (sign * (b.c - shallow) <= 0 || sign * (b.c - (sign > 0 ? prev.h : prev.l)) <= 0) return;
    const signal = {
      side: sign > 0 ? 'long' : 'short', stopBid: setup.extreme - sign * 0.20 * atr, rr: 1.5,
      context: { pivotFrom: setup.origin.t, pivotTo: setup.tip.t, knownAt: history[known].t + 60000,
        zone: [Math.min(deep, shallow), Math.max(deep, shallow)], fvg: setup.fvg, atr },
    };
    setup = undefined;
    return signal;
  };
}
