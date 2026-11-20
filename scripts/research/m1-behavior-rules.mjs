import { minute } from './data.mjs';

export const kinds = ['sweep', 'near-turn', 'outside-hold', 'ordinary', 'fib-deep', 'fib-shallow'];
const fibBands = [['fib-deep', 0.60, 0.70], ['fib-shallow', 0.35, 0.45]];
const eps = 1e-9;
const londonClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', hour: 'numeric' });
const frameWidths = [15 * minute, 240 * minute];

export function rangeFrom(bars, start) {
  const sample = bars.filter(b => b.t >= start && b.t < start + 360 * minute);
  if (sample.length < 345) return null;
  return { high: Math.max(...sample.map(b => b.h)), low: Math.min(...sample.map(b => b.l)), n: sample.length };
}

function directions(bucket, closed, b) {
  for (const size of frameWidths) {
    const time = Math.floor(b.t / size) * size;
    let candidate = bucket.get(size);
    if (candidate?.time !== time) {
      candidate = { time, high: b.h, low: b.l, count: 1 };
      bucket.set(size, candidate);
    } else {
      candidate.high = Math.max(candidate.high, b.h);
      candidate.low = Math.min(candidate.low, b.l);
      candidate.count++;
    }
    if (b.t + minute === time + size && candidate.count * minute === size) {
      closed.set(size, [...(closed.get(size) ?? []).slice(-1), candidate]);
    }
  }
  return frameWidths.map(size => {
    const pair = closed.get(size) ?? [];
    if (pair.length < 2) return null;
    const [a, z] = pair;
    if (z.time !== a.time + size) return null;
    const hi = Math.sign(z.high - a.high), lo = Math.sign(z.low - a.low);
    return hi === lo ? hi : 0;
  });
}

export function scanBehavior(bars, start, reference = 'session') {
  const range = rangeFrom(bars, start);
  if (!range && reference === 'session') return { range, events: [] };
  let levelRange = reference === 'session' ? range : null, lastHour;
  let hours = 0;
  const diagnostics = Object.fromEntries(['sweep', 'near-turn', 'ordinary'].map(kind => [kind, { raw: 0, priorPierce: 0, duplicate: 0 }]));
  let rolling = [], nearby = [], previous, pivot, impulse;
  const closed = new Map(), bucket = new Map();
  const taken = new Set(), emitted = new Set(), pending = new Map();
  const events = [];
  for (const [i, b] of bars.entries()) {
    const hour = Math.floor(b.t / (60 * minute)) * 60 * minute;
    if (reference === 'hourly' && lastHour !== hour) {
      lastHour = hour;
      const prior = bars.slice(Math.max(0, i - 60), i);
      levelRange = prior.length === 60 && prior.every((bar, j) => bar.t === hour + (j - 60) * minute) ?
        { high: Math.max(...prior.map(bar => bar.h)), low: Math.min(...prior.map(bar => bar.l)) } : null;
      taken.clear(); emitted.clear(); pending.clear();
      if (levelRange && hour >= start + 420 * minute && hour < start + 960 * minute) hours++;
    }
    if (previous && previous.t + minute !== b.t) {
      rolling = []; nearby = []; previous = pivot = impulse = undefined;
      closed.clear(); bucket.clear(); pending.clear();
      // A missing quote might have swept either endpoint.
      if (b.t >= start + 360 * minute && (reference === 'session' || b.t > hour)) { taken.add(1); taken.add(-1); }
    }
    const atr = rolling.length === 20 ? rolling.reduce((sum, value) => sum + value, 0) / 20 : null;
    const now = b.t + minute;
    const active = b.t >= start + 420 * minute && b.t < start + 960 * minute;
    const [m15, h4] = directions(bucket, closed, b);
    const emit = (kind, side, level, extra) => {
      events.push({ kind, side, level, atr, t: now, signalAt: b.t, offset: now - start,
        londonHour: Number(londonClock.format(now)), body: side * (b.c - b.o) / atr,
        closeDist: side * (b.c - level) / atr, m15, h4, ...extra });
    };

    // A fib event may use only an impulse confirmed before this minute.
    if (atr && impulse && active && now - impulse.knownAt <= 30 * minute) {
      const { side, from, tip, size, knownAt } = impulse;
      const extreme = side > 0 ? b.l : b.h;
      for (const [kind, shallow, deep] of fibBands) {
        if (impulse.used.has(kind)) continue;
        const edge = tip.price - side * size * shallow;
        const invalid = tip.price - side * size * deep;
        if (side * (extreme - invalid) < -0.05 * atr) {
          impulse.used.add(kind);
          continue;
        }
        if (side * (extreme - edge) <= 0 && side * (b.c - edge) > 0 && side * (b.c - b.o) >= 0.20 * atr) {
          impulse.used.add(kind);
          emit(kind, side, edge, { originAt: from.t, tipAt: tip.t, knownAt, impulseMinutes: (tip.t - from.t) / minute,
            impulseATR: impulse.size / impulse.atr, stopBid: extreme - side * 0.10 * atr, targetBid: tip.price });
        }
      }
    }

    for (const side of levelRange ? [1, -1] : []) {
      const edge = side > 0 ? levelRange.low : levelRange.high;
      const wick = side > 0 ? b.l : b.h;
      if (active && atr) {
        const wickDist = side * (wick - edge) / atr;
        const distance = side * (b.c - edge) / atr;
        const body = side * (b.c - b.o) / atr;
        let kind;
        if (distance >= 0.10 && distance <= 0.80 && body >= 0.20) {
          if (wickDist >= -0.25 && wickDist <= -0.05) kind = 'sweep';
          if (wickDist >= 0.05 && wickDist <= 0.25) kind = 'near-turn';
        }
        if (Math.abs(wickDist) <= 0.25 && distance > 0 && distance <= 0.80 && body < 0.20) {
          kind = 'ordinary';
        }
        if (kind) {
          diagnostics[kind].raw++;
          if (taken.has(side)) diagnostics[kind].priorPierce++;
          else if (emitted.has(`${kind}:${side}`)) diagnostics[kind].duplicate++;
          else {
            emitted.add(`${kind}:${side}`);
            emit(kind, side, edge, { wickDist, stopBid: Math.min(0, wickDist) * atr * side + edge - side * 0.10 * atr,
              targetBid: side > 0 ? levelRange.high : levelRange.low });
          }
        }
        const queue = pending.get(side);
        if (queue && (now - queue.at > 5 * minute || distance >= 0.25)) pending.delete(side);
        else if (queue && distance < 0 && side * ((side > 0 ? b.h : b.l) - edge) >= -0.15 * atr) {
          emitted.add(`outside-hold:${side}`);
          pending.delete(side);
          emit('outside-hold', -side, edge, { breakoutAt: queue.at, wickDist: (side * ((side > 0 ? b.h : b.l) - edge)) / atr,
            stopBid: (side > 0 ? b.h : b.l) + side * 0.10 * atr, targetBid: null });
        } else if (!queue && !emitted.has(`outside-hold:${side}`) && distance <= -0.10 &&
                   (!previous || side * (previous.c - edge) >= 0)) {
          pending.set(side, { at: now });
        }
      }
      if (b.t >= start + 360 * minute && side * (wick - edge) < 0) taken.add(side);
    }

    nearby.push(b);
    if (nearby.length > 5) nearby.shift();
    if (nearby.length === 5) {
      const center = nearby[2], neighbors = nearby.filter((_, i) => i !== 2);
      const high = neighbors.every(x => x.h < center.h);
      const low = neighbors.every(x => x.l > center.l);
      if (high !== low) {
        const next = { side: high ? 1 : -1, t: center.t, price: high ? center.h : center.l };
        if (!pivot || pivot.side !== next.side || next.side * (next.price - pivot.price) > 0) {
          if (pivot && next.side !== pivot.side) {
            const n = (next.t - pivot.t) / minute, size = next.side * (next.price - pivot.price);
            impulse = atr && n >= 5 && n <= 60 && size >= 4 * atr ?
              { side: next.side, from: pivot, tip: next, size, atr, knownAt: now, used: new Set() } : undefined;
          } else if (pivot && impulse && next.side === impulse.side) {
            // The earlier impulse remains a historical fact. Further signals need a new pair.
            impulse = undefined;
          }
          pivot = next;
        }
      }
    }
    const prev = previous?.c ?? b.o;
    rolling.push(Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev)));
    if (rolling.length > 20) rolling.shift();
    previous = b;
  }
  return { range, events, hours, diagnostics };
}

export const feeRate = 0.005 / 100;
export function netPerOunce(side, entry, exit) {
  return side * (exit - entry) - (entry + exit) * feeRate;
}

export function evaluatePath(event, byTime, spread) {
  const { side, atr, t } = event;
  const first = byTime.get(t);
  if (!first) return null;
  const entry = first.o + (side > 0 ? spread : 0);
  const mark = b => b + (side < 0 ? spread : 0);
  const ret = b => netPerOunce(side, entry, mark(b));
  const horizons = {};
  for (const n of [5, 15, 30]) {
    const span = Array.from({ length: n + 1 }, (_, i) => byTime.get(t + i * minute));
    if (span.some(b => !b)) { horizons[n] = null; continue; }
    const terminal = ret(span[n].o);
    let mfe = ret(first.o), mae = mfe, firstBarrier = null, favorableAfterAdverse = false;
    for (let i = 0; i <= n; i++) {
      const b = span[i];
      const open = ret(b.o);
      const up = i === n ? open : ret(side > 0 ? b.h : b.l);
      const down = i === n ? open : ret(side > 0 ? b.l : b.h);
      mfe = Math.max(mfe, up); mae = Math.min(mae, down);
      if ((firstBarrier === 'down' || (!firstBarrier && open <= -atr + eps)) && up >= atr - eps) {
        favorableAfterAdverse = true;
      }
      if (!firstBarrier) {
        if (open >= atr - eps) firstBarrier = 'up';
        else if (open <= -atr + eps) firstBarrier = 'down';
        else if (up >= atr - eps && down <= -atr + eps) firstBarrier = 'both';
        else if (up >= atr - eps) firstBarrier = 'up';
        else if (down <= -atr + eps) firstBarrier = 'down';
      }
    }
    horizons[n] = { net: terminal, grossBid: side * (span[n].o - first.o), mfe, mae,
      firstBarrier: firstBarrier ?? 'neither', favorableAfterAdverse };
  }
  return horizons;
}
