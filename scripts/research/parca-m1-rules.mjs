import { minute } from './data.mjs';

const frames = [5, 15, 240].map(n => n * minute);
const eps = 1e-8;

function swingFrame() {
  return { recent: [], high: null, low: null, dir: 0, pivots: [] };
}

/** A break uses pivots known before this bar; the bar can confirm a new pivot for the next bar. */
function structure(frame, bar, now) {
  const high = frame.high, low = frame.low;
  let broken;
  for (const pivot of [high, low]) {
    if (pivot && !pivot.broken && pivot.side * (bar.c - pivot.price) > 0) {
      pivot.broken = true;
      frame.dir = pivot.side;
      broken = pivot;
    }
  }
  const recent = frame.recent;
  recent.push(bar);
  if (recent.length > 5) recent.shift();
  if (recent.length === 5) {
    const middle = recent[2];
    const others = recent.filter((_, i) => i !== 2);
    if (others.every(b => b.h < middle.h)) {
      frame.high = { side: 1, price: middle.h, knownAt: now, t: middle.t };
      frame.pivots.push(frame.high);
    }
    if (others.every(b => b.l > middle.l)) {
      frame.low = { side: -1, price: middle.l, knownAt: now, t: middle.t };
      frame.pivots.push(frame.low);
    }
  }
  return { broken, high, low };
}

function updateZones(book, bar, now, minGap, lifetime) {
  book.zones = book.zones.filter(z => !z.invalid && now - z.formedAt <= lifetime);
  const inversions = [];
  for (const z of book.zones) {
    if (z.side > 0 ? bar.c < z.low : bar.c > z.high) {
      z.invalid = true;
      if (z.side * (bar.c - bar.o) < 0) inversions.push(z);
    } else if (bar.l <= z.high && bar.h >= z.low && (z.side > 0 ? bar.c > z.high : bar.c < z.low)) {
      z.retestedAt = now;
    }
  }
  const previous = book.recent[0];
  if (book.recent.length === 2) {
    if (bar.l - previous.h >= minGap) book.zones.push({ low: previous.h, high: bar.l, side: 1, formedAt: now });
    if (previous.l - bar.h >= minGap) book.zones.push({ low: bar.h, high: previous.l, side: -1, formedAt: now });
  }
  book.recent.push(bar);
  if (book.recent.length > 2) book.recent.shift();
  return inversions;
}

const zoneBook = () => ({ zones: [], recent: [] });

function aggregateClosed(buckets, size, bar, now) {
  const id = Math.floor(bar.t / size) * size;
  let bucket = buckets.get(size);
  if (!bucket || bucket.t !== id) {
    bucket = { t: id, o: bar.o, h: bar.h, l: bar.l, c: bar.c, n: 1 };
    buckets.set(size, bucket);
  } else {
    bucket.h = Math.max(bucket.h, bar.h);
    bucket.l = Math.min(bucket.l, bar.l);
    bucket.c = bar.c;
    bucket.n++;
  }
  return now === id + size && bucket.n * minute === size ? bucket : null;
}

export const variants = [
  'swing-control', 'fvg-retest', 'ifvg-double', 'm5-inversion-fvg', 'fvg-pullback-entry',
];

export function scanSession(bars, start) {
  let m1, m15, zones, m5Zones, m5Invert, sweeps, h4, buckets, previous, ranges;
  const contextByClose = new Map();
  const events = [];
  function reset() {
    m1 = swingFrame(); m15 = swingFrame();
    zones = zoneBook(); m5Zones = zoneBook();
    m5Invert = new Map(); sweeps = new Map();
    h4 = []; buckets = new Map(); ranges = []; previous = undefined;
  }
  reset();
  for (const b of bars) {
    if (previous && previous.t + minute !== b.t) reset();
    const now = b.t + minute;
    const atr = ranges.length === 20 ? ranges.reduce((a, n) => a + n, 0) / 20 : 0;
    const offset = b.t - start;

    for (const p of m15.pivots) {
      if (p.side * ((p.side > 0 ? b.h : b.l) - p.price) >= 0) p.taken = true;
    }
    for (const [side, p] of [[1, m1.low], [-1, m1.high]]) {
      if (p && side * ((side > 0 ? b.l : b.h) - p.price) < 0 && side * (b.c - p.price) > 0) sweeps.set(side, now);
    }
    const inversions = updateZones(zones, b, now, Math.max(0.20, 0.10 * atr), 45 * minute);
    const local = structure(m1, b, now);
    if (local.high && local.low && local.high.price <= local.low.price) {
      // Alternating pivots are not guaranteed; retain the direction but skip impossible brackets.
      local.broken = undefined;
    }
    for (const size of frames) {
      const higher = aggregateClosed(buckets, size, b, now);
      if (!higher) continue;
      if (size === frames[0]) {
        for (const z of updateZones(m5Zones, higher, now, 0.20, 180 * minute)) m5Invert.set(-z.side, now);
      } else if (size === frames[1]) {
        structure(m15, higher, now);
      } else {
        h4.push(higher);
        if (h4.length > 2) h4.shift();
      }
    }
    // Only the latest M1 endpoints are used; keep old M15 targets through this UTC day.
    m1.pivots = m1.pivots.slice(-2);
    const lastClose = previous?.c ?? b.o;
    ranges.push(Math.max(b.h - b.l, Math.abs(b.h - lastClose), Math.abs(b.l - lastClose)));
    if (ranges.length > 20) ranges.shift();
    previous = b;
    const h4Dir = h4.length < 2 ? 0 :
      (h4[1].h > h4[0].h && h4[1].l > h4[0].l ? 1 : h4[1].h < h4[0].h && h4[1].l < h4[0].l ? -1 : 0);
    contextByClose.set(now, { m1: m1.dir, m15: m15.dir });
    const swing = local.broken;
    const side = swing?.side;
    if (!atr || !side || side !== m15.dir || offset < 480 * minute || offset >= 960 * minute) continue;
    const opposite = side > 0 ? local.low : local.high;
    if (!opposite) continue;
    const candidateZones = zones.zones.filter(z => z.side === side && !z.invalid &&
      z.retestedAt !== undefined && now - z.retestedAt <= 8 * minute);
    const retest = candidateZones.at(-1);
    const inverted = inversions.filter(z => z.side === -side).at(-1);
    const target = m15.pivots.filter(p => p.side === side && !p.taken && side * (p.price - b.c) > 0)
      .sort((a, q) => side * (a.price - q.price))[0];
    const oppositeLevels = [opposite.price];
    for (const z of [retest, inverted]) if (z) oppositeLevels.push(side > 0 ? z.low : z.high);
    const stopBid = (side > 0 ? Math.min(...oppositeLevels) : Math.max(...oppositeLevels)) - side * 0.20 * atr;
    const targetBid = target ? target.price - side * 0.10 : null;
    const m5InvertAt = m5Invert.get(side);
    events.push({ side, setupAt: now, atr, stopBid, targetBid, breakout: swing.price,
      breakoutPivotAt: swing.t, breakoutKnownAt: swing.knownAt, stopSwingAt: opposite.t,
      targetPivotAt: target?.t, targetKnownAt: target?.knownAt, m15Dir: m15.dir, h4Dir,
      m5InvertAt, m5Confirmed: !!(retest && m5InvertAt && m5InvertAt <= retest.formedAt && now - m5InvertAt <= 45 * minute),
      sweep: now - (sweeps.get(side) ?? -Infinity) <= 12 * minute,
      retest: retest ? { ...retest } : undefined, inverted: inverted ? { ...inverted } : undefined,
    });
  }
  return { events, contextByClose };
}

export function scheduleEntries(session, scan, variant, spread, commissionPct) {
  const byTime = new Map(session.bars.map(b => [b.t, b]));
  const signals = new Map();
  const counts = { setup: 0, noStructureTarget: 0, noRetest: 0, noQuoteOrRoom: 0 };
  for (const setup of scan.events) {
    if (variant === 'ifvg-double' && !setup.inverted) continue;
    if (variant.startsWith('fvg-') && !setup.retest) continue;
    if (variant === 'm5-inversion-fvg' && !setup.m5Confirmed) continue;
    const { side, setupAt, targetBid, stopBid, breakout, atr } = setup;
    counts.setup++;
    const signalBar = byTime.get(setupAt - minute);
    if (!signalBar || targetBid === null || side * (targetBid - signalBar.c) <= 0 || side * (signalBar.c - stopBid) <= 0) {
      counts.noStructureTarget++;
      continue;
    }
    let at = setupAt;
    if (variant === 'fvg-pullback-entry') {
      at = 0;
      for (let wait = 0; wait < 5; wait++) {
        const b = byTime.get(setupAt + wait * minute);
        if (!b) break;
        const next = b.t + minute;
        const context = scan.contextByClose.get(next);
        const adverse = side > 0 ? b.l : b.h;
        const favorable = side > 0 ? b.h : b.l;
        if (context?.m15 !== side || context?.m1 !== side ||
            side * (adverse - stopBid) <= 0 || side * (favorable - targetBid) >= 0) break;
        if (side * (adverse - breakout) <= 0.10 * atr && side * (b.c - breakout) > 0) { at = next; break; }
      }
      if (!at) { counts.noRetest++; continue; }
    }
    // A signal is timestamped before the open is consumed. The open determines tradeability and R only.
    const bid = byTime.get(at)?.o;
    if (bid === undefined) { counts.noQuoteOrRoom++; continue; }
    const entry = bid + (side > 0 ? spread : 0);
    const shift = side < 0 ? spread : 0;
    const target = targetBid + shift, stop = stopBid + shift;
    const reward = side * (target - entry), risk = side * (entry - stop);
    if (side * (bid - stopBid) <= eps || risk < 1 || reward <= (entry + target) * commissionPct / 100) {
      counts.noQuoteOrRoom++;
      continue;
    }
    if (!signals.has(at)) signals.set(at, { side: side > 0 ? 'long' : 'short', rr: reward / risk,
      stopBid, context: setup, knownAt: at });
  }
  return { ...session, signals, counts };
}
