// Outcome research for the Parça engines on real Dukascopy XAU/USD candles.
//   node scripts/backtest-parca.mjs [tf=5m] [mode=research|engines]
// Every event comes from the real engine (run once long-only, once short-only), then entry
// models and filters are compared. Fills use the app's rules: bid candles, spread on the ask
// side, stop counted first inside a minute. Periods are split into TRAIN and TEST so a model
// has to hold on data it was not chosen on.
import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';

async function load(path) {
  const r = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const [market, parca, ind] = await Promise.all([load('src/lib/market.ts'), load('src/lib/parcaSetup.ts'), load('src/lib/indicators.ts')]);
const MIN = 60_000, H = 3_600_000, DAY = 86_400_000;
const SPREAD = Number(process.env.SPREAD ?? 0.2);
const TFMS = { '1m': MIN, '5m': 5 * MIN, '15m': 15 * MIN, '1h': H, '4h': 4 * H };
const TF = process.argv[2] ?? '5m';
const MODE = process.argv[3] ?? 'research';
const TRAIN = ['2024-05-13:2024-06-14', '2024-06-30:2024-07-19', '2024-09-16:2024-10-09', '2024-10-21:2024-11-29', '2025-01-02:2025-01-15'];
const TEST = ['2025-04-07:2025-04-30', '2025-08-01:2025-08-28', '2025-10-01:2025-10-31', '2026-04-01:2026-04-17', '2026-05-12:2026-06-26'];

async function rates(tf, from, to) {
  const rows = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(from), to: new Date(to) }, timeframe: tf, priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: '.cache/dukascopy' });
  return rows.filter((b) => b.timestamp >= from && b.timestamp < to && !market.isClosed(b.timestamp)).map((b) => ({ t: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume ?? 0 }));
}
const agg = (bars, ms) => { const out = []; for (const b of bars) { const t = Math.floor(b.t / ms) * ms, l = out[out.length - 1]; if (l && l.t === t) { l.h = Math.max(l.h, b.h); l.l = Math.min(l.l, b.l); l.c = b.c; l.v += b.v; } else out.push({ ...b, t }); } return out; };
const nyFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const nyMin = (t) => { const [h, m] = nyFmt.format(t).split(':').map(Number); return h * 60 + m; };

async function period(spec, set) {
  const [from, to] = spec.split(':').map((d) => Date.parse(d + 'T00:00:00Z'));
  const m1 = await rates('m1', from, to);
  const h1 = await rates('h1', from - 90 * DAY, to);
  const d = { set, from, to, m1, h1, h4: agg(h1, 4 * H), days: market.dailyBars(h1), m5: agg(m1, 5 * MIN), m15: agg(m1, 15 * MIN) };
  d.bars = TF === '1m' ? m1 : TF === '5m' ? d.m5 : d.m15;
  d.idx = new Map(m1.map((b, i) => [b.t, i]));
  d.bi = new Map(d.bars.map((b, i) => [b.t, i]));
  d.atr = ind.atr(d.bars, 14);
  const e1 = ind.ema(h1.map((b) => b.c), 50), e4 = ind.ema(d.h4.map((b) => b.c), 20);
  d.h1ema = h1.map((b, i) => [b.t + H, e1[i], b.c]);
  d.h4ema = d.h4.map((b, i) => [b.t + 4 * H, e4[i], b.c]);
  const series = { '5m': d.m5, '15m': d.m15, '1h': h1, '4h': d.h4 };
  const run = (params) => parca.analyzeParcaSetup({ tf: TF, bars: d.bars, clock: to, days: d.days, series, params }).marks.filter((m) => m.t >= from + 3 * DAY);
  d.run = run;
  // every event regardless of bias: long-only pass and short-only pass, no gates
  const open = { session: 0, sweep: 0 };
  d.events = [...run({ ...open, biasMode: 4 }), ...run({ ...open, biasMode: 5 }).filter((m) => m.kind !== 'sweep')].sort((a, b) => a.t - b.t);
  console.error('loaded', spec, set, m1.length, 'minutes');
  return d;
}
const data = [];
for (const s of TRAIN) data.push(await period(s, 'train'));
for (const s of TEST) data.push(await period(s, 'test'));

/** Result in R of one trade taken at the close of the signal candle. */
function trade(d, t, side, stop, rMult, maxMin = 240, be = 0) {
  const j0 = d.idx.get(t + TFMS[TF]) ?? d.m1.findIndex((b) => b.t >= t + TFMS[TF]);
  if (j0 < 0) return null;
  const long = side === 'long';
  const close = d.bars[d.bi.get(t)].c;
  const fill = long ? close + SPREAD : close;
  const risk = Math.abs(fill - stop);
  if (!(risk > 0)) return null;
  const target = long ? fill + risk * rMult : fill - risk * rMult;
  let st = stop;
  const end = Math.min(d.m1.length, j0 + maxMin);
  for (let j = j0; j < end; j++) {
    const b = d.m1[j];
    const lo = long ? b.l : b.l + SPREAD, hi = long ? b.h : b.h + SPREAD;
    if (long ? lo <= st : hi >= st) return (long ? st - fill : fill - st) / risk;
    if (long ? hi >= target : lo <= target) return rMult;
    // move the stop to entry once price has gone `be` R in favour
    if (be && (long ? hi >= fill + risk * be : lo <= fill - risk * be)) st = fill;
  }
  const last = d.m1[end - 1];
  const exit = long ? last.c : last.c + SPREAD;
  return (long ? exit - fill : fill - exit) / risk;
}

const lastBefore = (rows, now) => { let n = rows.length; while (n > 0 && rows[n - 1][0] > now) n--; return rows[n - 1]; };
const BIAS = {
  none: () => 0,
  vote: (d, t) => parca.biasAt(t, d.days, d.h1, d.h4, 2),
  majority: (d, t) => parca.biasAt(t, d.days, d.h1, d.h4, 6),
  daily: (d, t) => parca.biasAt(t, d.days, d.h1, d.h4, 1),
  ema1h: (d, t) => { const r = lastBefore(d.h1ema, t); return r && Number.isFinite(r[1]) ? Math.sign(r[2] - r[1]) : 0; },
  ema4h: (d, t) => { const r = lastBefore(d.h4ema, t); return r && Number.isFinite(r[1]) ? Math.sign(r[2] - r[1]) : 0; },
  emaBoth: (d, t) => { const a = BIAS.ema1h(d, t), b = BIAS.ema4h(d, t); return a === b ? a : 0; },
};
const SESSION = {
  any: () => true,
  lonNy: (t) => { const m = nyMin(t); return m >= 180 && m < 960; },
  nyAm: (t) => { const m = nyMin(t); return m >= 480 && m < 720; },
  lonAm: (t) => { const m = nyMin(t); return m >= 180 && m < 420; },
  kill: (t) => { const m = nyMin(t); return (m >= 180 && m < 360) || (m >= 510 && m < 690); },
};

/** Stop for an event that carries none: beyond the recent swing, at least `minAtr` ATR away. */
function swingStop(d, t, side, look = 10, minAtr = 0.8) {
  const i = d.bi.get(t), a = d.atr[i] || 0, b = d.bars;
  let ext = side === 'long' ? Infinity : -Infinity;
  for (let k = Math.max(0, i - look); k <= i; k++) ext = side === 'long' ? Math.min(ext, b[k].l) : Math.max(ext, b[k].h);
  return side === 'long' ? Math.min(ext - a * 0.1, b[i].c - a * minAtr) : Math.max(ext + a * 0.1, b[i].c + a * minAtr);
}

/** Entry models: each returns [{t, side, stop}] for one period. */
const MODELS = {
  // the video's double confirmation, as the engine marks it
  signal: (d) => d.events.filter((m) => m.kind === 'signal').map((m) => ({ t: m.t, side: m.side, stop: m.stop, strong: m.strong })),
  // engulf alone and structure break alone (the video takes either when the bias is clear)
  engulf: (d) => d.events.filter((m) => m.kind === 'engulf').map((m) => ({ t: m.t, side: m.side, stop: swingStop(d, m.t, m.side) })),
  msp: (d) => d.events.filter((m) => m.kind === 'msp' || m.kind === 'signal').map((m) => ({ t: m.t, side: m.side, stop: swingStop(d, m.t, m.side) })),
  // liquidity first: a session level is swept, then the first engulf / structure break the other way
  sweepThen: (d, w = 12) => {
    const out = [];
    const ev = d.events;
    for (let k = 0; k < ev.length; k++) {
      const s = ev[k];
      if (s.kind !== 'sweep') continue;
      const i0 = d.bi.get(s.t);
      for (let q = k; q < ev.length; q++) {
        const m = ev[q];
        const i = d.bi.get(m.t);
        if (i - i0 > w) break;
        if (m.kind === 'sweep' || m.side !== s.side || i < i0) continue;
        let ext = s.side === 'long' ? Infinity : -Infinity;
        for (let x = Math.max(0, i0 - 3); x <= i; x++) ext = s.side === 'long' ? Math.min(ext, d.bars[x].l) : Math.max(ext, d.bars[x].h);
        const a = d.atr[i] || 0;
        out.push({ t: m.t, side: s.side, stop: s.side === 'long' ? Math.min(ext - a * 0.1, d.bars[i].c - a * 0.8) : Math.max(ext + a * 0.1, d.bars[i].c + a * 0.8), level: s.source });
        break;
      }
    }
    return out;
  },
  // the sweep candle itself, no confirmation
  sweep: (d) => d.events.filter((m) => m.kind === 'sweep').map((m) => ({ t: m.t, side: m.side, stop: swingStop(d, m.t, m.side, 3), level: m.source })),
};

function evaluate(name, entries, { bias = 'none', session = 'any', r = 1, be = 0, filter } = {}) {
  const res = { train: [], test: [] };
  const per = [];
  let days = { train: 0, test: 0 };
  for (const d of data) {
    days[d.set] += (d.to - d.from - 3 * DAY) / DAY * 5 / 7;
    let last = -Infinity;
    const out = [];
    for (const e of entries(d)) {
      if (e.t - last < TFMS[TF]) continue;
      if (!SESSION[session](e.t)) continue;
      const b = BIAS[bias](d, e.t + TFMS[TF]);
      if (bias !== 'none' && b !== (e.side === 'long' ? 1 : -1)) continue;
      if (filter && !filter(e, d)) continue;
      const x = trade(d, e.t, e.side, e.stop, r, 240, be);
      if (x === null) continue;
      last = e.t;
      out.push(x);
    }
    res[d.set].push(...out);
    per.push(out.reduce((a, b) => a + b, 0).toFixed(0));
  }
  const st = (a, dd) => ({ n: a.length, perDay: +(a.length / dd).toFixed(1), win: a.length ? Math.round(100 * a.filter((x) => x > 0).length / a.length) : 0, avgR: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : 0 });
  const tr = st(res.train, days.train), te = st(res.test, days.test);
  return { model: name, bias, session, r, be, 'train n/day': tr.perDay, 'train win%': tr.win, 'train avgR': tr.avgR, 'test n/day': te.perDay, 'test win%': te.win, 'test avgR': te.avgR, periods: per.join(' ') };
}

const rows = [];
const main = /backtest-parca\.mjs$/.test(process.argv[1] ?? '');
if (!main) {} else if (MODE === 'engines') {
  const { GOLD_SETUP_DEFAULTS, GOLD_A_SETUP_DEFAULTS } = await load('src/lib/parcaVariants.ts');
  for (const [name, params] of [['Klasik (varsayılan)', {}], ['Gold (varsayılan)', GOLD_SETUP_DEFAULTS], ['Gold A+', GOLD_A_SETUP_DEFAULTS]]) {
    for (const r of [0.75, 1, 1.5]) rows.push(evaluate(name, (d) => d.run(params).filter((m) => m.kind === 'signal').map((m) => ({ t: m.t, side: m.side, stop: m.stop })), { r }));
  }
} else {
  for (const model of Object.keys(MODELS)) for (const bias of Object.keys(BIAS)) for (const session of ['lonNy', 'kill']) for (const r of [1, 2]) {
    rows.push(evaluate(model, MODELS[model], { bias, session, r }));
  }
  rows.sort((a, b) => Math.min(b['train avgR'], b['test avgR']) - Math.min(a['train avgR'], a['test avgR']));
}
if (main) console.table(MODE === 'engines' ? rows : rows.slice(0, 28));
export { data, evaluate, MODELS, BIAS, SESSION, trade, swingStop, nyMin };
