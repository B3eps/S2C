import { TF, TF_LABEL, TF_MS, TFS } from './types';
import type { Bar } from './types';
import type { DayBar } from './market';
import { dayStart } from './market';
import { eventsBetween, marketSession } from './calendar';
import { atr, ema, IND_BY_ID, sma } from './indicators';
import { winProbability } from './parcaModel';
import { trained1mScore, TRAINED_1M_THRESHOLD } from './parcaModel1m';

/**
 * Parça Setup, after the rules in the Parca Trades video (youtu.be/Mdxv5SV2qHY):
 *
 *  1. Daily bias: bullish or bearish on 1h, 4h and daily. Nothing against the bias is taken.
 *  2. Engulf: a candle that closes through an opposing FVG / order block, turning the gap into
 *     an iFVG. Stacked gaps of one move count as a single zone; a long is not taken while such
 *     a zone still sits unbroken just overhead.
 *  3. Mini structure point: a candle closing beyond the last swing of the pullback. It confirms
 *     the trend; engulf and structure break on the same candle are a "double confirmation".
 *  4. Extras: session highs / lows taken first (chiefly for indices), a higher-timeframe zone
 *     as the place the move starts from, liquidity as the target, at least 1R.
 *
 * The video sets the bias by discretion; the automatic bias here is an approximation and can be
 * replaced by the trader's own (biasMode 4 / 5).
 *
 * Everything is causal. A chart candle is used only once it has closed, and a higher-timeframe
 * candle, zone or daily candle only once its own close time has passed. The same replay instant
 * therefore gives the same marks on every run and the same bias on every timeframe.
 */
export type SetupMark = {
  t: number;
  side: 'long' | 'short';
  /** engulf: a zone closed through · msp: structure broken · signal: both, in the bias direction · sweep: liquidity taken */
  kind: 'engulf' | 'msp' | 'signal' | 'sweep';
  source: string;
  /** signal only: entry at the close, stop beyond the structure, first target at `rr` times the risk */
  entry?: number;
  stop?: number;
  target?: number;
  /** signal only: a liquidity sweep or a higher-timeframe zone stands behind it */
  strong?: boolean;
  /** engulf signals only: modelled chance of reaching 1R before the stop (src/lib/parcaModel.ts) */
  prob?: number;
  /** engulf signals only: nearest opposing swing of the last 48 candles, in risk units (none: undefined) */
  liqR?: number;
};
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
  /** 1: daily first · 2: two agree, third cannot oppose · 3: all agree · 4/5: manual · 6: simple 2/3 majority */
  biasMode: number;
  /** 0: optional · 1: same-day sweep required · 2: same-day sweep or recent 1h/4h zone touch required */
  sweep: number;
  /** 1: London and New York only, away from NFP / CPI / FOMC · 2: every session, away from the news */
  session: number;
  /**
   * 1: a signal needs both confirmations, engulf and structure break (the video's double confirmation)
   * 2: an engulf in the bias direction is the signal (the video's everyday entry); a structure
   *    break, a sweep or a 1h / 4h zone behind it marks it strong
   */
  entry: number;
  /** first target, in multiples of the risk */
  rr: number;
  /**
   * 1: trend confirmation by moving averages: the chart's EMA 21 rising (falling) over the last
   *    5 candles and the last closed 15-minute candle above (below) its EMA 50
   */
  ema: number;
  /** smallest ADX(14) of the chart at the signal: trend strength; 0 turns it off */
  adx: number;
  /** smallest ATR(14) / its average over the last 288 candles: an active market; 0 turns it off */
  vol: number;
  /** smallest modelled chance of reaching 1R (0..1, engulf entry only); 0 turns it off */
  minP: number;
  /** engulf entry only: skip when the nearest level ahead is closer than this many R; 0 turns it off */
  room?: number;
  /** engulf entry only: 1 skips order-block and 4h/daily inverse-gap zones, which lost money in the account runs; 0 off */
  noOB?: number;
  /** Internal experimental model switch; the fitted model is valid only for the 1m Gold preset. */
  trained1m?: number;
}
export const SETUP_DEFAULTS: SetupParams = { pivot: 2, window: 10, zoneAge: 80, minGap: 0.25, biasMode: 2, sweep: 0, session: 1, entry: 1, rr: 1, ema: 0, adx: 0, vol: 0, minP: 0 };

export interface SetupInput {
  tf: TF;
  /** chart candles; a candle still forming at `clock` is ignored */
  bars: Bar[];
  /** replay clock: close time of the latest revealed minute */
  clock: number;
  /** candles of the higher timeframes, for zones and bias */
  series: Partial<Record<TF, Bar[]>>;
  /** trading-day candles on the 17:00 New York cut */
  days: DayBar[];
  params?: Partial<SetupParams>;
}

const HOUR = 3_600_000;
const MIN = 60_000;
/** FVGs of one move, this many candles apart at most, are one stacked zone */
const STACK = 8;

const trend = (a?: Bar, b?: Bar): number => (!a || !b ? 0 : a.c > b.c && a.h > b.h ? 1 : a.c < b.c && a.l < b.l ? -1 : 0);
const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Daily bias from the three trend readings. */
function combine(d: number, t1: number, t4: number, mode: number): -1 | 0 | 1 {
  if (mode === 4) return 1;
  if (mode === 5) return -1;
  if (mode === 3) return d !== 0 && d === t1 && d === t4 ? sign(d) : 0;
  const votes = [d, t1, t4];
  const up = votes.filter((v) => v === 1).length;
  const down = votes.filter((v) => v === -1).length;
  if (mode === 6) return up >= 2 ? 1 : down >= 2 ? -1 : 0;
  if (mode === 2) return up >= 2 && down === 0 ? 1 : down >= 2 && up === 0 ? -1 : 0;
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
  id: string;
  until: number;
  rank: number;
  dead: boolean;
  /** a stacked zone takes the place of the smaller one it grew from */
  replaces?: string;
}

/**
 * Fair value gaps and order blocks of one timeframe, each stamped with the time it became known.
 * Consecutive gaps of the same move are stacked: the new zone spans them all and replaces the
 * earlier one, so "the" gap to engulf is the whole stack.
 */
function detectZones(tf: TF, bars: Bar[], p: SetupParams, rank: number): Zone[] {
  const ms = TF_MS[tf];
  const range = atr(bars, 14);
  const out: Zone[] = [];
  const add = (source: 'FVG' | 'OB', side: 1 | -1, bottom: number, top: number, k: number, replaces?: string) => {
    const from = bars[k].t + ms;
    const z: Zone = { id: `${tf}|${source}|${side}|${from}`, tf, source, side, bottom, top, from, until: from + p.zoneAge * ms, rank, dead: false, replaces };
    out.push(z);
    return z;
  };
  let hi = NaN, lo = NaN;
  let stack: Record<1 | -1, { z: Zone; k: number } | null> = { 1: null, [-1]: null };
  const n = p.pivot;
  for (let k = 2; k < bars.length; k++) {
    const b = bars[k], prev = bars[k - 1], old = bars[k - 2];
    // a stack ends when its own timeframe closes through it
    const up = stack[1], down = stack[-1];
    if (up && b.c < up.z.bottom) stack = { ...stack, 1: null };
    if (down && b.c > down.z.top) stack = { ...stack, [-1]: null };
    const min = Number.isFinite(range[k - 1]) ? range[k - 1] * p.minGap : 0;
    const gap: [1 | -1, number, number] | null = b.l - old.h > min ? [1, old.h, b.l] : old.l - b.h > min ? [-1, b.h, old.l] : null;
    if (gap) {
      const [side, bottom, top] = gap;
      const s = stack[side];
      const z = s && k - s.k <= STACK
        ? add('FVG', side, Math.min(bottom, s.z.bottom), Math.max(top, s.z.top), k, s.z.id)
        : add('FVG', side, bottom, top, k);
      stack = { ...stack, [side]: { z, k } };
    }

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
    // Order block: the last opposite candle before a move that closed through a swing point
    // and beyond the block itself.
    if (b.c > hi && prev.c <= hi) {
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

/** Zones come from the chart's own timeframe and every higher one. */
const zoneFrames = (tf: TF): TF[] => TFS.filter((z) => TF_MS[z] >= TF_MS[tf]);

type Armed = { at: number; zone: Zone; extreme: number };

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

  const fresh = () => ({
    first: NaN,
    i: 1,
    marks: [] as SetupMark[],
    next: 0,
    zones: [] as Zone[],
    byId: new Map<string, Zone>(),
    cd: 0, c1: 0, c4: 0, pd: 0,
    pivotHigh: NaN, pivotHighAt: -1, pivotLow: NaN, pivotLowAt: -1,
    /** latest engulf and structure break per side, waiting for each other */
    engulf: { 1: null, [-1]: null } as Record<1 | -1, Armed | null>,
    msp: { 1: -1, [-1]: -1 } as Record<1 | -1, number>,
    /** last touch of a 1h / 4h zone working in that direction */
    poi: { 1: -Infinity, [-1]: -Infinity } as Record<1 | -1, number>,
    day: -1,
    levels: [] as Level[],
    asia: null as [number, number] | null,
    london: null as [number, number] | null,
    swept: { 1: false, [-1]: false } as Record<1 | -1, boolean>,
    news: [] as number[],
    newsUntil: -Infinity,
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
    if (clock > s.newsUntil) {
      s.newsUntil = clock + 7 * 24 * HOUR;
      s.news = eventsBetween(bars[0].t, s.newsUntil).map((e) => e.t);
    }
    const nearNews = (t: number) => s.news.some((e) => Math.abs(e - t) <= 15 * MIN);
    const allowed = (session: string, t: number) => !p.session || (!(p.session === 1 && session === 'asia') && !nearNews(t));

    // zones in the order they became known; candles already processed keep the same prefix
    const pending: Zone[] = [];
    frames.forEach((z, rank) => pending.push(...detectZones(z, z === tf ? bars : closed(input.series[z], TF_MS[z]), p, rank)));
    pending.sort((a, b) => a.from - b.from || a.rank - b.rank || a.side - b.side || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
    const range = atr(bars, 14);
    // moving-average confirmation, only from candles closed by then
    const e21 = p.ema || p.entry === 2 ? ema(bars.map((x) => x.c), 21) : [];
    const q = tf === '1m' || tf === '5m' ? closed(input.series['15m'], 15 * MIN) : bars;
    const qMs = tf === '1m' || tf === '5m' ? 15 * MIN : ms;
    const q50 = p.ema || p.entry === 2 ? ema(q.map((x) => x.c), 50) : [];
    let qi = 0;
    const scored = p.entry === 2;
    const adxv = p.adx || scored ? IND_BY_ID.adx.calc(bars, { len: 14, adx: 14 }).adx : [];
    const atrAvg = p.vol || scored ? sma(range, 288) : [];
    const rsiv = scored ? IND_BY_ID.rsi.calc(bars, { len: 14, ma: 14 }).v : [];
    const q15Up = (way: 1 | -1, now: number) => {
      while (qi < q.length && q[qi].t + qMs <= now) qi++;
      const k = qi - 1;
      return k >= 0 && Number.isFinite(q50[k]) && way * (q[k].c - q50[k]) > 0;
    };
    // trend strength and activity: both measured on candles closed by the signal
    const regimeOk = (i: number) => (!p.adx || adxv[i] >= p.adx) && (!p.vol || (Number.isFinite(atrAvg[i]) && range[i] >= p.vol * atrAvg[i]));
    const emaOk = (way: 1 | -1, i: number, now: number) => {
      if (!p.ema) return true;
      while (qi < q.length && q[qi].t + qMs <= now) qi++;
      const k = qi - 1;
      return i >= 5 && way * (e21[i] - e21[i - 5]) > 0 && k >= 0 && Number.isFinite(q50[k]) && way * (q[k].c - q50[k]) > 0;
    };
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
        s.swept = { 1: false, [-1]: false };
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
          s.swept[l.high ? -1 : 1] = true;
          s.marks.push({ t: b.t, side: l.high ? 'short' : 'long', kind: 'sweep', source: `${l.label}${l.high ? '↑' : '↓'}` });
        } else if (l.pierced < 0) l.pierced = i;
        else if (i - l.pierced >= 3) l.done = true;
      }
      if (session === 'asia') s.asia = grow(s.asia);
      else if (session === 'london') s.london = grow(s.london);

      // ── zones that existed before this candle opened ───────────────────────
      while (s.next < pending.length && pending[s.next].from <= b.t) {
        const z = pending[s.next++];
        const old = z.replaces ? s.byId.get(z.replaces) : undefined;
        // a stack replaces the gap it grew from, unless that gap has already been engulfed
        if (old && old.source === 'FVG') old.dead = true;
        s.zones.push(z);
        s.byId.set(z.id, z);
      }
      if (s.zones.length > 160) {
        s.zones = s.zones.filter((z) => !z.dead && z.until >= now);
        s.byId = new Map(s.zones.map((z) => [z.id, z]));
      }

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

      // ── zone life cycle on this close; an engulf is a close through a zone ─
      let engulfed: Record<1 | -1, Zone | null> = { 1: null, [-1]: null };
      for (const z of s.zones) {
        if (z.dead || z.until < now) continue;
        // a 1h / 4h zone touched and held is where a move in its direction starts
        if (TF_MS[z.tf] >= HOUR && (z.side === 1 ? b.l <= z.top && b.c > z.bottom : b.h >= z.bottom && b.c < z.top)) s.poi[z.side] = b.t;
        const up = z.side === -1 && b.c > z.top;
        const down = z.side === 1 && b.c < z.bottom;
        if (!up && !down) continue;
        const way: 1 | -1 = up ? 1 : -1;
        // the engulf proper: this candle's body carried price through, not a gap over the zone
        const body = up ? b.c > b.o && prev.c <= z.top : b.c < b.o && prev.c >= z.bottom;
        const best = engulfed[way];
        if (body && (!best || z.rank > best.rank || (z.rank === best.rank && z.top - z.bottom > best.top - best.bottom))) engulfed = { ...engulfed, [way]: z };
        if (z.source === 'FVG') {
          // a gap closed through becomes an inverse gap working the other way
          z.source = 'iFVG';
          z.side = way;
        } else z.dead = true;
      }

      // ── mini structure point: a close beyond the last swing of the pullback ─
      const broke: Record<1 | -1, boolean> = {
        1: i - s.pivotHighAt <= 40 && b.c > s.pivotHigh && prev.c <= s.pivotHigh,
        [-1]: i - s.pivotLowAt <= 40 && b.c < s.pivotLow && prev.c >= s.pivotLow,
      };

      for (const way of [1, -1] as const) {
        const side = way === 1 ? 'long' : 'short';
        const z = engulfed[way];
        const inBias = dir === way;
        if (broke[way]) s.msp[way] = i;
        if (p.entry === 2) {
          // Engulf entry: the close through an opposing zone, in the bias direction, is the trade.
          if (broke[way] && inBias && !z) s.marks.push({ t: b.t, side, kind: 'msp', source: 'MSP' });
          if (!z || !inBias) continue;
          const hasPoi = b.t - s.poi[way] <= 2 * HOUR;
          const double = s.msp[way] >= 0 && i - s.msp[way] <= p.window;
          if (p.sweep === 1 && !s.swept[way]) continue;
          if (p.sweep === 2 && !(s.swept[way] || hasPoi)) continue;
          if (!allowed(session, b.t)) continue;
          if (!emaOk(way, i, now) || !regimeOk(i)) continue;
          // stop beyond the swing the move came from, at least 0.8 ATR away
          const pad = Number.isFinite(range[i]) ? range[i] : 0;
          let ext = way === 1 ? Infinity : -Infinity;
          for (let k = Math.max(0, i - 10); k <= i; k++) ext = way === 1 ? Math.min(ext, bars[k].l) : Math.max(ext, bars[k].h);
          const stop = way === 1 ? Math.min(ext - pad * 0.1, b.c - pad * 0.8) : Math.max(ext + pad * 0.1, b.c + pad * 0.8);
          // modelled chance of reaching 1R, from the same closed candles
          const risk = Math.abs(b.c - stop);
          let opp = way === 1 ? Infinity : -Infinity;
          for (let k = Math.max(0, i - 48); k < i - 2; k++) { const v = way === 1 ? bars[k].h : bars[k].l; if (way * (v - b.c) > 0) opp = way === 1 ? Math.min(opp, v) : Math.max(opp, v); }
          const prob = pad > 0 && i >= 5 ? winProbability({
            adx: adxv[i], vol: range[i] / atrAvg[i], slope21: way * (e21[i] - e21[i - 5]) / pad, ext21: way * (b.c - e21[i]) / pad,
            rsi: way === 1 ? rsiv[i] : 100 - rsiv[i], engulfRatio: Math.abs(b.c - b.o) / Math.max(1e-9, Math.abs(prev.c - prev.o)),
            riskAtr: risk / pad, room: Number.isFinite(opp) ? Math.abs(opp - b.c) / risk : 9, m15: q15Up(way, now),
            htf: z.tf !== tf && TF_MS[z.tf] >= 15 * MIN,
          }) : NaN;
          if (p.minP && !(prob >= p.minP)) continue;
          if (p.room && Number.isFinite(opp) && Math.abs(opp - b.c) / risk < p.room) continue;
          if (p.noOB && (z.source === 'OB' || (z.source === 'iFVG' && TF_MS[z.tf] >= 4 * HOUR))) continue;
          const source = double ? `${label(z)} + MSP` : label(z);
          const strong = double || s.swept[way] || hasPoi;
          if (p.trained1m && (tf !== '1m' || trained1mScore(source, strong, side, b.t) < TRAINED_1M_THRESHOLD)) continue;
          s.marks.push({ t: b.t, side, kind: 'signal', source, entry: b.c, stop, target: b.c + (b.c - stop) * p.rr, strong, prob: !p.trained1m && Number.isFinite(prob) ? prob : undefined, liqR: Number.isFinite(opp) && risk > 0 ? Math.abs(opp - b.c) / risk : undefined });
          continue;
        }
        if (z) {
          s.engulf[way] = { at: i, zone: z, extreme: way === 1 ? Math.min(b.l, prev.l) : Math.max(b.h, prev.h) };
          if (inBias) s.marks.push({ t: b.t, side, kind: 'engulf', source: label(z) });
        }
        if (broke[way] && inBias && !z) s.marks.push({ t: b.t, side, kind: 'msp', source: 'MSP' });
        const e = s.engulf[way];
        if (e && i - e.at > p.window) s.engulf[way] = null;
        if (!inBias || !s.engulf[way] || i - s.msp[way] > p.window || s.msp[way] < 0) continue;
        if (!z && !broke[way]) continue;
        // both confirmations are in: engulf and structure break, within the window
        const armed = s.engulf[way]!;
        s.engulf[way] = null;
        s.msp[way] = -1;
        const hasPoi = b.t - s.poi[way] <= 2 * HOUR;
        const strong = s.swept[way] || hasPoi;
        if (p.sweep === 1 && !s.swept[way]) continue;
        if (p.sweep === 2 && !strong) continue;
        if (!allowed(session, b.t)) continue;
        if (!emaOk(way, i, now) || !regimeOk(i)) continue;
        const pad = Number.isFinite(range[i]) ? range[i] : 0;
        // stop beyond the engulfed zone and the candles that did it, never tighter than half an ATR
        const far = way === 1 ? Math.min(armed.zone.bottom, armed.extreme, b.l) : Math.max(armed.zone.top, armed.extreme, b.h);
        const stop = way === 1 ? Math.min(far - pad * 0.1, b.c - pad * 0.5) : Math.max(far + pad * 0.1, b.c + pad * 0.5);
        const target = b.c + (b.c - stop) * p.rr;
        const oneR = b.c + (b.c - stop);
        // no trade into an unbroken opposing zone standing between entry and 1R
        const blocked = s.zones.some((o) => !o.dead && o.until >= now && o.side === -way && (way === 1 ? o.bottom > b.c && o.bottom < oneR : o.top < b.c && o.top > oneR));
        if (blocked) continue;
        s.marks.push({ t: b.t, side, kind: 'signal', source: `${label(armed.zone)} + MSP`, entry: b.c, stop, target, strong });
      }
    }

    const now = bars[bars.length - 1].t + ms;
    return {
      bias,
      marks: s.marks,
      zones: s.zones.concat(pending.slice(s.next)).filter((z) => !z.dead && z.until >= now).map((z) => ({ tf: z.tf, source: z.source, side: z.side, bottom: z.bottom, top: z.top, from: z.from })),
    };
  };
}

/** One pass over the whole history. Same result as feeding an engine candle by candle. */
export function analyzeParcaSetup(input: SetupInput): SetupResult {
  return createSetupEngine(input.tf, input.params)(input);
}
