import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

const [market, parca] = await Promise.all([load('src/lib/market.ts'), load('src/lib/parcaSetup.ts')]);
const minute = 60_000;
const frames = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240 };
const from = new Date(process.argv[2] ?? '2026-08-24T00:00:00Z');
const to = new Date(process.argv[3] ?? '2026-08-29T00:00:00Z');
const tf = process.argv[4] ?? '5m';
const rows = await getHistoricalRates({
  instrument: 'xauusd', dates: { from, to }, timeframe: 'm1', priceType: 'bid',
  format: 'json', volumes: true, ignoreFlats: true, useCache: true,
  cacheFolderPath: '.cache/dukascopy',
});
const minutes = rows.map((r) => ({ t: r.timestamp, o: r.open, h: r.high, l: r.low, c: r.close, v: r.volume ?? 0 }));
function aggregate(bars, size) {
  const out = [];
  for (const b of bars) {
    const t = Math.floor(b.t / (size * minute)) * size * minute;
    const last = out.at(-1);
    if (last?.t === t) {
      last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l);
      last.c = b.c; last.v += b.v;
    } else out.push({ ...b, t });
  }
  return out;
}
const series = Object.fromEntries(Object.entries(frames).map(([tf, size]) => [tf, aggregate(minutes, size)]));
const days = market.dailyBars(series['1h']);
const clock = minutes.at(-1).t + minute;
const studyFrom = from.getTime() + 2 * 24 * 60 * minute;
for (const [name, params] of [
  ['önceki ayar', { window: 8, minGap: 0.3 }],
  ['pencere 10', { window: 10, minGap: 0.3 }],
  ['FVG 0.25', { window: 8, minGap: 0.25 }],
  ['ikisi', { window: 10, minGap: 0.25 }],
  ['üçü aynı', { window: 10, minGap: 0.25, biasMode: 3 }],
  ['çoğunluk', { window: 10, minGap: 0.25, biasMode: 6 }],
  ['Gold dosyası', { pivot: 3, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 1, session: 1 }],
  ['Gold dengeli likidite', { pivot: 3, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 2, session: 1 }],
  ['Gold sweep isteğe bağlı', { pivot: 3, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 0, session: 1 }],
  ['Gold pivot 2', { pivot: 2, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 1, session: 1 }],
  ['Gold gap 0.35', { pivot: 3, window: 6, zoneAge: 60, minGap: 0.35, biasMode: 2, sweep: 1, session: 1 }],
  ['Gold pencere 8', { pivot: 3, window: 8, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 1, session: 1 }],
  ['Gold dengeli', { pivot: 2, window: 8, zoneAge: 60, minGap: 0.35, biasMode: 2, sweep: 1, session: 1 }],
  ['Gold dengeli sweep opsiyonel', { pivot: 2, window: 8, zoneAge: 60, minGap: 0.35, biasMode: 2, sweep: 0, session: 1 }],
]) {
  const result = parca.analyzeParcaSetup({ tf, bars: series[tf], clock, series, days, params });
  const signals = result.marks.filter((m) => m.kind === 'signal' && m.t >= studyFrom);
  console.log(name, { signals: signals.length, days: new Set(signals.map((m) => new Date(m.t).toISOString().slice(0, 10))).size,
    strong: signals.filter((m) => m.strong).length,
    long: signals.filter((m) => m.side === 'long').length, short: signals.filter((m) => m.side === 'short').length,
    ...(name === 'Gold dosyası' ? { times: signals.map((m) => new Date(m.t).toISOString()) } : {}) });
}
