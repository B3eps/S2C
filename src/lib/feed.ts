import { Bar, TF, TFS, TF_MS } from './types';

const API = 'https://api.binance.com/api/v3/klines';
const SYMBOL = 'PAXGUSDT';
const MIN = 60_000;

/** Gold does not trade on weekends: hide Fri 21:00 UTC → Sun 22:00 UTC. */
export function isClosed(t: number) {
  const d = new Date(t);
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  return (day === 5 && h >= 21) || day === 6 || (day === 0 && h < 22);
}

async function fetchKlines(interval: TF, q: { startTime?: number; endTime?: number; limit: number }): Promise<Bar[]> {
  const p = new URLSearchParams({ symbol: SYMBOL, interval, limit: String(q.limit) });
  if (q.startTime !== undefined) p.set('startTime', String(q.startTime));
  if (q.endTime !== undefined) p.set('endTime', String(q.endTime));
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?${p}`);
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      const raw = (await res.json()) as unknown[][];
      return raw.map((k) => ({
        t: k[0] as number,
        o: +(k[1] as string),
        h: +(k[2] as string),
        l: +(k[3] as string),
        c: +(k[4] as string),
        v: +(k[5] as string),
      }));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function fetchRange(interval: TF, from: number, to: number): Promise<Bar[]> {
  const out: Bar[] = [];
  let cursor = from;
  while (cursor < to) {
    const chunk = await fetchKlines(interval, { startTime: cursor, endTime: to, limit: 1000 });
    if (!chunk.length) break;
    out.push(...chunk);
    cursor = chunk[chunk.length - 1].t + TF_MS[interval];
    if (chunk.length < 1000) break;
  }
  return out.filter((b) => !isClosed(b.t));
}

/** Uniform random minute between Mar 2021 and two weeks ago, inside trading hours. */
export function randomStart(): number {
  const lo = Date.UTC(2023, 0, 1); // PAXG liquidity on Binance is thin before 2023
  const hi = Date.now() - 14 * 86_400_000;
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
        const bars = await fetchKlines(tf, { endTime: f.base0 - 1, limit: HIST + 200 });
        f.hist[tf] = bars.filter((b) => !isClosed(b.t)).slice(-HIST);
        tick();
      }),
    );
    await f.loadMore(Math.max(clockMs, startMs) + 1200 * MIN);
    tick();
    f.advanceTo(clockMs);
    return f;
  }

  private async loadMore(until: number) {
    let from = this.minutes.length ? this.minutes[this.minutes.length - 1].t + MIN : this.base0;
    const now = Date.now() - 2 * MIN;
    while (from < until && from < now) {
      const chunk = await fetchKlines('1m', { startTime: from, limit: 1000 });
      if (!chunk.length) {
        this.exhausted = true;
        return;
      }
      this.minutes.push(...chunk.filter((b) => !isClosed(b.t)));
      from = chunk[chunk.length - 1].t + MIN;
      if (chunk.length < 1000) {
        this.exhausted = true;
        return;
      }
    }
    if (from >= now) this.exhausted = true;
  }

  /** Prefetch more minutes in the background when the cursor nears the end. */
  ensureAhead() {
    if (this.loading || this.exhausted) return this.loading;
    if (this.minutes.length - this.ci > 3000) return null;
    const last = this.minutes[this.minutes.length - 1];
    this.loading = this.loadMore(last.t + 5000 * MIN)
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
