import { day, minute } from './data.mjs';

/** Build nearby H1 targets from fully observed hourly candles. A wick that
 * touches a previously available target consumes it immediately. */
export function h1Targets(bars, events) {
  const width = 60 * minute;
  const eventAt = new Map(events.map(e => [e.setupAt, e]));
  const found = new Map();
  let bucket, recent = [], open = [], prior;
  for (const b of bars) {
    if (prior && b.t - prior.t !== minute) {
      // Keep no level through an unobserved interval where it might have traded.
      bucket = undefined; recent = []; open = [];
    }
    prior = b;
    const now = b.t + minute;
    open = open.filter(p => p.side > 0 ? b.h < p.price : b.l > p.price);
    const hour = Math.floor(b.t / width) * width;
    if (bucket?.t !== hour) bucket = { t: hour, h: b.h, l: b.l, count: 1 };
    else { bucket.h = Math.max(bucket.h, b.h); bucket.l = Math.min(bucket.l, b.l); bucket.count++; }
    if (now === hour + width && bucket.count === 60) {
      recent.push(bucket);
      if (recent.length === 5) {
        const center = recent[2];
        const neighbors = recent.filter((_, i) => i !== 2);
        if (neighbors.every(x => x.h < center.h)) open.push({ side: 1, price: center.h, t: center.t, knownAt: now });
        if (neighbors.every(x => x.l > center.l)) open.push({ side: -1, price: center.l, t: center.t, knownAt: now });
        recent.shift();
      }
    }
    const event = eventAt.get(now);
    if (!event) continue;
    const { side } = event;
    const target = open.filter(p => p.side === side && side * (p.price - b.c) > 0.10)
      .sort((a, z) => side * (a.price - z.price))[0];
    if (target) found.set(now, target);
  }
  return found;
}

function stillValid(b, setup, scan) {
  const state = scan.contextByClose.get(b.t + minute);
  const { side, stopBid, targetBid } = setup;
  return state?.m1 === side && state.m15 === side &&
    side * ((side > 0 ? b.l : b.h) - stopBid) > 0 &&
    side * ((side > 0 ? b.h : b.l) - targetBid) < 0;
}

export function sweepDisplacementRetests(session, scan) {
  const times = new Map(session.bars.map((b, i) => [b.t, i]));
  const selected = [];
  for (const setup of scan.events) {
    if (!setup.sweep || setup.targetBid === null) continue;
    const { side, atr, setupAt } = setup;
    const i = times.get(setupAt - minute);
    if (i === undefined || i < 1) continue;
    const [a, b, c] = session.bars.slice(i - 1, i + 2);
    if (!c || a.t !== b.t - minute || c.t !== setupAt ||
        side * (b.c - b.o) < atr || !stillValid(c, setup, scan)) continue;
    const lo = side > 0 ? a.h : c.h;
    const hi = side > 0 ? c.l : a.l;
    if (hi - lo < Math.max(0.20, atr * 0.10)) continue;
    const knownAt = c.t + minute;
    for (let k = 0; k < 8; k++) {
      const x = session.bars[i + 2 + k];
      if (!x || x.t !== knownAt + k * minute || x.t >= session.t + 960 * minute || !stillValid(x, setup, scan)) break;
      if (side > 0 ? x.c < lo : x.c > hi) break;
      if (x.l <= hi && x.h >= lo && side * (x.c - (side > 0 ? hi : lo)) > 0) {
        selected.push({ ...setup, setupAt: x.t + minute, originalSetupAt: setupAt,
          displacementZone: { lo, hi, knownAt } });
        break;
      }
    }
  }
  return selected;
}

export function completedUtcDay(bars, start) {
  assertUtcWindow(bars, start);
  if (bars.length < 1200) return null;
  return { t: start, knownAt: start + day, h: Math.max(...bars.map(b => b.h)),
    l: Math.min(...bars.map(b => b.l)), c: bars.at(-1).c };
}

function assertUtcWindow(bars, start) {
  if (bars.some(b => b.t < start || b.t >= start + day)) throw new Error('Out-of-day bar');
}

/** Closed-day zones supply possible directions, and the current M1 reaction chooses one. */
export function dailyReactions(previousDays, bars, events, start) {
  if (previousDays.some(d => d.knownAt > start)) throw new Error('An open day cannot be a bias source');
  const zones = [];
  for (let i = 2; i < previousDays.length; i++) {
    const [a, mid, c] = previousDays.slice(i - 2, i + 1);
    if (start - c.knownAt > 15 * day || c.t - mid.t > 3 * day || mid.t - a.t > 3 * day) continue;
    for (const side of [1, -1]) {
      const low = side > 0 ? a.h : c.h;
      const high = side > 0 ? c.l : a.l;
      if (high - low < 0.20) continue;
      const invalidated = previousDays.slice(i + 1).some(d => side > 0 ? d.c < low : d.c > high);
      if (!invalidated) zones.push({ side, low, high, formed: c.knownAt, touched: -Infinity, flipped: false });
    }
  }
  const openings = new Map(events.map(e => [e.setupAt, e]));
  const selected = [];
  let previous;
  for (const b of bars) {
    const now = b.t + minute;
    if (previous && b.t - previous.t !== minute) {
      for (const z of zones) z.touched = -Infinity;
    }
    previous = b;
    for (const z of zones) {
      if (z.dead) continue;
      if (z.side > 0 ? b.c < z.low : b.c > z.high) {
        if (z.flipped) z.dead = true;
        else {
          z.side *= -1;
          z.flipped = true;
          z.touched = -Infinity;
        }
        continue;
      }
      if (b.l <= z.high && b.h >= z.low && z.side * (b.c - (z.low + z.high) / 2) > 0) z.touched = now;
    }
    const event = openings.get(now);
    if (!event) continue;
    const active = zones.filter(z => !z.dead && now - z.touched <= 120 * minute)
      .sort((a, b) => b.touched - a.touched || b.formed - a.formed)[0];
    if (active?.side === event.side) selected.push({ ...event, daily: { ...active } });
  }
  return selected;
}
