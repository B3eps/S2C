// Expanded 1m XAU/USD sweep of the signal-capable registry indicators not covered by
// research-1m-indicators.mjs. This is a candle-level historical analysis, not app simulation.
// Run: node scripts/research-1m-expanded.mjs [1m]
// Outputs analysis/research-1m-expanded-results.json.
import { build } from 'esbuild';
if (process.argv[2] && process.argv[2] !== '1m') throw new Error('This study requires 1m bars. Run with no timeframe argument or pass 1m.');
process.argv[2] = '1m';
const { data, nyMin } = await import('./backtest-parca.mjs');

const load = async (p) => {
  const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const ind = await load('src/lib/indicators.ts');
const setups = await load('src/lib/parcaVariants.ts');
const TFMS = 60_000, H = 3_600_000, DAY = 86_400_000, SPREAD = Number(process.env.SPREAD ?? 0.2), MAX_HOLD = 240;

// Remaining causal rules are deliberately simple and preregistered. The rule set excludes
// output series that look forward (Ichimoku lag), and uses volume only as provider tick-volume.
const specs = [];
const add = (name, id, params, rule, extra = {}) => specs.push({ name, id, params, rule, ...extra });
add('EMA 9/21 cross', 'ema', {}, (x,i)=>cross(x.fast,x.slow,i), { maPair:[9,21] });
const engineSpecs = [
  { name:'Parça Klasik engine', id:'parca-setup', params:{} },
  { name:'Parça Gold engine', id:'parca-setup-gold', params:setups.GOLD_SETUP_DEFAULTS },
  { name:'Parça Gold A+ engine', id:'parca-setup-gold-a', params:setups.GOLD_A_SETUP_DEFAULTS },
].map(s=>({...s,engine:true}));
for (const [id, name] of [['alma','ALMA'],['kama','KAMA'],['wma','WMA'],['hma','HMA'],['dema','DEMA'],['tema','TEMA'],['vwma','VWMA'],['smma','SMMA'],['lsma','LSMA'],['mcginley','McGinley']]) {
  add(`${name} 9/21 cross`, id, {}, (x, i) => cross(x.fast, x.slow, i), { maPair: [9, 21] });
}
add('Keltner basis cross', 'kc', { len: 20, mult: 2, atr: 10 }, (x,i) => cross(x.close,x.basis,i), { derive:(x,b)=>({...x,close:b.map(z=>z.c)}) });
add('Keltner outer reentry', 'kc', { len: 20, mult: 2, atr: 10 }, (x,i,b) => b[i-1].c<x.lower[i-1]&&b[i].c>=x.lower[i]?1:b[i-1].c>x.upper[i-1]&&b[i].c<=x.upper[i]?-1:0);
add('Envelope outer reentry', 'env', { len: 20, pct: 0.15 }, (x,i,b) => b[i-1].c<x.lower[i-1]&&b[i].c>=x.lower[i]?1:b[i-1].c>x.upper[i-1]&&b[i].c<=x.upper[i]?-1:0);
add('Ichimoku Tenkan/Kijun cross', 'ichimoku', {}, (x,i) => cross(x.conv,x.base,i));
add('Alligator lips/teeth cross', 'alligator', {}, (x,i) => cross(x.lips,x.teeth,i));
add('Pivot central cross', 'pivots', {}, (x,i) => cross(x.close,x.p,i), { derive:(x,b)=>({...x,close:b.map(z=>z.c)}) });
add('Pivot S1/R1 reclaim', 'pivots', {}, (x,i,b) => b[i-1].c<=x.s1[i-1]&&b[i].c>x.s1[i]?1:b[i-1].c>=x.r1[i-1]&&b[i].c<x.r1[i]?-1:0);
add('Parabolic SAR flip', 'psar', {}, (x,i,b) => b[i-1].c<=x.v[i-1]&&b[i].c>x.v[i]?1:b[i-1].c>=x.v[i-1]&&b[i].c<x.v[i]?-1:0);
add('DMI cross, ADX>20', 'adx', { len:14, adx:14 }, (x,i) => x.adx[i]>=20?cross(x.plus,x.minus,i):0);
add('Vortex 14 cross', 'vortex', { len:14 }, (x,i) => cross(x.plus,x.minus,i));
add('Momentum 10 zero cross', 'mom', { len:10 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('ROC 9 zero cross', 'roc', { len:9 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('Ultimate Oscillator 30/70 reentry', 'uo', {}, (x,i) => x.v[i-1]<30&&x.v[i]>=30?1:x.v[i-1]>70&&x.v[i]<=70?-1:0);
add('TSI 25/13 signal cross', 'tsi', {}, (x,i) => cross(x.v,x.signal,i));
add('CMO 9 zero cross', 'cmo', { len:9 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('DPO 21 zero cross', 'dpo', { len:21 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('Coppock zero cross', 'coppock', {}, (x,i) => crossLevel(x.v,0,i,'either'));
add('Fisher / trigger cross', 'fisher', { len:9 }, (x,i) => cross(x.v,x.trigger,i));
add('KST / signal cross', 'kst', {}, (x,i) => cross(x.v,x.signal,i));
add('Bull/Bear Power zero cross', 'bbpower', { len:13 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('RVI / signal cross', 'rvi', { len:10 }, (x,i) => cross(x.v,x.signal,i));
add('BOP 14 zero cross', 'bop', { len:14 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('Bollinger %B 0/1 reentry', 'bbpct', { len:20,mult:2 }, (x,i) => x.v[i-1]<0&&x.v[i]>=0?1:x.v[i-1]>1&&x.v[i]<=1?-1:0);
add('OBV / EMA20 cross', 'obv', {}, (x,i) => cross(x.v,x.sig,i), { derive: x => ({...x,sig:ind.ema(x.v,20)}) });
add('MFI 14 20/80 reentry', 'mfi', { len:14 }, (x,i) => x.v[i-1]<20&&x.v[i]>=20?1:x.v[i-1]>80&&x.v[i]<=80?-1:0);
add('A/D 5-bar slope reversal', 'ad', {}, (x,i) => x.slope[i-1]<=0&&x.slope[i]>0?1:x.slope[i-1]>=0&&x.slope[i]<0?-1:0, { derive:x=>({...x,slope:x.v.map((v,i)=>i>=5?v-x.v[i-5]:NaN)}) });
add('Chaikin oscillator zero cross', 'chaikinosc', {}, (x,i) => crossLevel(x.v,0,i,'either'));
add('PVT 5-bar slope reversal', 'pvt', {}, (x,i) => x.slope[i-1]<=0&&x.slope[i]>0?1:x.slope[i-1]>=0&&x.slope[i]<0?-1:0, { derive:x=>({...x,slope:x.v.map((v,i)=>i>=5?v-x.v[i-5]:NaN)}) });
add('EOM 14 zero cross', 'eom', { len:14 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('EFI 13 zero cross', 'efi', { len:13 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('Volume oscillator 5/10 cross', 'volosc', { fast:5,slow:10 }, (x,i) => crossLevel(x.v,0,i,'either'));
add('Volume>MA20 + EMA9/21 cross', 'vol', { ma:20 }, (x,i) => x.v[i]>x.ma[i]?cross(x.fast,x.slow,i):0, { derive:(x,b)=>({...x,fast:ind.ema(b.map(z=>z.c),9),slow:ind.ema(b.map(z=>z.c),21)}) });
add('Choppiness<38 + EMA9/21', 'chop', { len:14 }, (x,i) => x.v[i]<38?cross(x.fast,x.slow,i):0, { derive:(x,b)=>({...x,fast:ind.ema(b.map(z=>z.c),9),slow:ind.ema(b.map(z=>z.c),21)}) });
add('Mass index gate + EMA9/21', 'mass', { len:25 }, (x,i) => x.v[i]>26.5?cross(x.fast,x.slow,i):0, { derive:(x,b)=>({...x,fast:ind.ema(b.map(z=>z.c),9),slow:ind.ema(b.map(z=>z.c),21)}) });
for (const [id, name, params] of [['atr','ATR14', {len:14}],['stdev','StdDev20',{len:20}],['hv','HV10',{len:10}],['bbw','BBW20',{len:20,mult:2}]]) {
  add(`${name}>SMA288 + EMA9/21`, id, params, (x,i) => x.v[i]>x.avg[i]?cross(x.fast,x.slow,i):0, { derive:(x,b)=>({...x,avg:ind.sma(x.v,288),fast:ind.ema(b.map(z=>z.c),9),slow:ind.ema(b.map(z=>z.c),21)}) });
}

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
  if (spec.engine) return d.run(spec.params).filter(m=>m.kind==='signal').map(m=>({i:d.bi.get(m.t),t:m.t,side:m.side==='long'?1:-1,stop:m.stop})).filter(m=>Number.isInteger(m.i));
  const def = ind.IND_BY_ID[spec.id], params = { ...ind.defaultParams(def), ...spec.params };
  let outputs;
  if (spec.maPair) {
    const pFast = { ...params, len: spec.maPair[0] }, pSlow = { ...params, len: spec.maPair[1] };
    outputs = { fast: def.calc(d.bars, pFast, { days:d.days }).v, slow: def.calc(d.bars, pSlow, { days:d.days }).v };
  } else outputs = def.calc(d.bars, params, { days: d.days });
  if (spec.derive) outputs = spec.derive(outputs, d.bars);
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
  if (start + MAX_HOLD > d.m1.length) return null; // don't mark a window-edge candle as an exit
  // The signal is known only after its candle closes; enter at the following 1m open.
  const open = d.m1[start].o;
  const fill = side > 0 ? open + SPREAD : open;
  const stop = Number.isFinite(signal.stop) ? signal.stop : fill - side * stopAtr * atr;
  const risk = side * (fill - stop);
  if (!(risk > 0)) return null;
  const target = fill + side * risk * targetR;
  const end = start + MAX_HOLD;
  for (let j = start; j < end; j++) {
    const b = d.m1[j], lo = side > 0 ? b.l : b.l + SPREAD, hi = side > 0 ? b.h : b.h + SPREAD;
    const openExit = side > 0 ? b.o : b.o + SPREAD;
    if (side > 0 ? openExit <= stop : openExit >= stop) return { r: side * (openExit - fill) / risk, exit: j, reason: 'gap-stop' };
    if (side > 0 ? lo <= stop : hi >= stop) return { r: -1, exit: j, reason: 'stop' };
    if (side > 0 ? hi >= target : lo <= target) return { r: targetR, exit: j, reason: 'target' };
  }
  const last = d.m1[end - 1];
  return { r: side * ((side > 0 ? last.c : last.c + SPREAD) - fill) / risk, exit: end - 1, reason: 'timeout' };
}
const grid = [];
for (const spec of [...specs,...engineSpecs]) for (const htf of ['none', '15m', '4h', 'both']) for (const stopAtr of (spec.engine?[null]:[0.8,1.2])) for (const targetR of [1, 1.5, 2]) grid.push({ spec, htf, stopAtr, targetR });
const priorIds = ['emacross','sma','supertrend','rsi','macd','stoch','stochrsi','cci','willr','dc','bb','vwap','aroon','trix','ao','ppo','cmf'];
const coveredIds = new Set([...priorIds,...specs.map(s=>s.id),...engineSpecs.map(s=>s.id)]);
const missingIds = ind.INDICATORS.map(d=>d.id).filter(id=>!coveredIds.has(id));
if (missingIds.length) console.error(`UNTESTED REGISTRY IDS: ${missingIds.join(', ')}`);

const days = { train: 0, test: 0 };
for (const d of data) days[d.set] += (d.to - d.from - 3 * 86_400_000) / 86_400_000 * 5 / 7;
for (const d of data) { d.htf = buildHtf(d); d.atr = ind.atr(d.bars, 14); }
console.error(`bars=${data.reduce((n,d)=>n+d.bars.length,0)} trainDays=${days.train.toFixed(1)} testDays=${days.test.toFixed(1)} candidates=${specs.length} trials=${grid.length} spread=${SPREAD}`);
for (const d of data) d.signalCache = new Map([...specs,...engineSpecs].map(spec => [spec.name, signalsFor(d, spec)]));

const results = [];
for (const candidate of grid) {
  const train = [], test = [];
  const signalSides = { train: { long:0, short:0 }, test: { long:0, short:0 } };
  for (const d of data) {
    const signals = d.signalCache.get(candidate.spec.name);
    for (const s of signals) signalSides[d.set][s.side > 0 ? 'long' : 'short']++;
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
  results.push({ strategy: candidate.spec.name, htf: candidate.htf, stopAtr: candidate.stopAtr, targetR: candidate.targetR, signals: signalSides, train: tr, test: te });
}
// Selection happens only on TRAIN: rank candidates with at least 50 trades. None are
// silently discarded for having negative expectancy; this makes a null result inspectable.
const ranked = results.filter(r => r.train.n >= 50).sort((a,b) => b.train.avgR-a.train.avgR);
const qualified = ranked.filter(r => r.train.avgR > 0);
const selected = ranked.slice(0, 25);
const output = {
  metadata: { instrument: 'XAU/USD', entryTimeframe: '1m', contextTimeframes: ['15m','4h'], dataSource: 'Dukascopy bid candles via dukascopy-node', spread: SPREAD, fill: 'next 1m open after signal close; long at open+spread and short at bid open', maxHoldMinutes: MAX_HOLD, stopAndTarget: 'stop first when stop and target are both touched in a minute; non-engine stop 0.8/1.2 ATR14; engine stop from mark; target 1/1.5/2R', periods: data.map(d=>({set:d.set,from:new Date(d.from).toISOString().slice(0,10),to:new Date(d.to).toISOString().slice(0,10)})), trainDays: +days.train.toFixed(1), testDays: +days.test.toFixed(1), registryIds:ind.INDICATORS.length, coverageAudit:{covered:coveredIds.size,missing:missingIds}, indicatorConfigurations: specs.length, engineConfigurations:engineSpecs.length, trialCount: grid.length, indicatorTypes: [...new Set(specs.map(s=>s.id))], selection: 'TRAIN avgR descending, train n>=50; TEST not used for selection' },
  selected, qualified: qualified.length, all: results,
};
const outputPath = SPREAD === 0.2 ? 'analysis/research-1m-expanded-results.json' : `analysis/research-1m-expanded-results-spread-${SPREAD}.json`;
await (await import('node:fs/promises')).writeFile(outputPath, JSON.stringify(output, null, 2));
console.table(selected.map(r=>({strategy:r.strategy,htf:r.htf,stopAtr:r.stopAtr,targetR:r.targetR,trainN:r.train.n,trainAvgR:r.train.avgR,testN:r.test.n,testAvgR:r.test.avgR,testWin:r.test.winPct})));
console.error(`saved ${outputPath}; positive on TRAIN=${qualified.length}; positive on TEST among TRAIN-selected top 25=${selected.filter(r=>r.test.avgR>0).length}/${selected.length}`);
