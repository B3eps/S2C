import { Bar, TF, TFS, TF_MS } from './types';
import { DayBar, dailyBars, isClosed, usDst } from './market';
import { INSTRUMENT_BY_ID, InstrumentId, tradesAllWeek } from './instruments';

/** Closed minutes of an instrument: crypto never closes. */
const closedFor = (inst: InstrumentId) => (tradesAllWeek(INSTRUMENT_BY_ID[inst]) ? () => false : isClosed);

const MIN = 60_000;
const DAY = 86_400_000;

export { isClosed };

function aggregate(bars: Bar[], ms: number): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const t = Math.floor(b.t / ms) * ms;
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

/**
 * Real XAU/USD candles (Dukascopy) served by the local endpoint in vite.config.ts.
 * 4-hour candles are built from hourly ones: a native 4-hour candle straddles the weekend
 * close, so it cannot be filtered by its open time without losing or leaking an hour.
 */
async function fetchCandles(tf: TF, from: number, to: number, inst: InstrumentId = 'xauusd'): Promise<Bar[]> {
  const closed = closedFor(inst);
  if (tf === '4h') {
    const ms = TF_MS['4h'];
    return aggregate(await fetchCandles('1h', Math.floor(from / ms) * ms, to, inst), ms).filter((b) => b.t >= from);
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/api/candles?i=${inst}&tf=${tf}&from=${Math.floor(from)}&to=${Math.floor(to)}`);
      if (!res.ok) throw new Error(`${inst} ${res.status}`);
      const raw: unknown = await res.json();
      if (!Array.isArray(raw)) throw new Error('Geçersiz mum verisi');
      let previous = -Infinity;
      const bars: Bar[] = [];
      for (const row of raw) {
        if (!Array.isArray(row) || row.length < 6 || !row.every((v) => typeof v === 'number' && Number.isFinite(v))) throw new Error('Geçersiz mum verisi');
        const [t, o, h, l, c, v] = row;
        if (t < from || t >= to || t % TF_MS[tf] !== 0 || t <= previous || h < Math.max(o, c, l) || l > Math.min(o, c, h) || v < 0) throw new Error('Mum verisi tutarsız');
        previous = t;
        if (!closed(t)) bars.push({ t, o, h, l, c, v });
      }
      return bars;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Historical candles may only use minutes closed by the exclusive replay cutoff. */
export async function fetchRange(tf: TF, from: number, to: number, inst: InstrumentId = 'xauusd'): Promise<Bar[]> {
  const bucket = Math.floor(to / TF_MS[tf]) * TF_MS[tf];
  const [history, tail] = await Promise.all([
    bucket > from ? fetchCandles(tf, from, bucket, inst) : Promise.resolve([] as Bar[]),
    tf !== '1m' && bucket >= from && to - bucket >= MIN
      ? fetchCandles('1m', bucket, Math.floor(to / MIN) * MIN, inst)
      : Promise.resolve([] as Bar[]),
  ]);
  if (!tail.length) return history;
  return history.concat({
    t: bucket, o: tail[0].o, h: Math.max(...tail.map(b => b.h)),
    l: Math.min(...tail.map(b => b.l)), c: tail[tail.length - 1].c,
    v: tail.reduce((total, b) => total + b.v, 0),
  });
}

/** Expected quote minutes, excluding the usual 17:00–18:00 New York maintenance.
 * Holidays and thin markets can still appear as flagged gaps. */
export function missingQuoteMinutes(first: number, until: number, stopAt = Infinity, inst: InstrumentId = 'xauusd'): number {
  const closed = closedFor(inst);
  let missing = 0;
  for (let t = first; t < until; t += MIN) {
    const localHour = new Date(t - (usDst(t) ? 4 : 5) * 3_600_000).getUTCHours();
    if (!closed(t) && localHour !== 17 && ++missing >= stopAt) break;
  }
  return missing;
}

/** Last `count` closed bars that opened before `end`. */
async function fetchBefore(tf: TF, end: number, count: number, inst: InstrumentId): Promise<Bar[]> {
  // ~5 trading days in 7, plus holidays: ask for twice the span
  const span = Math.max(TF_MS[tf] * count * 2, 3 * DAY);
  const bars = await fetchCandles(tf, end - span, end, inst);
  return bars.slice(-count);
}

/** Random minute inside the last three years (ending two weeks ago), inside trading hours. */
export function randomStart(inst: InstrumentId = 'xauusd'): number {
  const closed = closedFor(inst);
  const hi = Date.now() - 14 * DAY;
  const lo = Date.now() - 3 * 365 * DAY;
  for (;;) {
    const t = Math.floor((lo + Math.random() * (hi - lo)) / MIN) * MIN;
    if (!closed(t) && !closed(t - 6 * 3_600_000)) return t;
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
  /** long hourly history: enough closed trading days for the daily candles */
  private h1Long: Bar[] = [];
  private dayCache: { ci: number; days: DayBar[] } | null = null;
  agg = {} as Record<TF, Bar[]>;
  base0: number;
  exhausted = false;
  hasGaps = false;
  private loading: Promise<void> | null = null;
  loadError = false;

  private constructor(public startMs: number, public inst: InstrumentId) {
    this.base0 = Math.floor(startMs / TF_MS['4h']) * TF_MS['4h'] - TF_MS['4h'];
    for (const tf of TFS) this.agg[tf] = [];
  }

  static async create(startMs: number, clockMs = startMs, onProgress?: (p: number) => void, inst: InstrumentId = 'xauusd'): Promise<Feed> {
    const f = new Feed(startMs, inst);
    let done = 0;
    const tick = () => onProgress?.(++done / (TFS.length + 1));
    await Promise.all(
      TFS.map(async (tf) => {
        if (tf === '1h') {
          f.h1Long = await fetchBefore('1h', f.base0, HIST * 4, inst);
          f.hist[tf] = f.h1Long.slice(-HIST);
        } else f.hist[tf] = await fetchBefore(tf, f.base0, HIST, inst);
        tick();
      }),
    );
    await f.loadMore(Math.max(clockMs, startMs) + 2 * DAY);
    tick();
    f.advanceTo(clockMs);
    if (f.ci < 0) throw new Error('Seans için mum verisi bulunamadı');
    return f;
  }

  private cursor = 0;

  private async loadMore(until: number) {
    if (!this.cursor) this.cursor = this.base0;
    const now = Math.floor(Date.now() / MIN) * MIN - 2 * MIN;
    while (this.cursor < until && this.cursor < now) {
      const to = Math.min(this.cursor + 2 * DAY, now);
      const chunk = await fetchCandles('1m', this.cursor, to, this.inst);
      const last = this.minutes[this.minutes.length - 1];
      if (!this.hasGaps) {
        let expected = this.cursor;
        for (const b of chunk) {
          if (missingQuoteMinutes(expected, b.t, 1, this.inst)) { this.hasGaps = true; break; }
          expected = b.t + MIN;
        }
        if (!this.hasGaps && missingQuoteMinutes(expected, to, 1, this.inst)) this.hasGaps = true;
      }
      this.minutes.push(...(last ? chunk.filter((b) => b.t > last.t) : chunk));
      this.cursor = to;
    }
    if (this.cursor >= now) this.exhausted = true;
  }

  /** Prefetch more minutes in the background when the cursor nears the end. */
  ensureAhead() {
    if (this.loading || this.exhausted) return this.loading;
    if (this.minutes.length - this.ci > 3000) return null;
    this.loadError = false;
    this.loading = this.loadMore(this.cursor + 4 * DAY)
      .catch(() => { this.loadError = true; })
      .finally(() => (this.loading = null));
    return this.loading;
  }

  get isLoading() {
    return !!this.loading;
  }

  async waitForLoading() {
    await this.loading;
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

  }

  /** Reveal the next 1-minute bar. Returns null when data is not loaded yet. */
  step(): Bar | null {
    if (this.loadError && this.ci + 1 >= this.minutes.length) return null;
    if (!this.loadError) this.ensureAhead();
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
  /** Trading-day candles (17:00 New York cut) up to the replay clock; the last one may be open. */
  days(): DayBar[] {
    if (this.dayCache?.ci !== this.ci) this.dayCache = { ci: this.ci, days: dailyBars(this.h1Long.concat(this.agg['1h'])) };
    return this.dayCache.days;
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
export async function fetchWindow(from: number, to: number, tf: TF, inst: InstrumentId = 'xauusd') {
  return fetchRange(tf, from, to, inst);
}
