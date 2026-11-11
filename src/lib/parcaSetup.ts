import { TF, TF_LABEL, TF_MS } from './types';
import type { Bar } from './types';
import type { DayBar } from './market';
import { dayStart } from './market';
import { marketSession } from './calendar';
import { atr } from './indicators';

/**
 * Parça Setup: Daily Bias → engulf at an FVG / iFVG / Order Block → mini structure point → session liquidity.
 *
 * Everything is causal. A chart candle is used only once it has closed, and a higher-timeframe
 * candle, zone or daily candle only once its own close time has passed. The same replay instant
 * therefore gives the same marks on every run and the same bias on every timeframe.
 */
export type SetupMark = { t: number; side: 'long' | 'short'; kind: 'engulf' | 'signal' | 'sweep'; source: string };
export type SetupZone = { tf: TF; source: 'FVG' | 'iFVG' | 'OB'; side: 1 | -1; bottom: number; top: number; from: number };
export type SetupResult = { bias: -1 | 0 | 1; marks: SetupMark[]; zones: SetupZone[] };

export interface SetupParams {
  /** candles on each side of a swing point */
  pivot: number;
  /** candles allowed between the engulf and the structure break */
  window: number;
  /** zone lifetime, in candles of the zone's own timeframe */
  zoneAge: number;
  /** smallest fair value gap, as a share of ATR(14) on the zone's timeframe */
  minGap: number;
  /** 1: the daily candle decides, 1h + 4h only break a neutral day · 2: 1h + 4h + daily vote */
  biasMode: number;
  /** 1: a signal needs an earlier liquidity sweep on its side within the trading day */
  sweep: number;
}
export const SETUP_DEFAULTS: SetupParams = { pivot: 2, window: 8, zoneAge: 80, minGap: 0.3, biasMode: 1, sweep: 0 };

export interface SetupInput {
  tf: TF;
  /** chart candles; a candle still forming at `clock` is ignored */
  bars: Bar[];
  /** replay clock: close time of the latest revealed minute */
  clock: number;
  /** higher-timeframe candles for zones and bias (15m, 1h, 4h) */
  series: Partial<Record<TF, Bar[]>>;
  /** trading-day candles on the 17:00 New York cut */
  days: DayBar[];
  params?: Partial<SetupParams>;
}

const ZONE_TFS: TF[] = ['15m', '1h', '4h'];
const HOUR = 3_600_000;

const trend = (a?: Bar, b?: Bar): number => (!a || !b ? 0 : a.c > b.c && a.h > b.h ? 1 : a.c < b.c && a.l < b.l ? -1 : 0);
const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Daily bias from the three trend readings. */
function combine(d: number, t1: number, t4: number, mode: number): -1 | 0 | 1 {
  if (mode === 2) return sign(Math.trunc((d + t1 + t4) / 2));
  return d !== 0 ? sign(d) : t1 === t4 ? sign(t4) : 0;
}

const lastClosed = <T,>(list: T[], closeTime: (x: T) => number, now: number) => {
  let n = list.length;
  while (n > 0 && closeTime(list[n - 1]) > now) n--;
  return n;
};

/** Daily bias at one instant, from candles closed by then. Independent of the chart timeframe. */
export function biasAt(clock: number, days: DayBar[], h1: Bar[], h4: Bar[], mode = SETUP_DEFAULTS.biasMode) {
  const id = lastClosed(days, (d) => d.end, clock);
  const i1 = lastClosed(h1, (b) => b.t + HOUR, clock);
  const i4 = lastClosed(h4, (b) => b.t + 4 * HOUR, clock);
  return combine(trend(days[id - 1], days[id - 2]), trend(h1[i1 - 1], h1[i1 - 2]), trend(h4[i4 - 1], h4[i4 - 2]), mode);
}

interface Zone extends SetupZone {
  until: number;
  rank: number;
  /** already produced an engulf in its current role */
  used: boolean;
  dead: boolean;
  /** chart candle index of the inversion, so that candle is not also read as a reaction */
  flippedAt: number;
  /** chart candle index of the first return into the zone; -1 while untouched */
  touchedAt: number;
}

/** Fair value gaps and order blocks of one timeframe, each stamped with the time it became known. */
function detectZones(tf: TF, bars: Bar[], p: SetupParams, rank: number): Zone[] {
  const ms = TF_MS[tf];
  const range = atr(bars, 14);
  const out: Zone[] = [];
  const add = (source: 'FVG' | 'OB', side: 1 | -1, bottom: number, top: number, k: number) =>
    out.push({ tf, source, side, bottom, top, from: bars[k].t + ms, until: bars[k].t + ms + p.zoneAge * ms, rank, used: false, dead: false, flippedAt: -1, touchedAt: -1 });
  let hi = NaN, lo = NaN;
  const n = p.pivot;
  for (let k = 2; k < bars.length; k++) {
    const b = bars[k], prev = bars[k - 1], old = bars[k - 2];
    const min = Number.isFinite(range[k - 1]) ? range[k - 1] * p.minGap : 0;
    if (b.l - old.h > min) add('FVG', 1, old.h, b.l, k);
    else if (old.l - b.h > min) add('FVG', -1, b.h, old.l, k);

    if (k >= n * 2) {
      const c = k - n;
      let isHigh = true, isLow = true;
      for (let j = k - n * 2; j <= k; j++) {
        if (j === c) continue;
        if (bars[j].h >= bars[c].h) isHigh = false;
        if (bars[j].l <= bars[c].l) isLow = false;
      }
      if (isHigh) hi = bars[c].h;
      if (isLow) lo = bars[c].l;
    }
    // Order block: the last opposite candle before the move that closed through a swing point.
    if (b.c > hi && prev.c <= hi) {
      // only when the break is a real displacement: it must close beyond the block itself
      for (let j = k - 1; j >= Math.max(0, k - 5); j--) if (bars[j].c < bars[j].o) { if (b.c > bars[j].h) add('OB', 1, bars[j].l, bars[j].h, k); break; }
      hi = NaN;
    }
    if (b.c < lo && prev.c >= lo) {
      for (let j = k - 1; j >= Math.max(0, k - 5); j--) if (bars[j].c > bars[j].o) { if (b.c < bars[j].l) add('OB', -1, bars[j].l, bars[j].h, k); break; }
      lo = NaN;
    }
  }
  return out;
}

interface Level {
  label: string;
  price: number;
  high: boolean;
  done: boolean;
  pierced: number;
}

const sessionCache = new Map<number, ReturnType<typeof marketSession>['key']>();
function sessionOf(t: number) {
  const key = Math.floor(t / HOUR);
  let s = sessionCache.get(key);
  if (!s) {
    if (sessionCache.size > 20_000) sessionCache.clear();
    s = marketSession(key * HOUR).key;
    sessionCache.set(key, s);
  }
  return s;
}

/** Zones come from 15m and above: on a 1m or 5m chart the zone is the higher timeframe's, the entry the chart's. */
const zoneFrames = (tf: TF): TF[] => ZONE_TFS.filter((z) => TF_MS[z] >= TF_MS[tf]);

/**
 * Incremental engine for one chart. Each call processes only the candles that closed since the
 * previous one, so a long replay costs the same per step as a short one. Because every rule is
 * causal, feeding it candle by candle gives exactly the marks of one pass over the whole history.
 */
export function createSetupEngine(tf: TF, params?: Partial<SetupParams>) {
  const p: SetupParams = { ...SETUP_DEFAULTS, ...params };
  const ms = TF_MS[tf];
  const frames = zoneFrames(tf);
  const label = (z: Zone) => (z.tf === tf ? z.source : `${TF_LABEL[z.tf]} ${z.source}`);
  const visitSpan = (z: Zone) => Math.max(5, TF_MS[z.tf] / ms);

  const fresh = () => ({
    first: NaN,
    i: 1,
    marks: [] as SetupMark[],
    next: 0,
    zones: [] as Zone[],
    cd: 0, c1: 0, c4: 0, pd: 0,
    pivotHigh: NaN, pivotHighAt: -1, pivotLow: NaN, pivotLowAt: -1,
    long: null as { at: number; level: number; stop: number } | null,
    short: null as { at: number; level: number; stop: number } | null,
    day: -1,
    levels: [] as Level[],
    asia: null as [number, number] | null,
    london: null as [number, number] | null,
    sweptLow: false,
    sweptHigh: false,
  });
  let s = fresh();

  return function advance(input: Omit<SetupInput, 'tf' | 'params'>): SetupResult {
    const { clock, days } = input;
    const closed = (list: Bar[] | undefined, step: number) => {
      const a = list ?? [];
      let n = a.length;
      while (n > 0 && a[n - 1].t + step > clock) n--;
      return n === a.length ? a : a.slice(0, n);
    };
    const bars = closed(input.bars, ms);
    const h1 = closed(input.series['1h'], HOUR);
    const h4 = closed(input.series['4h'], 4 * HOUR);
    const bias = biasAt(clock, days, h1, h4, p.biasMode);
    if (bars.length < 3) return { bias, marks: [], zones: [] };
    // another history, or a clock that moved back: start over
    if (bars[0].t !== s.first || bars.length < s.i) {
      s = fresh();
      s.first = bars[0].t;
    }

    // zones in the order they became known; candles already processed keep the same prefix
    const pending: Zone[] = [];
    frames.forEach((z, rank) => pending.push(...detectZones(z, z === tf ? bars : closed(input.series[z], TF_MS[z]), p, rank)));
    pending.sort((a, b) => a.from - b.from || a.rank - b.rank || a.side - b.side || a.bottom - b.bottom);
    const range = atr(bars, 14);
    const biasOf = (now: number): -1 | 0 | 1 => {
      while (s.cd < days.length && days[s.cd].end <= now) s.cd++;
      while (s.c1 < h1.length && h1[s.c1].t + HOUR <= now) s.c1++;
      while (s.c4 < h4.length && h4[s.c4].t + 4 * HOUR <= now) s.c4++;
      return combine(trend(days[s.cd - 1], days[s.cd - 2]), trend(h1[s.c1 - 1], h1[s.c1 - 2]), trend(h4[s.c4 - 1], h4[s.c4 - 2]), p.biasMode);
    };

    for (; s.i < bars.length; s.i++) {
      const i = s.i;
      const b = bars[i], prev = bars[i - 1];
      const now = b.t + ms;
      const dir = biasOf(now);

      // ── session liquidity ──────────────────────────────────────────────────
      const d = dayStart(b.t);
      if (d !== s.day) {
        s.day = d;
        s.asia = s.london = null;
        s.sweptLow = s.sweptHigh = false;
        while (s.pd < days.length && days[s.pd].end <= b.t) s.pd++;
        const pd = days[s.pd - 1];
        s.levels = pd
          ? [{ label: 'ÖG', price: pd.h, high: true, done: false, pierced: -1 }, { label: 'ÖG', price: pd.l, high: false, done: false, pierced: -1 }]
          : [];
      }
      const session = sessionOf(b.t);
      const grow = (r: [number, number] | null): [number, number] => (r ? [Math.max(r[0], b.h), Math.min(r[1], b.l)] : [b.h, b.l]);
      const publish = (name: string, r: [number, number]) => {
        if (s.levels.some((l) => l.label === name)) return;
        s.levels.push({ label: name, price: r[0], high: true, done: false, pierced: -1 }, { label: name, price: r[1], high: false, done: false, pierced: -1 });
      };
      if (session !== 'asia' && s.asia) publish('ASYA', s.asia);
      if ((session === 'overlap' || session === 'ny') && s.london) publish('LON', s.london);
      for (const l of s.levels) {
        if (l.done) continue;
        const beyond = l.high ? b.h > l.price : b.l < l.price;
        const back = l.high ? b.c < l.price : b.c > l.price;
        if (!beyond && l.pierced < 0) continue;
        if (back) {
          // took the liquidity and closed back inside: a sweep, not a breakout
          l.done = true;
          if (l.high) s.sweptHigh = true; else s.sweptLow = true;
          s.marks.push({ t: b.t, side: l.high ? 'short' : 'long', kind: 'sweep', source: `${l.label}${l.high ? '↑' : '↓'}` });
        } else if (l.pierced < 0) l.pierced = i;
        else if (i - l.pierced >= 3) l.done = true;
      }
      if (session === 'asia') s.asia = grow(s.asia);
      else if (session === 'london') s.london = grow(s.london);

      // ── zones that existed before this candle opened ───────────────────────
      while (s.next < pending.length && pending[s.next].from <= b.t) s.zones.push(pending[s.next++]);
      if (s.zones.length > 120) s.zones = s.zones.filter((z) => !z.dead && z.until >= now);

      // ── swing points of the chart timeframe ────────────────────────────────
      const n = p.pivot;
      if (i >= n * 2) {
        const c = i - n;
        let isHigh = true, isLow = true;
        for (let j = i - n * 2; j <= i; j++) {
          if (j === c) continue;
          if (bars[j].h >= bars[c].h) isHigh = false;
          if (bars[j].l <= bars[c].l) isLow = false;
        }
        if (isHigh) { s.pivotHigh = bars[c].h; s.pivotHighAt = c; }
        if (isLow) { s.pivotLow = bars[c].l; s.pivotLowAt = c; }
      }

      // ── mini structure point: a close through the level armed by the engulf ─
      let fired = false;
      if (s.long) {
        if (i - s.long.at > p.window || b.c < s.long.stop) s.long = null;
        else if (b.c > s.long.level && dir === 1 && (!p.sweep || s.sweptLow)) {
          s.marks.push({ t: b.t, side: 'long', kind: 'signal', source: 'MSP' });
          s.long = null;
          fired = true;
        }
      }
      if (s.short) {
        if (i - s.short.at > p.window || b.c > s.short.stop) s.short = null;
        else if (b.c < s.short.level && dir === -1 && (!p.sweep || s.sweptHigh)) {
          s.marks.push({ t: b.t, side: 'short', kind: 'signal', source: 'MSP' });
          s.short = null;
          fired = true;
        }
      }

      // ── engulf at a zone ───────────────────────────────────────────────────
      // A zone is fresh until price first returns to it. The engulf has to come on that first
      // visit: a few chart candles, or one candle of the zone's own timeframe if that is longer.
      for (const z of s.zones) {
        if (z.touchedAt < 0 && !z.dead && (z.side === 1 ? b.l <= z.top : b.h >= z.bottom)) z.touchedAt = i;
      }
      const visiting = (z: Zone) => z.touchedAt >= 0 && i - z.touchedAt <= visitSpan(z);
      const tol = Number.isFinite(range[i]) ? range[i] * 0.1 : 0;
      const bull = b.c > b.o && prev.c < prev.o && b.c >= prev.o && b.o <= prev.c + tol;
      const bear = b.c < b.o && prev.c > prev.o && b.c <= prev.o && b.o >= prev.c - tol;
      const low = Math.min(b.l, prev.l), high = Math.max(b.h, prev.h);
      let hit: Zone | undefined;
      if (!fired && ((bull && dir === 1) || (bear && dir === -1))) {
        for (const z of s.zones) {
          if (z.dead || z.used || z.until < now) continue;
          let ok: boolean;
          if (bull) {
            // reaction: price dipped into a support zone and the engulf closed back above its floor
            const reaction = z.side === 1 && visiting(z) && low <= z.top && b.c > z.bottom;
            // inversion: the engulf itself closed up through a bearish gap
            const inversion = z.side === -1 && z.source === 'FVG' && b.o <= z.top && b.c > z.top;
            ok = reaction || inversion;
          } else {
            const reaction = z.side === -1 && visiting(z) && high >= z.bottom && b.c < z.top;
            const inversion = z.side === 1 && z.source === 'FVG' && b.o >= z.bottom && b.c < z.bottom;
            ok = reaction || inversion;
          }
          // the higher timeframe wins, then the newer zone
          if (ok && (!hit || z.rank > hit.rank || (z.rank === hit.rank && z.from > hit.from))) hit = z;
        }
      }

      // ── zone life cycle on this close ──────────────────────────────────────
      for (const z of s.zones) {
        if (z.dead) continue;
        const broken = z.side === 1 ? b.c < z.bottom : b.c > z.top;
        if (!broken) continue;
        if (z.source === 'FVG') {
          // a gap closed through becomes an inverse gap working the other way
          z.source = 'iFVG';
          z.side = z.side === 1 ? -1 : 1;
          z.used = false;
          z.flippedAt = i;
          z.touchedAt = -1;
        } else z.dead = true;
      }

      if (hit) {
        s.marks.push({ t: b.t, side: bull ? 'long' : 'short', kind: 'engulf', source: label(hit) });
        // a gap inverted by this very candle stays open for its retest
        if (hit.flippedAt !== i) hit.used = true;
        // the level to break: the last swing still ahead of price, else the engulf's own extreme
        if (bull) s.long = { at: i, stop: low, level: s.pivotHigh > b.c && i - s.pivotHighAt <= 40 ? s.pivotHigh : b.h };
        else s.short = { at: i, stop: high, level: s.pivotLow < b.c && i - s.pivotLowAt <= 40 ? s.pivotLow : b.l };
      }
    }

    const now = bars[bars.length - 1].t + ms;
    const last = bars.length - 1;
    const open = (z: Zone) => !z.dead && !z.used && z.until >= now && (z.touchedAt < 0 || last - z.touchedAt <= visitSpan(z));
    return {
      bias,
      marks: s.marks,
      zones: s.zones.concat(pending.slice(s.next)).filter(open).map((z) => ({ tf: z.tf, source: z.source, side: z.side, bottom: z.bottom, top: z.top, from: z.from })),
    };
  };
}

/** One pass over the whole history. Same result as feeding an engine candle by candle. */
export function analyzeParcaSetup(input: SetupInput): SetupResult {
  return createSetupEngine(input.tf, input.params)(input);
}
