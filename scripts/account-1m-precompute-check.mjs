// Verify that a causal one-pass 1m signal list equals the live incremental S2C setup engine.
// Uses real Dukascopy candles and the same Parca Gold A+ params as the account runner.
import fs from 'node:fs';
import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';

async function load(path) {
  const r = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const [market, setup, variants] = await Promise.all([
  load('src/lib/market.ts'), load('src/lib/parcaSetup.ts'), load('src/lib/parcaVariants.ts'),
]);
const MIN = 60_000, H = 3_600_000, H4 = 4 * H, DAY = 86_400_000;
const from = Date.parse('2025-04-08T03:00:00Z'), to = from + 5 * DAY;
const base0 = Math.floor(from / H4) * H4 - H4;

async function rates(tf, start, end) {
  const rows = await getHistoricalRates({
    instrument: 'xauusd', dates: { from: new Date(start), to: new Date(end) }, timeframe: tf,
    priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true,
    useCache: true, cacheFolderPath: '.cache/dukascopy',
  });
  return rows.filter((b) => b.timestamp >= start && b.timestamp < end && !market.isClosed(b.timestamp))
    .map((b) => ({ t: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume ?? 0 }));
}
const aggregate = (bars, ms) => {
  const out = [];
  for (const b of bars) {
    const t = Math.floor(b.t / ms) * ms, last = out[out.length - 1];
    if (last?.t === t) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
    else out.push({ ...b, t });
  }
  return out;
};
const lower = (bars, t) => bars.filter((b) => b.t < t);
const lastN = (bars, n) => bars.slice(-n);

const [m1raw, m5raw, m15raw, h1raw] = await Promise.all([
  rates('m1', base0 - 15 * DAY, to), rates('m5', base0 - 15 * DAY, to),
  rates('m15', base0 - 30 * DAY, to), rates('h1', base0 - 150 * DAY, to),
]);
const m1Hist = lastN(lower(m1raw, base0), 420), m5Hist = lastN(lower(m5raw, base0), 420);
const m15Hist = lastN(lower(m15raw, base0), 420), h1Long = lastN(lower(h1raw, base0), 1680);
const h1Hist = lastN(h1Long, 420), h4Hist = lastN(aggregate(h1Long, H4), 420);
const m1Session = m1raw.filter((b) => b.t >= base0 && b.t < to);
const m5Session = aggregate(m1Session, 5 * MIN), m15Session = aggregate(m1Session, 15 * MIN);
const h1Session = aggregate(m1Session, H), h4Session = aggregate(h1Session, H4);
const days = market.dailyBars(h1Long.concat(h1Session));
const full = {
  '1m': m1Hist.concat(m1Session), '5m': m5Hist.concat(m5Session),
  '15m': m15Hist.concat(m15Session), '1h': h1Hist.concat(h1Session), '4h': h4Hist.concat(h4Session),
};
const params = variants.GOLD_A_SETUP_DEFAULTS;
const t0 = performance.now();
const onePass = setup.analyzeParcaSetup({ tf: '1m', bars: full['1m'], clock: to, days, series: {
  '5m': full['5m'], '15m': full['15m'], '1h': full['1h'], '4h': full['4h'],
}, params }).marks.filter((m) => m.kind === 'signal' && m.t >= from && m.t + MIN <= to);
const offlineMs = performance.now() - t0;

const engine = setup.createSetupEngine('1m', params);
const stream = {
  '1m': m1Hist.concat(lower(m1Session, from)),
  '5m': m5Hist.concat(lower(m5Session, from)),
  '15m': m15Hist.concat(lower(m15Session, from)),
  '1h': h1Hist.concat(lower(h1Session, from)),
  '4h': h4Hist.concat(lower(h4Session, from)),
};
const ix = {
  '1m': stream['1m'].length - m1Hist.length, '5m': stream['5m'].length - m5Hist.length,
  '15m': stream['15m'].length - m15Hist.length, '1h': stream['1h'].length - h1Hist.length,
  '4h': stream['4h'].length - h4Hist.length,
};
const sessionByTf = { '1m': m1Session, '5m': m5Session, '15m': m15Session, '1h': h1Session, '4h': h4Session };
const streamSignals = [];
const t1 = performance.now();
for (const m of m1Session.filter((b) => b.t >= from)) {
  const clock = m.t + MIN;
  for (const tf of ['1m', '5m', '15m', '1h', '4h']) {
    const source = sessionByTf[tf], list = stream[tf];
    while (ix[tf] < source.length && source[ix[tf]].t < clock) list.push(source[ix[tf]++]);
  }
  const res = engine({ bars: stream['1m'], clock, days, series: {
    '5m': stream['5m'], '15m': stream['15m'], '1h': stream['1h'], '4h': stream['4h'],
  } });
  for (const mark of res.marks) if (mark.kind === 'signal' && mark.t + MIN === clock) streamSignals.push(mark);
}
const streamMs = performance.now() - t1;
const key = (m) => [m.t, m.side, m.kind, m.entry, m.stop, m.target, m.source, !!m.strong];
const expected = onePass.map(key), actual = streamSignals.map(key);
const equal = JSON.stringify(expected) === JSON.stringify(actual);
const report = {
  from: new Date(from).toISOString(), to: new Date(to).toISOString(),
  m1Bars: m1Session.length, onePassSignals: onePass.length, streamSignals: streamSignals.length,
  exactlyEqual: equal, offlineMs: Math.round(offlineMs), streamMs: Math.round(streamMs),
  speedup: Number((streamMs / offlineMs).toFixed(2)), firstDifferences: expected.filter((x, i) => JSON.stringify(x) !== JSON.stringify(actual[i])).slice(0, 10),
};
fs.mkdirSync('analysis', { recursive: true });
fs.writeFileSync('analysis/account-1m-precompute-check-20250408.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
if (!equal) process.exitCode = 1;
