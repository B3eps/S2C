import { Bar } from './types';
import { DayBar, dayStart } from './market';
import { GOLD_A_SETUP_DEFAULTS, GOLD_SETUP_DEFAULTS, PARCA_CLASSIC_ID, PARCA_GOLD_A_ID, PARCA_GOLD_ID, PARCA_TRAINED_1M_ID } from './parcaVariants';
import type { SetupParams } from './parcaSetup';
import { N, ok, arr, sma, smoothing, ema, rma, wma, windowFn, stdev, highest, lowest, sum, shift, change, zip, cum, cols, trueRange, atr, rsiOf, roc, swma } from './indicatorMath';
import type { A } from './indicatorMath';
export { sma, ema, rma, wma, stdev, highest, lowest, sum, atr } from './indicatorMath';

export type Category = 'Özel stratejiler' | 'Hareketli ortalamalar' | 'Bantlar ve kanallar' | 'Trend' | 'Momentum' | 'Oynaklık' | 'Hacim';
export const CATEGORIES: Category[] = ['Özel stratejiler', 'Hareketli ortalamalar', 'Bantlar ve kanallar', 'Trend', 'Momentum', 'Oynaklık', 'Hacim'];

export interface Param {
  key: string;
  label: string;
  def: number;
  min?: number;
  max?: number;
  step?: number;
}
export interface Output {
  key: string;
  label: string;
  style: 'line' | 'hist' | 'dots';
  /** histogram coloured by sign of value */
  signed?: boolean;
  /** histogram coloured by candle direction */
  updown?: boolean;
  dashed?: boolean;
}
export interface IndDef {
  id: string;
  name: string;
  short: string;
  cat: Category;
  pane: 'overlay' | 'separate';
  params: Param[];
  outputs: Output[];
  levels?: number[];
  calc: (bars: Bar[], p: Record<string, number>, ctx?: IndContext) => Record<string, A>;
}
/** Data an indicator may need beyond the chart's own candles. */
export interface IndContext {
  /** trading-day candles (17:00 New York cut); the last one may still be open */
  days?: DayBar[];
}

const P = (key: string, label: string, def: number, step = 1, min = 1, max = 500): Param => ({ key, label, def, step, min, max });
const LEN = (def: number) => P('len', 'Uzunluk', def);
const L = (key: string, label: string, extra: Partial<Output> = {}): Output => ({ key, label, style: 'line', ...extra });
const H = (key: string, label: string, extra: Partial<Output> = {}): Output => ({ key, label, style: 'hist', ...extra });

const MA = (id: string, name: string, short: string, f: (c: A, len: number, bars: Bar[]) => A, def = 20): IndDef => ({
  id,
  name,
  short,
  cat: 'Hareketli ortalamalar',
  pane: 'overlay',
  params: [LEN(def)],
  outputs: [L('v', short)],
  calc: (bars, p) => ({ v: f(cols(bars).c, p.len, bars) }),
});

function bb(c: A, len: number, mult: number) {
  const basis = sma(c, len);
  const dev = stdev(c, len);
  return { basis, upper: zip(basis, dev, (b, d) => b + mult * d), lower: zip(basis, dev, (b, d) => b - mult * d) };
}

function dmi(bars: Bar[], len: number, adxLen: number) {
  const { h, l, c } = cols(bars);
  const up = change(h);
  const down = change(l).map((x) => -x);
  const plusDM = up.map((u, i) => (ok(u) && u > down[i] && u > 0 ? u : ok(u) ? 0 : N));
  const minusDM = down.map((d, i) => (ok(d) && d > up[i] && d > 0 ? d : ok(d) ? 0 : N));
  const tr = rma(trueRange(h, l, c), len);
  const plus = zip(rma(plusDM, len), tr, (a, t) => (100 * a) / t);
  const minus = zip(rma(minusDM, len), tr, (a, t) => (100 * a) / t);
  const dx = zip(plus, minus, (p, m) => (p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m)));
  return { plus, minus, adx: rma(dx, adxLen) };
}

function goldDef(id: string, name: string, short: string, d: SetupParams): IndDef {
  return {
    id, name, short, cat: 'Özel stratejiler', pane: 'overlay',
    params: [
      P('pivot', 'Mini yapı mum sayısı', d.pivot, 1, 1, 8),
      P('window', 'Engulf sonrası teyit mumu', d.window, 1, 1, 30),
      P('zoneAge', 'Bölge ömrü (mum)', d.zoneAge, 1, 10, 300),
      P('minGap', 'En küçük FVG (ATR katı)', d.minGap, 0.05, 0, 3),
      P('biasMode', 'Bias: 1 günlük · 2 karşıt oy yok · 3 üçü aynı · 4 elle YUKARI · 5 elle AŞAĞI · 6 çoğunluk', d.biasMode, 1, 1, 6),
      P('sweep', 'Likidite: 0 serbest · 1 sweep · 2 sweep veya üst zaman dilimi bölgesi', d.sweep, 1, 0, 2),
      P('session', 'Seans: 0 hepsi · 1 Londra / New York, haber dışı · 2 hepsi, haber dışı', d.session, 1, 0, 2),
      P('entry', 'Giriş: 1 engulf + MSP · 2 engulf yeter', d.entry, 1, 1, 2), P('rr', 'Hedef (R katı)', d.rr, 0.5, 0.5, 5),
      P('ema', 'EMA teyidi (EMA21 eğimi + 15dk EMA50): 0 / 1', d.ema, 1, 0, 1),
      P('adx', 'En düşük ADX (trend gücü, 0 kapalı)', d.adx, 0.5, 0, 60),
      P('vol', 'En düşük oynaklık (ATR / günlük ort., 0 kapalı)', d.vol, 0.05, 0, 3),
      P('minP', 'En düşük 1R olasılığı (0–0,9; 0 kapalı)', d.minP, 0.05, 0, 0.9),
      P('room', 'Önündeki seviyeye en az kaç R (0 kapalı)', d.room ?? 0, 0.5, 0, 6),
      P('noOB', 'OB ve 4sa+ iFVG girişlerini atla: 0 / 1', d.noOB ?? 0, 1, 0, 1),
    ],
    outputs: [], calc: () => ({}),
  };
}

export const INDICATORS: IndDef[] = [
  {
    id: PARCA_CLASSIC_ID, name: 'Parça Klasik · AL / SAT', short: 'KLASİK', cat: 'Özel stratejiler', pane: 'overlay',
    params: [
      P('pivot', 'Mini yapı mum sayısı', 2, 1, 1, 8), P('window', 'Engulf sonrası teyit mumu', 10, 1, 1, 30), P('zoneAge', 'Bölge ömrü (mum)', 80, 1, 10, 300),
      P('minGap', 'En küçük FVG (ATR katı)', 0.25, 0.05, 0, 3), P('biasMode', 'Bias: 1 günlük · 2 karşıt oy yok · 3 üçü aynı · 4 elle YUKARI · 5 elle AŞAĞI · 6 çoğunluk', 2, 1, 1, 6), P('sweep', 'Likidite: 0 serbest · 1 sweep · 2 sweep veya üst zaman dilimi bölgesi', 0, 1, 0, 2),
      P('session', 'Seans: 0 hepsi · 1 Londra / New York, haber dışı · 2 hepsi, haber dışı', 1, 1, 0, 2),
      P('entry', 'Giriş: 1 engulf + MSP · 2 engulf yeter', 1, 1, 1, 2), P('rr', 'Hedef (R katı)', 1, 0.5, 0.5, 5),
      P('ema', 'EMA teyidi (EMA21 eğimi + 15dk EMA50): 0 / 1', 0, 1, 0, 1),
      P('adx', 'En düşük ADX (trend gücü, 0 kapalı)', 0, 0.5, 0, 60), P('vol', 'En düşük oynaklık (ATR / günlük ort., 0 kapalı)', 0, 0.05, 0, 3),
    ],
    outputs: [], calc: () => ({}),
  },
  goldDef(PARCA_GOLD_ID, 'Parça Gold · AL / SAT', 'GOLD', GOLD_SETUP_DEFAULTS),
  goldDef(PARCA_GOLD_A_ID, 'Parça Gold A+ · olasılık %55+', 'GOLD A+', GOLD_A_SETUP_DEFAULTS),
  { id: PARCA_TRAINED_1M_ID, name: 'Parça 1dk Deneysel · eğitimli filtre', short: '1DK DENEYSEL', cat: 'Özel stratejiler', pane: 'overlay', params: [], outputs: [], calc: () => ({}) },
  // Moving averages
  MA('sma', 'Basit hareketli ortalama', 'SMA', (c, n) => sma(c, n)),
  MA('ema', 'Üssel hareketli ortalama', 'EMA', (c, n) => ema(c, n)),
  MA('wma', 'Ağırlıklı hareketli ortalama', 'WMA', (c, n) => wma(c, n)),
  MA('hma', 'Hull hareketli ortalama', 'HMA', (c, n) => wma(zip(wma(c, Math.max(1, Math.floor(n / 2))), wma(c, n), (a, b) => 2 * a - b), Math.max(1, Math.round(Math.sqrt(n)))), 9),
  MA('dema', 'Çift üssel hareketli ortalama', 'DEMA', (c, n) => {
    const e1 = ema(c, n);
    return zip(e1, ema(e1, n), (a, b) => 2 * a - b);
  }),
  MA('tema', 'Üçlü üssel hareketli ortalama', 'TEMA', (c, n) => {
    const e1 = ema(c, n);
    const e2 = ema(e1, n);
    const e3 = ema(e2, n);
    return e1.map((a, i) => 3 * a - 3 * e2[i] + e3[i]);
  }),
  MA('vwma', 'Hacim ağırlıklı hareketli ortalama', 'VWMA', (c, n, bars) => {
    const v = cols(bars).v;
    return zip(sma(zip(c, v, (a, b) => a * b), n), sma(v, n), (a, b) => (b === 0 ? N : a / b));
  }),
  MA('smma', 'Düzleştirilmiş hareketli ortalama', 'SMMA', (c, n) => rma(c, n), 7),
  {
    id: 'alma',
    name: 'Arnaud Legoux hareketli ortalama',
    short: 'ALMA',
    cat: 'Hareketli ortalamalar',
    pane: 'overlay',
    params: [LEN(9), P('offset', 'Ofset', 0.85, 0.05, 0, 1), P('sigma', 'Sigma', 6, 0.5, 0.5, 20)],
    outputs: [L('v', 'ALMA')],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const n = p.len;
      const m = p.offset * (n - 1);
      const s = n / p.sigma;
      const w = Array.from({ length: n }, (_, i) => Math.exp(-((i - m) ** 2) / (2 * s * s)));
      const ws = w.reduce((a, b) => a + b, 0);
      return { v: c.map((_, i) => (i < n - 1 ? N : w.reduce((acc, wi, j) => acc + wi * c[i - n + 1 + j], 0) / ws)) };
    },
  },
  MA('lsma', 'En küçük kareler hareketli ortalama', 'LSMA', (c, n) =>
    c.map((_, i) => {
      if (i < n - 1) return N;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let j = 0; j < n; j++) {
        const y = c[i - n + 1 + j];
        sx += j; sy += y; sxy += j * y; sxx += j * j;
      }
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      return (sy - slope * sx) / n + slope * (n - 1);
    }), 25),
  MA('mcginley', 'McGinley dinamik', 'McGinley', (c, n) => {
    const out = arr(c.length);
    const seed = ema(c, n);
    for (let i = 0; i < c.length; i++) {
      const prev = out[i - 1];
      out[i] = i === 0 || !ok(prev) ? seed[i] : prev + (c[i] - prev) / (n * Math.pow(c[i] / prev, 4));
    }
    return out;
  }, 14),
  {
    id: 'kama',
    name: 'Kaufman uyarlanabilir hareketli ortalama',
    short: 'KAMA',
    cat: 'Hareketli ortalamalar',
    pane: 'overlay',
    params: [LEN(10), P('fast', 'Hızlı', 2), P('slow', 'Yavaş', 30)],
    outputs: [L('v', 'KAMA')],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const vol = sum(change(c).map(Math.abs), p.len);
      const out = arr(c.length);
      const fa = 2 / (p.fast + 1);
      const sa = 2 / (p.slow + 1);
      for (let i = 0; i < c.length; i++) {
        if (i < p.len || !ok(vol[i])) continue;
        const er = vol[i] === 0 ? 0 : Math.abs(c[i] - c[i - p.len]) / vol[i];
        const sc = (er * (fa - sa) + sa) ** 2;
        const prev = ok(out[i - 1]) ? out[i - 1] : c[i - 1];
        out[i] = prev + sc * (c[i] - prev);
      }
      return { v: out };
    },
  },
  {
    id: 'emacross',
    name: 'EMA kesişimi',
    short: 'EMA X',
    cat: 'Hareketli ortalamalar',
    pane: 'overlay',
    params: [P('fast', 'Hızlı', 9), P('slow', 'Yavaş', 21)],
    outputs: [L('fast', 'Hızlı'), L('slow', 'Yavaş')],
    calc: (bars, p) => {
      const c = cols(bars).c;
      return { fast: ema(c, p.fast), slow: ema(c, p.slow) };
    },
  },
  // Bands & channels
  {
    id: 'bb',
    name: 'Bollinger bantları',
    short: 'BB',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [LEN(20), P('mult', 'Std. sapma', 2, 0.1, 0.1, 10)],
    outputs: [L('upper', 'Üst'), L('basis', 'Orta', { dashed: true }), L('lower', 'Alt')],
    calc: (bars, p) => bb(cols(bars).c, p.len, p.mult),
  },
  {
    id: 'kc',
    name: 'Keltner kanalları',
    short: 'KC',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [LEN(20), P('mult', 'Çarpan', 2, 0.1, 0.1, 10), P('atr', 'ATR uzunluğu', 10)],
    outputs: [L('upper', 'Üst'), L('basis', 'Orta', { dashed: true }), L('lower', 'Alt')],
    calc: (bars, p) => {
      const basis = ema(cols(bars).c, p.len);
      const r = atr(bars, p.atr);
      return { basis, upper: zip(basis, r, (b, a) => b + p.mult * a), lower: zip(basis, r, (b, a) => b - p.mult * a) };
    },
  },
  {
    id: 'dc',
    name: 'Donchian kanalları',
    short: 'DC',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [LEN(20)],
    outputs: [L('upper', 'Üst'), L('basis', 'Orta', { dashed: true }), L('lower', 'Alt')],
    calc: (bars, p) => {
      const { h, l } = cols(bars);
      const upper = highest(h, p.len);
      const lower = lowest(l, p.len);
      return { upper, lower, basis: zip(upper, lower, (a, b) => (a + b) / 2) };
    },
  },
  {
    id: 'env',
    name: 'Zarflar',
    short: 'ENV',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [LEN(20), P('pct', 'Yüzde', 1, 0.1, 0.1, 20)],
    outputs: [L('upper', 'Üst'), L('basis', 'Orta', { dashed: true }), L('lower', 'Alt')],
    calc: (bars, p) => {
      const basis = sma(cols(bars).c, p.len);
      return { basis, upper: basis.map((b) => b * (1 + p.pct / 100)), lower: basis.map((b) => b * (1 - p.pct / 100)) };
    },
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku bulutu',
    short: 'Ichimoku',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [P('conv', 'Dönüşüm', 9), P('base', 'Baz', 26), P('spanB', 'Öncü B', 52), P('disp', 'Kaydırma', 26)],
    outputs: [L('conv', 'Tenkan'), L('base', 'Kijun'), L('a', 'Öncü A'), L('b', 'Öncü B'), L('lag', 'Gecikmeli', { dashed: true })],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const mid = (n: number) => zip(highest(h, n), lowest(l, n), (a, b) => (a + b) / 2);
      const conv = mid(p.conv);
      const base = mid(p.base);
      const d = p.disp - 1;
      const a = shift(zip(conv, base, (x, y) => (x + y) / 2), d);
      const b = shift(mid(p.spanB), d);
      const lag = c.map((_, i) => (i + d < c.length ? c[i + d] : N));
      return { conv, base, a, b, lag };
    },
  },
  {
    id: 'alligator',
    name: 'Williams Alligator',
    short: 'Alligator',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [P('jaw', 'Çene', 13), P('teeth', 'Diş', 8), P('lips', 'Dudak', 5)],
    outputs: [L('jaw', 'Çene'), L('teeth', 'Diş'), L('lips', 'Dudak')],
    calc: (bars, p) => {
      const m = cols(bars).hl2;
      return { jaw: shift(rma(m, p.jaw), 8), teeth: shift(rma(m, p.teeth), 5), lips: shift(rma(m, p.lips), 3) };
    },
  },
  {
    id: 'pivots',
    name: 'Pivot noktaları (standart)',
    short: 'Pivot',
    cat: 'Bantlar ve kanallar',
    pane: 'overlay',
    params: [],
    outputs: [L('r2', 'R2', { dashed: true }), L('r1', 'R1', { dashed: true }), L('p', 'P'), L('s1', 'S1', { dashed: true }), L('s2', 'S2', { dashed: true })],
    calc: (bars, _p, ctx) => {
      const out = { p: arr(bars.length), r1: arr(bars.length), s1: arr(bars.length), r2: arr(bars.length), s2: arr(bars.length) };
      // The previous trading day (17:00 New York cut). The feed's daily candles are always whole
      // days; without them the first day on the chart may be partial, so it is never used.
      const days = ctx?.days;
      let id = 0;
      let day = -1;
      let dayNo = 0;
      let cur = { h: -Infinity, l: Infinity, c: N };
      let own: typeof cur | null = null;
      bars.forEach((b, i) => {
        let prev: { h: number; l: number; c: number } | null | undefined;
        if (days) {
          while (id < days.length && days[id].end <= b.t) id++;
          prev = days[id - 1];
        } else {
          const d = dayStart(b.t);
          if (d !== day) {
            own = dayNo >= 2 ? cur : null;
            dayNo++;
            day = d;
            cur = { h: -Infinity, l: Infinity, c: N };
          }
          cur.h = Math.max(cur.h, b.h);
          cur.l = Math.min(cur.l, b.l);
          cur.c = b.c;
          prev = own;
        }
        if (prev) {
          const pp = (prev.h + prev.l + prev.c) / 3;
          out.p[i] = pp;
          out.r1[i] = 2 * pp - prev.l;
          out.s1[i] = 2 * pp - prev.h;
          out.r2[i] = pp + (prev.h - prev.l);
          out.s2[i] = pp - (prev.h - prev.l);
        }
      });
      return out;
    },
  },
  // Trend
  {
    id: 'psar',
    name: 'Parabolik SAR',
    short: 'SAR',
    cat: 'Trend',
    pane: 'overlay',
    params: [P('start', 'Başlangıç', 0.02, 0.01, 0.001, 1), P('inc', 'Artış', 0.02, 0.01, 0.001, 1), P('max', 'Azami', 0.2, 0.01, 0.01, 1)],
    outputs: [{ key: 'v', label: 'SAR', style: 'dots' }],
    calc: (bars, p) => {
      const out = arr(bars.length);
      if (bars.length < 2) return { v: out };
      let up = bars[1].c >= bars[0].c;
      let sar = up ? bars[0].l : bars[0].h;
      let ep = up ? bars[1].h : bars[1].l;
      let af = p.start;
      for (let i = 1; i < bars.length; i++) {
        const b = bars[i];
        sar = sar + af * (ep - sar);
        if (up) {
          sar = Math.min(sar, bars[i - 1].l, i > 1 ? bars[i - 2].l : bars[i - 1].l);
          if (b.l < sar) {
            up = false; sar = ep; ep = b.l; af = p.start;
          } else if (b.h > ep) {
            ep = b.h; af = Math.min(af + p.inc, p.max);
          }
        } else {
          sar = Math.max(sar, bars[i - 1].h, i > 1 ? bars[i - 2].h : bars[i - 1].h);
          if (b.h > sar) {
            up = true; sar = ep; ep = b.h; af = p.start;
          } else if (b.l < ep) {
            ep = b.l; af = Math.min(af + p.inc, p.max);
          }
        }
        out[i] = sar;
      }
      return { v: out };
    },
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    short: 'ST',
    cat: 'Trend',
    pane: 'overlay',
    params: [P('atr', 'ATR uzunluğu', 10), P('mult', 'Çarpan', 3, 0.1, 0.1, 20)],
    outputs: [L('up', 'Yükseliş'), L('dn', 'Düşüş')],
    calc: (bars, p) => {
      const { hl2, c } = cols(bars);
      const a = atr(bars, p.atr);
      const upOut = arr(bars.length);
      const dnOut = arr(bars.length);
      let fu = N, fl = N, dir = 1;
      for (let i = 0; i < bars.length; i++) {
        if (!ok(a[i])) continue;
        const bu = hl2[i] + p.mult * a[i];
        const bl = hl2[i] - p.mult * a[i];
        fu = !ok(fu) || bu < fu || c[i - 1] > fu ? bu : fu;
        fl = !ok(fl) || bl > fl || c[i - 1] < fl ? bl : fl;
        if (dir === 1 && c[i] < fl) dir = -1;
        else if (dir === -1 && c[i] > fu) dir = 1;
        if (dir === 1) upOut[i] = fl;
        else dnOut[i] = fu;
      }
      return { up: upOut, dn: dnOut };
    },
  },
  {
    id: 'vwap',
    name: 'VWAP (günlük)',
    short: 'VWAP',
    cat: 'Trend',
    pane: 'overlay',
    params: [],
    outputs: [L('v', 'VWAP')],
    calc: (bars) => {
      // Anchored at the trading-day open (17:00 New York). A day whose open is not on the chart
      // would give the VWAP of only part of that day, so it stays empty instead.
      let day = -1, pv = 0, vv = 0, whole = false;
      return {
        v: bars.map((b, i) => {
          const d = dayStart(b.t);
          if (d !== day) { whole = i > 0 || b.t - d <= 2 * 3_600_000; day = d; pv = 0; vv = 0; }
          pv += ((b.h + b.l + b.c) / 3) * b.v;
          vv += b.v;
          return whole && vv ? pv / vv : N;
        }),
      };
    },
  },
  {
    id: 'adx',
    name: 'Yönsel hareket (ADX / DMI)',
    short: 'DMI',
    cat: 'Trend',
    pane: 'separate',
    params: [LEN(14), P('adx', 'ADX düzleştirme', 14)],
    outputs: [L('adx', 'ADX'), L('plus', '+DI'), L('minus', '−DI')],
    levels: [25],
    calc: (bars, p) => dmi(bars, p.len, p.adx),
  },
  {
    id: 'aroon',
    name: 'Aroon',
    short: 'Aroon',
    cat: 'Trend',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('up', 'Yukarı'), L('down', 'Aşağı')],
    levels: [30, 70],
    calc: (bars, p) => {
      const n = p.len;
      const up = arr(bars.length), down = arr(bars.length);
      for (let i = n; i < bars.length; i++) {
        let hi = i, lo = i;
        for (let j = i - n; j <= i; j++) {
          if (bars[j].h >= bars[hi].h) hi = j;
          if (bars[j].l <= bars[lo].l) lo = j;
        }
        up[i] = (100 * (n - (i - hi))) / n;
        down[i] = (100 * (n - (i - lo))) / n;
      }
      return { up, down };
    },
  },
  {
    id: 'vortex',
    name: 'Vortex',
    short: 'VI',
    cat: 'Trend',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('plus', 'VI+'), L('minus', 'VI−')],
    levels: [1],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const vmp = h.map((x, i) => (i ? Math.abs(x - l[i - 1]) : N));
      const vmm = l.map((x, i) => (i ? Math.abs(x - h[i - 1]) : N));
      const tr = sum(trueRange(h, l, c), p.len);
      return { plus: zip(sum(vmp, p.len), tr, (a, b) => a / b), minus: zip(sum(vmm, p.len), tr, (a, b) => a / b) };
    },
  },
  {
    id: 'chop',
    name: 'Choppiness endeksi',
    short: 'CHOP',
    cat: 'Trend',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', 'CHOP')],
    levels: [38.2, 61.8],
    calc: (bars, p) => {
      const { h, l } = cols(bars);
      const s = sum(atr(bars, 1), p.len);
      const range = zip(highest(h, p.len), lowest(l, p.len), (a, b) => a - b);
      return { v: zip(s, range, (a, r) => (100 * Math.log10(a / r)) / Math.log10(p.len)) };
    },
  },
  {
    id: 'mass',
    name: 'Kütle endeksi',
    short: 'MI',
    cat: 'Trend',
    pane: 'separate',
    params: [LEN(10)],
    outputs: [L('v', 'MI')],
    calc: (bars, p) => {
      const { h, l } = cols(bars);
      const span = zip(h, l, (a, b) => a - b);
      const e1 = ema(span, 9);
      return { v: sum(zip(e1, ema(e1, 9), (a, b) => a / b), p.len) };
    },
  },
  // Momentum
  {
    id: 'rsi',
    name: 'Göreceli güç endeksi',
    short: 'RSI',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(14), P('ma', 'MA uzunluğu', 14)],
    outputs: [L('v', 'RSI'), L('ma', 'MA', { dashed: true })],
    levels: [30, 50, 70],
    calc: (bars, p) => {
      const v = rsiOf(cols(bars).c, p.len);
      return { v, ma: sma(v, p.ma) };
    },
  },
  {
    id: 'macd',
    name: 'MACD',
    short: 'MACD',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('fast', 'Hızlı', 12), P('slow', 'Yavaş', 26), P('signal', 'Sinyal', 9)],
    outputs: [H('hist', 'Histogram', { signed: true }), L('macd', 'MACD'), L('signal', 'Sinyal')],
    levels: [0],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const macd = zip(ema(c, p.fast), ema(c, p.slow), (a, b) => a - b);
      const signal = ema(macd, p.signal);
      return { macd, signal, hist: zip(macd, signal, (a, b) => a - b) };
    },
  },
  {
    id: 'stoch',
    name: 'Stokastik',
    short: 'Stoch',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('k', '%K uzunluğu', 14), P('smooth', '%K düzleştirme', 1), P('d', '%D', 3)],
    outputs: [L('k', '%K'), L('d', '%D')],
    levels: [20, 80],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const hh = highest(h, p.k), ll = lowest(l, p.k);
      const raw = c.map((x, i) => (hh[i] === ll[i] ? 50 : (100 * (x - ll[i])) / (hh[i] - ll[i])));
      const k = sma(raw, p.smooth);
      return { k, d: sma(k, p.d) };
    },
  },
  {
    id: 'stochrsi',
    name: 'Stokastik RSI',
    short: 'Stoch RSI',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('k', '%K', 3), P('d', '%D', 3), P('rsi', 'RSI uzunluğu', 14), P('stoch', 'Stokastik uzunluğu', 14)],
    outputs: [L('k', '%K'), L('d', '%D')],
    levels: [20, 80],
    calc: (bars, p) => {
      const r = rsiOf(cols(bars).c, p.rsi);
      const hh = highest(r, p.stoch), ll = lowest(r, p.stoch);
      const raw = r.map((x, i) => (hh[i] === ll[i] ? 50 : (100 * (x - ll[i])) / (hh[i] - ll[i])));
      const k = sma(raw, p.k);
      return { k, d: sma(k, p.d) };
    },
  },
  {
    id: 'cci',
    name: 'Emtia kanal endeksi',
    short: 'CCI',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(20)],
    outputs: [L('v', 'CCI')],
    levels: [-100, 0, 100],
    calc: (bars, p) => {
      const tp = cols(bars).hlc3;
      const m = sma(tp, p.len);
      const md = windowFn(tp, p.len, (w) => {
        const mean = w.reduce((a, b) => a + b, 0) / w.length;
        return w.reduce((a, b) => a + Math.abs(b - mean), 0) / w.length;
      });
      return { v: tp.map((x, i) => (md[i] === 0 ? 0 : (x - m[i]) / (0.015 * md[i]))) };
    },
  },
  {
    id: 'willr',
    name: 'Williams %R',
    short: '%R',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', '%R')],
    levels: [-80, -20],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const hh = highest(h, p.len), ll = lowest(l, p.len);
      return { v: c.map((x, i) => (hh[i] === ll[i] ? -50 : (-100 * (hh[i] - x)) / (hh[i] - ll[i]))) };
    },
  },
  {
    id: 'mom',
    name: 'Momentum',
    short: 'MOM',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(10)],
    outputs: [L('v', 'MOM')],
    levels: [0],
    calc: (bars, p) => ({ v: change(cols(bars).c, p.len) }),
  },
  {
    id: 'roc',
    name: 'Değişim oranı',
    short: 'ROC',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(9)],
    outputs: [L('v', 'ROC')],
    levels: [0],
    calc: (bars, p) => ({ v: roc(cols(bars).c, p.len) }),
  },
  {
    id: 'ao',
    name: 'Müthiş osilatör',
    short: 'AO',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('fast', 'Hızlı', 5), P('slow', 'Yavaş', 34)],
    outputs: [H('v', 'AO', { signed: true })],
    levels: [0],
    calc: (bars, p) => {
      const m = cols(bars).hl2;
      return { v: zip(sma(m, p.fast), sma(m, p.slow), (a, b) => a - b) };
    },
  },
  {
    id: 'uo',
    name: 'Nihai osilatör',
    short: 'UO',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('a', 'Kısa', 7), P('b', 'Orta', 14), P('c', 'Uzun', 28)],
    outputs: [L('v', 'UO')],
    levels: [30, 70],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const bp = c.map((x, i) => x - Math.min(l[i], i ? c[i - 1] : l[i]));
      const tr = trueRange(h, l, c);
      const avg = (n: number) => zip(sum(bp, n), sum(tr, n), (a, b) => a / b);
      const a = avg(p.a), b = avg(p.b), d = avg(p.c);
      return { v: a.map((x, i) => (100 * (4 * x + 2 * b[i] + d[i])) / 7) };
    },
  },
  {
    id: 'trix',
    name: 'TRIX',
    short: 'TRIX',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(18)],
    outputs: [L('v', 'TRIX')],
    levels: [0],
    calc: (bars, p) => {
      const lg = cols(bars).c.map(Math.log);
      return { v: change(ema(ema(ema(lg, p.len), p.len), p.len)).map((x) => x * 10000) };
    },
  },
  {
    id: 'tsi',
    name: 'Gerçek güç endeksi',
    short: 'TSI',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('long', 'Uzun', 25), P('short', 'Kısa', 13), P('signal', 'Sinyal', 13)],
    outputs: [L('v', 'TSI'), L('signal', 'Sinyal')],
    levels: [0],
    calc: (bars, p) => {
      const pc = change(cols(bars).c);
      const ds = ema(ema(pc, p.long), p.short);
      const da = ema(ema(pc.map(Math.abs), p.long), p.short);
      const v = zip(ds, da, (a, b) => (100 * a) / b);
      return { v, signal: ema(v, p.signal) };
    },
  },
  {
    id: 'cmo',
    name: 'Chande momentum osilatörü',
    short: 'CMO',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(9)],
    outputs: [L('v', 'CMO')],
    levels: [-50, 0, 50],
    calc: (bars, p) => {
      const ch = change(cols(bars).c);
      const u = sum(ch.map((x) => (ok(x) ? Math.max(x, 0) : N)), p.len);
      const d = sum(ch.map((x) => (ok(x) ? Math.max(-x, 0) : N)), p.len);
      return { v: zip(u, d, (a, b) => (a + b === 0 ? 0 : (100 * (a - b)) / (a + b))) };
    },
  },
  {
    id: 'dpo',
    name: 'Trendden arındırılmış fiyat osilatörü',
    short: 'DPO',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(21)],
    outputs: [L('v', 'DPO')],
    levels: [0],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const back = Math.floor(p.len / 2) + 1;
      const m = shift(sma(c, p.len), back);
      return { v: zip(c, m, (a, b) => a - b) };
    },
  },
  {
    id: 'coppock',
    name: 'Coppock eğrisi',
    short: 'Coppock',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('wma', 'WMA', 10), P('long', 'Uzun ROC', 14), P('short', 'Kısa ROC', 11)],
    outputs: [L('v', 'Coppock')],
    levels: [0],
    calc: (bars, p) => {
      const c = cols(bars).c;
      return { v: wma(zip(roc(c, p.long), roc(c, p.short), (a, b) => a + b), p.wma) };
    },
  },
  {
    id: 'fisher',
    name: 'Fisher dönüşümü',
    short: 'Fisher',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(9)],
    outputs: [L('v', 'Fisher'), L('trigger', 'Tetik')],
    levels: [-1.5, 0, 1.5],
    calc: (bars, p) => {
      const m = cols(bars).hl2;
      const hh = highest(m, p.len), ll = lowest(m, p.len);
      const v = arr(m.length);
      let val = 0, fish = 0;
      for (let i = 0; i < m.length; i++) {
        if (!ok(hh[i])) continue;
        const r = hh[i] === ll[i] ? 0 : (m[i] - ll[i]) / (hh[i] - ll[i]) - 0.5;
        val = Math.max(-0.999, Math.min(0.999, 0.66 * r + 0.67 * val));
        fish = 0.5 * Math.log((1 + val) / (1 - val)) + 0.5 * fish;
        v[i] = fish;
      }
      return { v, trigger: shift(v, 1) };
    },
  },
  {
    id: 'kst',
    name: 'Know Sure Thing',
    short: 'KST',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('signal', 'Sinyal', 9)],
    outputs: [L('v', 'KST'), L('signal', 'Sinyal')],
    levels: [0],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const r = (n: number, s: number) => sma(roc(c, n), s);
      const a = r(10, 10), b = r(15, 10), d = r(20, 10), e = r(30, 15);
      const v = a.map((x, i) => x + 2 * b[i] + 3 * d[i] + 4 * e[i]);
      return { v, signal: sma(v, p.signal) };
    },
  },
  {
    id: 'ppo',
    name: 'Yüzde fiyat osilatörü',
    short: 'PPO',
    cat: 'Momentum',
    pane: 'separate',
    params: [P('fast', 'Hızlı', 12), P('slow', 'Yavaş', 26), P('signal', 'Sinyal', 9)],
    outputs: [H('hist', 'Histogram', { signed: true }), L('v', 'PPO'), L('signal', 'Sinyal')],
    levels: [0],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const v = zip(ema(c, p.fast), ema(c, p.slow), (a, b) => (100 * (a - b)) / b);
      const signal = ema(v, p.signal);
      return { v, signal, hist: zip(v, signal, (a, b) => a - b) };
    },
  },
  {
    id: 'bbpower',
    name: 'Boğa ayı gücü',
    short: 'BBP',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(13)],
    outputs: [H('v', 'BBP', { signed: true })],
    levels: [0],
    calc: (bars, p) => {
      const { h, l, c } = cols(bars);
      const e = ema(c, p.len);
      return { v: e.map((x, i) => h[i] - x + (l[i] - x)) };
    },
  },
  {
    id: 'rvi',
    name: 'Göreceli canlılık endeksi',
    short: 'RVGI',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(10)],
    outputs: [L('v', 'RVGI'), L('signal', 'Sinyal')],
    levels: [0],
    calc: (bars, p) => {
      const { o, h, l, c } = cols(bars);
      const num = sum(swma(zip(c, o, (a, b) => a - b)), p.len);
      const den = sum(swma(zip(h, l, (a, b) => a - b)), p.len);
      const v = zip(num, den, (a, b) => (b === 0 ? 0 : a / b));
      return { v, signal: swma(v) };
    },
  },
  {
    id: 'bop',
    name: 'Güç dengesi',
    short: 'BOP',
    cat: 'Momentum',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', 'BOP')],
    levels: [0],
    calc: (bars, p) => ({ v: sma(bars.map((b) => (b.h === b.l ? 0 : (b.c - b.o) / (b.h - b.l))), p.len) }),
  },
  // Volatility
  {
    id: 'atr',
    name: 'Ortalama gerçek aralık',
    short: 'ATR',
    cat: 'Oynaklık',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', 'ATR')],
    calc: (bars, p) => ({ v: atr(bars, p.len) }),
  },
  {
    id: 'stdev',
    name: 'Standart sapma',
    short: 'StdDev',
    cat: 'Oynaklık',
    pane: 'separate',
    params: [LEN(20)],
    outputs: [L('v', 'StdDev')],
    calc: (bars, p) => ({ v: stdev(cols(bars).c, p.len) }),
  },
  {
    id: 'hv',
    name: 'Tarihsel oynaklık',
    short: 'HV',
    cat: 'Oynaklık',
    pane: 'separate',
    params: [LEN(10)],
    outputs: [L('v', 'HV')],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const lr = c.map((x, i) => (i ? Math.log(x / c[i - 1]) : N));
      return { v: stdev(lr, p.len).map((x) => 100 * x * Math.sqrt(365)) };
    },
  },
  {
    id: 'bbpct',
    name: 'Bollinger %B',
    short: '%B',
    cat: 'Oynaklık',
    pane: 'separate',
    params: [LEN(20), P('mult', 'Std. sapma', 2, 0.1, 0.1, 10)],
    outputs: [L('v', '%B')],
    levels: [0, 1],
    calc: (bars, p) => {
      const c = cols(bars).c;
      const b = bb(c, p.len, p.mult);
      return { v: c.map((x, i) => (b.upper[i] === b.lower[i] ? 0.5 : (x - b.lower[i]) / (b.upper[i] - b.lower[i]))) };
    },
  },
  {
    id: 'bbw',
    name: 'Bollinger bant genişliği',
    short: 'BBW',
    cat: 'Oynaklık',
    pane: 'separate',
    params: [LEN(20), P('mult', 'Std. sapma', 2, 0.1, 0.1, 10)],
    outputs: [L('v', 'BBW')],
    calc: (bars, p) => {
      const b = bb(cols(bars).c, p.len, p.mult);
      return { v: b.basis.map((m, i) => ((b.upper[i] - b.lower[i]) / m) * 100) };
    },
  },
  // Volume
  {
    id: 'vol',
    name: 'Hacim',
    short: 'Hacim',
    cat: 'Hacim',
    pane: 'separate',
    params: [P('ma', 'MA uzunluğu', 20)],
    outputs: [H('v', 'Hacim', { updown: true }), L('ma', 'MA')],
    calc: (bars, p) => {
      const v = cols(bars).v;
      return { v, ma: sma(v, p.ma) };
    },
  },
  {
    id: 'obv',
    name: 'Denge hacmi',
    short: 'OBV',
    cat: 'Hacim',
    pane: 'separate',
    params: [],
    outputs: [L('v', 'OBV')],
    calc: (bars) => {
      const { c, v } = cols(bars);
      return { v: cum(c.map((x, i) => (i === 0 ? 0 : x > c[i - 1] ? v[i] : x < c[i - 1] ? -v[i] : 0))) };
    },
  },
  {
    id: 'mfi',
    name: 'Para akışı endeksi',
    short: 'MFI',
    cat: 'Hacim',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', 'MFI')],
    levels: [20, 80],
    calc: (bars, p) => {
      const { hlc3, v } = cols(bars);
      const mf = hlc3.map((x, i) => x * v[i]);
      const pos = sum(hlc3.map((x, i) => (i && x > hlc3[i - 1] ? mf[i] : 0)), p.len);
      const neg = sum(hlc3.map((x, i) => (i && x < hlc3[i - 1] ? mf[i] : 0)), p.len);
      return { v: zip(pos, neg, (a, b) => (b === 0 ? 100 : 100 - 100 / (1 + a / b))) };
    },
  },
  {
    id: 'cmf',
    name: 'Chaikin para akışı',
    short: 'CMF',
    cat: 'Hacim',
    pane: 'separate',
    params: [LEN(20)],
    outputs: [L('v', 'CMF')],
    levels: [0],
    calc: (bars, p) => {
      const mfv = bars.map((b) => (b.h === b.l ? 0 : (((b.c - b.l) - (b.h - b.c)) / (b.h - b.l)) * b.v));
      return { v: zip(sum(mfv, p.len), sum(cols(bars).v, p.len), (a, b) => (b === 0 ? 0 : a / b)) };
    },
  },
  {
    id: 'ad',
    name: 'Birikim / dağıtım',
    short: 'A/D',
    cat: 'Hacim',
    pane: 'separate',
    params: [],
    outputs: [L('v', 'A/D')],
    calc: (bars) => ({ v: cum(bars.map((b) => (b.h === b.l ? 0 : (((b.c - b.l) - (b.h - b.c)) / (b.h - b.l)) * b.v))) }),
  },
  {
    id: 'chaikinosc',
    name: 'Chaikin osilatörü',
    short: 'ChO',
    cat: 'Hacim',
    pane: 'separate',
    params: [P('fast', 'Hızlı', 3), P('slow', 'Yavaş', 10)],
    outputs: [L('v', 'ChO')],
    levels: [0],
    calc: (bars, p) => {
      const ad = cum(bars.map((b) => (b.h === b.l ? 0 : (((b.c - b.l) - (b.h - b.c)) / (b.h - b.l)) * b.v)));
      return { v: zip(ema(ad, p.fast), ema(ad, p.slow), (a, b) => a - b) };
    },
  },
  {
    id: 'pvt',
    name: 'Fiyat hacim trendi',
    short: 'PVT',
    cat: 'Hacim',
    pane: 'separate',
    params: [],
    outputs: [L('v', 'PVT')],
    calc: (bars) => {
      const { c, v } = cols(bars);
      return { v: cum(c.map((x, i) => (i ? ((x - c[i - 1]) / c[i - 1]) * v[i] : 0))) };
    },
  },
  {
    id: 'eom',
    name: 'Hareket kolaylığı',
    short: 'EOM',
    cat: 'Hacim',
    pane: 'separate',
    params: [LEN(14)],
    outputs: [L('v', 'EOM')],
    levels: [0],
    calc: (bars, p) => {
      const { hl2, h, l, v } = cols(bars);
      const ch = change(hl2);
      return { v: sma(ch.map((x, i) => (v[i] === 0 ? 0 : (10000 * x * (h[i] - l[i])) / v[i])), p.len) };
    },
  },
  {
    id: 'efi',
    name: 'Elder kuvvet endeksi',
    short: 'EFI',
    cat: 'Hacim',
    pane: 'separate',
    params: [LEN(13)],
    outputs: [L('v', 'EFI')],
    levels: [0],
    calc: (bars, p) => {
      const { c, v } = cols(bars);
      return { v: ema(change(c).map((x, i) => x * v[i]), p.len) };
    },
  },
  {
    id: 'volosc',
    name: 'Hacim osilatörü',
    short: 'VO',
    cat: 'Hacim',
    pane: 'separate',
    params: [P('fast', 'Kısa', 5), P('slow', 'Uzun', 10)],
    outputs: [L('v', 'VO')],
    levels: [0],
    calc: (bars, p) => {
      const v = cols(bars).v;
      return { v: zip(ema(v, p.fast), ema(v, p.slow), (a, b) => (b === 0 ? 0 : (100 * (a - b)) / b)) };
    },
  },
];

export const IND_BY_ID: Record<string, IndDef> = Object.fromEntries(INDICATORS.map((d) => [d.id, d]));

export interface ActiveInd {
  uid: string;
  id: string;
  params: Record<string, number>;
  colors: string[];
  hidden?: boolean;
}

export const defaultParams = (d: IndDef) => Object.fromEntries(d.params.map((p) => [p.key, p.def]));
