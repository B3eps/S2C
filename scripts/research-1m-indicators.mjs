// Pre-registered 1m XAU/USD indicator sweep with causal 15m/4h trend context.
// Run: node scripts/research-1m-indicators.mjs [1m]
// Outputs JSON to analysis/research-1m-results.json and a train-selected report.
// The candidate grid is fixed in source before looking at TEST results.
import { build } from 'esbuild';
if (process.argv[2] && process.argv[2] !== '1m') throw new Error('This study requires 1m bars. Run with no timeframe argument or pass 1m.');
process.argv[2] = '1m';
const { data, nyMin } = await import('./backtest-parca.mjs');

const load = async (p) => {
  const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const ind = await load('src/lib/indicators.ts');
const TFMS = 60_000, H = 3_600_000, DAY = 86_400_000, SPREAD = Number(process.env.SPREAD ?? 0.2), MAX_HOLD = 240;

// Candidate definitions, generated without using the holdout. Variants intentionally cover
// trend-following, momentum, and mean-reversion families with conventional default scales.
const specs = [];
const add = (name, id, params, rule) => specs.push({ name, id, params, rule });
for (const [fast, slow] of [[5, 21], [9, 21], [9, 34], [13, 34], [21, 55]]) add(`EMA ${fast}/${slow}`, 'emacross', { fast, slow }, (x, i) => cross(x.fast, x.slow, i));
for (const [fast, slow] of [[5, 21], [10, 30], [20, 50]]) add(`SMA ${fast}/${slow}`, 'sma', { fast, slow }, (x, i) => cross(x.fast, x.slow, i));
for (const [atr, mult] of [[7, 2], [10, 2], [10, 3], [14, 2], [14, 3]]) add(`Supertrend ${atr}/${mult}`, 'supertrend', { atr, mult }, (x, i) => directionFlip(x.up, x.dn, i));
for (const len of [7, 14, 21]) add(`RSI ${len} revert`, 'rsi', { len, ma: len }, (x, i) => crossLevel(x.v, 30, i, 'up') || crossLevel(x.v, 70, i, 'down'));
for (const len of [7, 14]) add(`RSI ${len} midline`, 'rsi', { len, ma: len }, (x, i) => crossLevel(x.v, 50, i, 'either'));
add('MACD 12/26/9', 'macd', { fast: 12, slow: 26, signal: 9 }, (x, i) => cross(x.macd, x.signal, i));
add('Stoch 14/3/3', 'stoch', { k: 3, d: 3, len: 14, smooth: 3 }, (x, i) => x.k[i] < 25 && x.k[i - 1] <= x.d[i - 1] && x.k[i] > x.d[i] ? 1 : x.k[i] > 75 && x.k[i - 1] >= x.d[i - 1] && x.k[i] < x.d[i] ? -1 : 0);
add('Stoch RSI 14', 'stochrsi', { k: 3, d: 3, rsi: 14, stoch: 14 }, (x, i) => x.k[i] < 20 && x.k[i - 1] <= x.d[i - 1] && x.k[i] > x.d[i] ? 1 : x.k[i] > 80 && x.k[i - 1] >= x.d[i - 1] && x.k[i] < x.d[i] ? -1 : 0);
add('CCI 20', 'cci', { len: 20 }, (x, i) => x.v[i - 1] <= -100 && x.v[i] > -100 ? 1 : x.v[i - 1] >= 100 && x.v[i] < 100 ? -1 : 0);
add('Williams %R 14', 'willr', { len: 14 }, (x, i) => crossLevel(x.v, -80, i, 'up') || crossLevel(x.v, -20, i, 'down'));
for (const len of [10, 20, 40]) add(`Donchian ${len} breakout`, 'dc', { len }, (x, i, bars) => bars[i].c > x.upper[i - 1] ? 1 : bars[i].c < x.lower[i - 1] ? -1 : 0);
for (const mult of [1.5, 2, 2.5]) add(`Bollinger 20/${mult} reentry`, 'bb', { len: 20, mult }, (x, i, bars) => bars[i - 1].c < x.lower[i - 1] && bars[i].c >= x.lower[i] ? 1 : bars[i - 1].c > x.upper[i - 1] && bars[i].c <= x.upper[i] ? -1 : 0);
add('VWAP cross', 'vwap', {}, (x, i, bars) => bars[i - 1].c <= x.v[i - 1] && bars[i].c > x.v[i] ? 1 : bars[i - 1].c >= x.v[i - 1] && bars[i].c < x.v[i] ? -1 : 0);
for (const len of [10, 20]) add(`Aroon ${len}`, 'aroon', { len }, (x, i) => x.up[i] > 70 && x.down[i] < 30 && x.up[i - 1] <= 70 ? 1 : x.down[i] > 70 && x.up[i] < 30 && x.down[i - 1] <= 70 ? -1 : 0);
for (const len of [9, 18]) add(`TRIX ${len}`, 'trix', { len }, (x, i) => crossLevel(x.v, 0, i, 'either'));
add('AO 5/34', 'ao', { fast: 5, slow: 34 }, (x, i) => crossLevel(x.v, 0, i, 'either'));
add('PPO 12/26/9', 'ppo', { fast: 12, slow: 26, signal: 9 }, (x, i) => cross(x.v, x.signal, i));
add('CMF 20', 'cmf', { len: 20 }, (x, i) => crossLevel(x.v, 0, i, 'either'));

function cross(a, b, i) { return a[i - 1] <= b[i - 1] && a[i] > b[i] ? 1 : a[i - 1] >= b[i - 1] && a[i] < b[i] ? -1 : 0; }
function crossLevel(a, level, i, mode) {
  const up = a[i - 1] <= level && a[i] > level, down = a[i - 1] >= level && a[i] < level;
  if (mode === 'up') return up ? 1 : 0;
  if (mode === 'down') return down ? -1 : 0;
  return up ? 1 : down ? -1 : 0;
}
function directionFlip(up, dn, i) {
  const now = Number.isFinite(up[i]) ? 1 : Number.isFinite(dn[i]) ? -1 : 0;
  const prev = Number.isFinite(up[i - 1]) ? 1 : Number.isFinite(dn[i - 1]) ? -1 : 0;
  return now && prev && now !== prev ? now : 0;
}
function lastComplete(rows, t, tf) {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].t + tf <= t) lo = mid + 1; else hi = mid; }
  return lo > 0 ? rows[lo - 1] : null;
}
function buildHtf(d) {
  const ema15 = ind.ema(d.m15.map(b => b.c), 50), ema4 = ind.ema(d.h4.map(b => b.c), 20);
  const i15ByT = new Map(d.m15.map((b,i)=>[b.t,i])), i4ByT = new Map(d.h4.map((b,i)=>[b.t,i]));
  return (t) => {
    const a = lastComplete(d.m15, t, 15 * TFMS), b = lastComplete(d.h4, t, 4 * H);
    const i15 = a ? i15ByT.get(a.t) : -1, i4 = b ? i4ByT.get(b.t) : -1;
    const s15 = i15 >= 0 && Number.isFinite(ema15[i15]) ? Math.sign(a.c - ema15[i15]) : 0;
    const s4 = i4 >= 0 && Number.isFinite(ema4[i4]) ? Math.sign(b.c - ema4[i4]) : 0;
    return { m15: s15, h4: s4 };
  };
}
function signalsFor(d, spec) {
  const def = ind.IND_BY_ID[spec.id], params = { ...ind.defaultParams(def), ...spec.params };
  const outputs = spec.id === 'sma'
    ? { fast: ind.sma(d.bars.map(b=>b.c), params.fast), slow: ind.sma(d.bars.map(b=>b.c), params.slow) }
    : def.calc(d.bars, params, { days: d.days });
  const out = [];
  for (let i = 1; i < d.bars.length; i++) {
    if (d.bars[i].t < d.from + 3 * DAY) continue;
    const side = spec.rule(outputs, i, d.bars);
    if (side) out.push({ i, t: d.bars[i].t, side });
  }
  return out;
}
function calcTrade(d, signal, stopAtr, targetR, htfMode) {
  const t = signal.t, side = signal.side, bar = d.bars[signal.i], atr = d.atr[signal.i];
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const context = d.htf(t + TFMS);
  if ((htfMode === '15m' && context.m15 !== side) || (htfMode === '4h' && context.h4 !== side) || (htfMode === 'both' && (context.m15 !== side || context.h4 !== side))) return null;
  const start = d.idx.get(t + TFMS);
  if (start === undefined) return null;
  const fill = side > 0 ? bar.c + SPREAD : bar.c;
  const risk = stopAtr * atr, stop = fill - side * risk, target = fill + side * risk * targetR;
  const end = Math.min(d.m1.length, start + MAX_HOLD);
  for (let j = start; j < end; j++) {
    const b = d.m1[j], lo = side > 0 ? b.l : b.l + SPREAD, hi = side > 0 ? b.h : b.h + SPREAD;
    if (side > 0 ? lo <= stop : hi >= stop) return { r: -1, exit: j, reason: 'stop' };
    if (side > 0 ? hi >= target : lo <= target) return { r: targetR, exit: j, reason: 'target' };
  }
  const last = d.m1[end - 1];
  return { r: side * ((side > 0 ? last.c : last.c + SPREAD) - fill) / risk, exit: end - 1, reason: 'timeout' };
}
const grid = [];
for (const spec of specs) for (const htf of ['none', '15m', '4h', 'both']) for (const stopAtr of [0.8, 1.2]) for (const targetR of [1, 1.5, 2]) grid.push({ spec, htf, stopAtr, targetR });

const days = { train: 0, test: 0 };
for (const d of data) days[d.set] += (d.to - d.from - 3 * 86_400_000) / 86_400_000 * 5 / 7;
for (const d of data) { d.htf = buildHtf(d); d.atr = ind.atr(d.bars, 14); }
console.error(`bars=${data.reduce((n,d)=>n+d.bars.length,0)} trainDays=${days.train.toFixed(1)} testDays=${days.test.toFixed(1)} candidates=${specs.length} trials=${grid.length} spread=${SPREAD}`);
for (const d of data) d.signalCache = new Map(specs.map(spec => [spec.name, signalsFor(d, spec)]));

const results = [];
for (const candidate of grid) {
  const train = [], test = [];
  for (const d of data) {
    const signals = d.signalCache.get(candidate.spec.name);
    const trades = d.set === 'train' ? train : test;
    let busyUntil = -1;
    for (const s of signals) {
      if (s.i <= busyUntil) continue;
      if (nyMin(s.t) < 180 || nyMin(s.t) >= 960) continue;
      const res = calcTrade(d, s, candidate.stopAtr, candidate.targetR, candidate.htf);
      if (!res) continue;
      trades.push(res.r); busyUntil = res.exit;
    }
  }
  const stats = (a, nDays) => ({ n: a.length, tradesPerDay: +(a.length / nDays).toFixed(2), winPct: a.length ? +(100 * a.filter(x => x > 0).length / a.length).toFixed(1) : 0, avgR: a.length ? +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(4) : 0, sumR: +a.reduce((x,y)=>x+y,0).toFixed(2) });
  const tr = stats(train, days.train), te = stats(test, days.test);
  results.push({ strategy: candidate.spec.name, htf: candidate.htf, stopAtr: candidate.stopAtr, targetR: candidate.targetR, train: tr, test: te });
}
// Selection happens only on TRAIN: rank candidates with at least 50 trades. None are
// silently discarded for having negative expectancy; this makes a null result inspectable.
const ranked = results.filter(r => r.train.n >= 50).sort((a,b) => b.train.avgR-a.train.avgR);
const qualified = ranked.filter(r => r.train.avgR > 0);
const selected = ranked.slice(0, 25);
const output = {
  metadata: { instrument: 'XAU/USD', entryTimeframe: '1m', contextTimeframes: ['15m','4h'], dataSource: 'Dukascopy bid candles via dukascopy-node', spread: SPREAD, maxHoldMinutes: MAX_HOLD, periods: data.map(d=>({set:d.set,from:new Date(d.from).toISOString().slice(0,10),to:new Date(d.to).toISOString().slice(0,10)})), trainDays: +days.train.toFixed(1), testDays: +days.test.toFixed(1), indicatorFamilies: specs.length, trialCount: grid.length, selection: 'TRAIN avgR descending, train n>=50 and avgR>0; TEST not used for selection' },
  selected, qualified: qualified.length, all: results,
};
await (await import('node:fs/promises')).writeFile('analysis/research-1m-results.json', JSON.stringify(output, null, 2));
console.table(selected.map(r=>({strategy:r.strategy,htf:r.htf,stopAtr:r.stopAtr,targetR:r.targetR,trainN:r.train.n,trainAvgR:r.train.avgR,testN:r.test.n,testAvgR:r.test.avgR,testWin:r.test.winPct})));
console.error(`saved analysis/research-1m-results.json; positive on TRAIN=${qualified.length}; positive on TEST among TRAIN-selected top 25=${selected.filter(r=>r.test.avgR>0).length}/${selected.length}`);
