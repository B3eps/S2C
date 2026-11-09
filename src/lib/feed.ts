import { Bar, TF, TFS, TF_MS } from './types';

const MIN = 60_000;
const DAY = 86_400_000;

/** Gold does not trade on weekends: hide Fri 21:00 UTC → Sun 22:00 UTC. */
export function isClosed(t: number) {
  const d = new Date(t);
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  return (day === 5 && h >= 21) || day === 6 || (day === 0 && h < 22);
}

/** Real XAU/USD candles (Dukascopy) served by the local endpoint in vite.config.ts. */
async function fetchCandles(tf: TF, from: number, to: number): Promise<Bar[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/api/candles?tf=${tf}&from=${Math.floor(from)}&to=${Math.floor(to)}`);
      if (!res.ok) throw new Error(`XAU ${res.status}`);
      const raw = (await res.json()) as number[][];
      return raw.map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v })).filter((b) => !isClosed(b.t));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const fetchRange = fetchCandles;

/** Last `count` closed bars that opened before `end`. */
async function fetchBefore(tf: TF, end: number, count: number): Promise<Bar[]> {
  // ~5 trading days in 7, plus holidays: ask for twice the span
  const span = Math.max(TF_MS[tf] * count * 2, 3 * DAY);
  const bars = await fetchCandles(tf, end - span, end);
  return bars.slice(-count);
}

/** Random minute inside the last three years (ending two weeks ago), inside trading hours. */
export function randomStart(): number {
  const hi = Date.now() - 14 * DAY;
  const lo = Date.now() - 3 * 365 * DAY;
  for (;;) {
    const t = Math.floor((lo + Math.random() * (hi - lo)) / MIN) * MIN;
    if (!isClosed(t) && !isClosed(t - 6 * 3_600_000)) return t;
  }
}

const HIST = 420;

/**
 * Replay feed. History for each timeframe is fetched natively and ends strictly before
 * base0; everything after base0 is rebuilt from 1-minute bars so no candle can leak the future.
 */
export class Feed {
  minutes: Bar[] = [];
  ci = -1;
  hist = {} as Record<TF, Bar[]>;
  agg = {} as Record<TF, Bar[]>;
  base0: number;
  exhausted = false;
  private loading: Promise<void> | null = null;

  private constructor(public startMs: number) {
    this.base0 = Math.floor(startMs / TF_MS['4h']) * TF_MS['4h'];
    for (const tf of TFS) this.agg[tf] = [];
  }

  static async create(startMs: number, clockMs = startMs, onProgress?: (p: number) => void): Promise<Feed> {
    const f = new Feed(startMs);
    let done = 0;
    const tick = () => onProgress?.(++done / (TFS.length + 1));
    await Promise.all(
      TFS.map(async (tf) => {
        f.hist[tf] = await fetchBefore(tf, f.base0, HIST);
        tick();
      }),
    );
    await f.loadMore(Math.max(clockMs, startMs) + 2 * DAY);
    tick();
    f.advanceTo(clockMs);
    return f;
  }

  private cursor = 0;

  private async loadMore(until: number) {
    if (!this.cursor) this.cursor = this.base0;
    const now = Date.now() - 2 * MIN;
    while (this.cursor < until && this.cursor < now) {
      const to = Math.min(this.cursor + 2 * DAY, now);
      const chunk = await fetchCandles('1m', this.cursor, to);
      const last = this.minutes[this.minutes.length - 1];
      this.minutes.push(...(last ? chunk.filter((b) => b.t > last.t) : chunk));
      this.cursor = to;
    }
    if (this.cursor >= now) this.exhausted = true;
  }

  /** Prefetch more minutes in the background when the cursor nears the end. */
  ensureAhead() {
    if (this.loading || this.exhausted) return this.loading;
    if (this.minutes.length - this.ci > 3000) return null;
    this.loading = this.loadMore(this.cursor + 4 * DAY)
      .catch(() => undefined)
      .finally(() => (this.loading = null));
    return this.loading;
  }

  get isLoading() {
    return !!this.loading;
  }

  private push(m: Bar) {
    for (const tf of TFS) {
      const ms = TF_MS[tf];
      const bucket = Math.floor(m.t / ms) * ms;
      const arr = this.agg[tf];
      const last = arr[arr.length - 1];
      if (last && last.t === bucket) {
        last.h = Math.max(last.h, m.h);
        last.l = Math.min(last.l, m.l);
        last.c = m.c;
        last.v += m.v;
      } else {
        arr.push({ ...m, t: bucket });
      }
    }
  }

  private advanceTo(clockMs: number) {
    while (this.ci + 1 < this.minutes.length && this.minutes[this.ci + 1].t + MIN <= clockMs) {
      this.ci++;
      this.push(this.minutes[this.ci]);
    }
    if (this.ci < 0 && this.minutes.length) {
      this.ci = 0;
      this.push(this.minutes[0]);
    }
  }

  /** Reveal the next 1-minute bar. Returns null when data is not loaded yet. */
  step(): Bar | null {
    this.ensureAhead();
    if (this.ci + 1 >= this.minutes.length) return null;
    this.ci++;
    const m = this.minutes[this.ci];
    this.push(m);
    return m;
  }

  get current(): Bar {
    return this.minutes[this.ci];
  }
  get price() {
    return this.current.c;
  }
  /** Close time of the latest revealed minute. */
  get clock() {
    return this.current.t + MIN;
  }

  bars(tf: TF): Bar[] {
    return this.hist[tf].concat(this.agg[tf]);
  }
  aggLen(tf: TF) {
    return this.agg[tf].length;
  }
  lastBar(tf: TF): Bar {
    const a = this.agg[tf];
    return a.length ? a[a.length - 1] : this.hist[tf][this.hist[tf].length - 1];
  }
}

/** Fetch 1m bars around a closed trade for the trade replay view. */
export async function fetchWindow(from: number, to: number, tf: TF) {
  return fetchRange(tf, from, to);
}
