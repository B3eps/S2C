import type { Bar } from './types';

/** Merge candles into `width`-ms buckets (open of the first, close of the last, extremes, summed volume). */
export function aggregate(bars: Bar[], width: number): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const t = Math.floor(b.t / width) * width;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else out.push({ ...b, t });
  }
  return out;
}
