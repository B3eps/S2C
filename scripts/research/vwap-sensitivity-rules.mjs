import { minute } from './data.mjs';

export const defaultSettings = {
  anchor: 420, atrLength: 20, outer: 2, inner: 1, outerClose: 1.5,
  stopPad: 0.25, cooldown: 30, body: true, slopeLimit: Infinity,
  weighting: 'volume', geometry: 1.25, targetR: 1.25,
};

export const variants = [
  ['original', {}],
  ['equal-weight', { weighting: 'time' }],
  ['anchor-0800', { anchor: 480 }],
  ['atr-10', { atrLength: 10 }], ['atr-40', { atrLength: 40 }],
  ['outer-1.8', { outer: 1.8 }], ['outer-2.2', { outer: 2.2 }],
  ['inner-0.75', { inner: 0.75 }],
  ['no-body-filter', { body: false }],
  ['slope-0.50', { slopeLimit: 0.50 }], ['slope-0.25', { slopeLimit: 0.25 }],
  ['stop-0.10', { stopPad: 0.10 }], ['stop-0.40', { stopPad: 0.40 }],
  ['cooldown-0', { cooldown: 0 }],
  ['target-1.00R', { targetR: 1.0 }], ['target-1.50R', { targetR: 1.5 }],
  ['fixed-vwap-target', { openAdjustment: 'reference' }],
  ['no-geometry-gate', { geometry: 0 }],
  ['spread-0.40', { spread: 0.40 }], ['spread-0.60', { spread: 0.60 }],
  ['reverse-direction', { openAdjustment: 'reverse' }],
];

export function detector(settings) {
  const s = { ...defaultSettings, ...settings };
  let weight = 0, weighted = 0, last = -Infinity;
  const references = [];
  return (history, atr20, start) => {
    const i = history.length - 1;
    const b = history[i];
    const offset = (b.t - start) / minute;
    if (history[0].t !== start + 420 * minute || offset < s.anchor) return;
    const reference = references.at(-1);
    const before = references.at(-16);
    const w = s.weighting === 'volume' ? b.v : 1;
    weight += w;
    weighted += (b.h + b.l + b.c) / 3 * w;
    references.push(weight > 0 ? weighted / weight : undefined);
    if (reference === undefined || offset < 480 || offset >= 960 || i - last < s.cooldown) return;
    let atr = atr20;
    if (s.atrLength !== 20) {
      if (i < s.atrLength) return;
      let sum = 0;
      for (let j = i - s.atrLength; j < i; j++) {
        const p = history[j];
        const previous = history[j - 1]?.c ?? p.o;
        sum += Math.max(p.h - p.l, Math.abs(p.h - previous), Math.abs(p.l - previous));
      }
      atr = sum / s.atrLength;
    }
    if (!atr) return;
    const slope = before === undefined ? undefined : Math.abs(reference - before) / atr;
    if (Number.isFinite(s.slopeLimit) && (slope === undefined || slope > s.slopeLimit)) return;
    if (b.l <= reference - s.outer * atr && b.h >= reference + s.outer * atr) return;
    for (const sign of [1, -1]) {
      const extreme = sign > 0 ? b.l : b.h;
      const distance = sign * (reference - b.c);
      if (sign * (reference - extreme) < s.outer * atr || distance < s.inner * atr || distance > s.outerClose * atr ||
          (s.body && sign * (b.c - b.o) <= 0)) continue;
      const stopBid = extreme - sign * s.stopPad * atr;
      if (distance < s.geometry * sign * (b.c - stopBid)) continue;
      last = i;
      return { side: sign > 0 ? 'long' : 'short', stopBid, rr: s.targetR, context: { reference, slope, atr, extreme } };
    }
  };
}

export function adjustAtOpen(session, mode, spread, entryPrice, markPrice) {
  if (!mode) return session;
  const signals = new Map();
  let skipped = 0;
  for (const b of session.bars) {
    const signal = session.signals.get(b.t);
    if (!signal) continue;
    const { side, stopBid, context } = signal;
    const sign = side === 'long' ? 1 : -1;
    if (mode === 'reverse') {
      const distance = sign * (b.o - stopBid);
      if (distance > 0) signals.set(b.t, { ...signal, side: sign > 0 ? 'short' : 'long', stopBid: b.o + sign * distance });
      else skipped++;
      continue;
    }
    const entry = entryPrice(side, b.o, spread);
    const stop = markPrice(side, stopBid, spread);
    const target = markPrice(side, context.reference, spread);
    const risk = sign * (entry - stop);
    const reward = sign * (target - entry);
    if (risk > 0 && reward > 0) signals.set(b.t, { ...signal, rr: reward / risk });
    else skipped++;
  }
  return { ...session, signals, skippedOpenAdjustment: skipped };
}
