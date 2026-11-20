import type { Bar } from './types';

/** Series math shared by the indicators: NaN-padded arrays aligned to the bars (TradingView semantics). */
export type A = number[];
export const N = NaN;
export const ok = (x: number) => !Number.isNaN(x);
export const arr = (n: number, v = N): A => new Array(n).fill(v);

// ── primitives ────────────────────────────────────────────────────────────────
export function sma(src: A, len: number): A {
  const out = arr(src.length);
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (ok(v)) sum += v;
    else bad++;
    if (i >= len) {
      const o = src[i - len];
      if (ok(o)) sum -= o;
      else bad--;
    }
    if (i >= len - 1 && bad === 0) out[i] = sum / len;
  }
  return out;
}

export function smoothing(src: A, len: number, alpha: number): A {
  const out = arr(src.length);
  let prev = N;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (!ok(v)) {
      if (ok(prev)) out[i] = prev;
      continue;
    }
    if (!ok(prev)) {
      seedSum += v;
      seedCount++;
      if (seedCount === len) {
        prev = seedSum / len;
        out[i] = prev;
      }
      continue;
    }
    prev = alpha * v + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}
export const ema = (src: A, len: number) => smoothing(src, len, 2 / (len + 1));
export const rma = (src: A, len: number) => smoothing(src, len, 1 / len);

export function wma(src: A, len: number): A {
  const out = arr(src.length);
  const denom = (len * (len + 1)) / 2;
  for (let i = len - 1; i < src.length; i++) {
    let s = 0;
    let bad = false;
    for (let j = 0; j < len; j++) {
      const v = src[i - j];
      if (!ok(v)) {
        bad = true;
        break;
      }
      s += v * (len - j);
    }
    if (!bad) out[i] = s / denom;
  }
  return out;
}

export function windowFn(src: A, len: number, f: (w: A) => number): A {
  const out = arr(src.length);
  for (let i = len - 1; i < src.length; i++) {
    const w = src.slice(i - len + 1, i + 1);
    if (w.every(ok)) out[i] = f(w);
  }
  return out;
}
export const stdev = (src: A, len: number) =>
  windowFn(src, len, (w) => {
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length);
  });
export const highest = (src: A, len: number) => windowFn(src, len, (w) => Math.max(...w));
export const lowest = (src: A, len: number) => windowFn(src, len, (w) => Math.min(...w));
export const sum = (src: A, len: number) => windowFn(src, len, (w) => w.reduce((a, b) => a + b, 0));

export const shift = (src: A, n: number): A => src.map((_, i) => (i - n >= 0 ? src[i - n] : N));
export const change = (src: A, n = 1): A => src.map((v, i) => (i >= n ? v - src[i - n] : N));
export const zip = (a: A, b: A, f: (x: number, y: number) => number): A => a.map((x, i) => f(x, b[i]));
export const cum = (src: A): A => {
  let s = 0;
  return src.map((v) => (ok(v) ? (s += v) : s));
};

export const cols = (bars: Bar[]) => ({
  o: bars.map((b) => b.o),
  h: bars.map((b) => b.h),
  l: bars.map((b) => b.l),
  c: bars.map((b) => b.c),
  v: bars.map((b) => b.v),
  hl2: bars.map((b) => (b.h + b.l) / 2),
  hlc3: bars.map((b) => (b.h + b.l + b.c) / 3),
});

export function trueRange(h: A, l: A, c: A): A {
  return h.map((hi, i) => (i === 0 ? hi - l[i] : Math.max(hi - l[i], Math.abs(hi - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
}
export function atr(bars: Bar[], len: number) {
  const { h, l, c } = cols(bars);
  return rma(trueRange(h, l, c), len);
}
export function rsiOf(src: A, len: number): A {
  const ch = change(src);
  const up = rma(ch.map((x) => (ok(x) ? Math.max(x, 0) : N)), len);
  const dn = rma(ch.map((x) => (ok(x) ? Math.max(-x, 0) : N)), len);
  return zip(up, dn, (u, d) => (d === 0 ? 100 : u === 0 ? 0 : 100 - 100 / (1 + u / d)));
}
export const roc = (src: A, n: number): A => src.map((v, i) => (i >= n ? (100 * (v - src[i - n])) / src[i - n] : N));
export const swma = (x: A): A => x.map((_, i) => (i >= 3 ? (x[i] + 2 * x[i - 1] + 2 * x[i - 2] + x[i - 3]) / 6 : N));

// ── definitions ───────────────────────────────────────────────────────────────
