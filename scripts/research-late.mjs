// Why Gold signals come late: measure how far the move had already gone at entry, then test filters.
//   node scripts/research-late.mjs 5m
import { data, trade, nyMin } from './backtest-parca.mjs';
import { build } from 'esbuild';
const load = async (p) => { const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
const { GOLD_SETUP_DEFAULTS } = await load('src/lib/parcaVariants.ts');
const ind = await load('src/lib/indicators.ts');
const TF = process.argv[2] ?? '5m';
const TFMS = { '1m': 60e3, '5m': 300e3, '15m': 900e3 }[TF];

// features of every Gold signal
const sigs = [];
for (const d of data) {
  const c = d.bars.map((b) => b.c);
  const e9 = ind.ema(c, 9), e21 = ind.ema(c, 21), e50 = ind.ema(c, 50), e200 = ind.ema(c, 200);
  const c15 = d.m15.map((b) => b.c), e15 = ind.ema(c15, 50), rsi = ind.IND_BY_ID.rsi.calc(d.bars, { len: 14, ma: 14 }).v;
  const i15 = new Map(d.m15.map((b, i) => [b.t, i]));
  let dayKey = '', dayN = 0;
  for (const m of d.run(GOLD_SETUP_DEFAULTS).filter((x) => x.kind === 'signal')) {
    const i = d.bi.get(m.t), a = d.atr[i], b = d.bars[i], w = m.side === 'long' ? 1 : -1;
    let lo = Infinity, hi = -Infinity;
    for (let k = Math.max(0, i - 12); k <= i; k++) { lo = Math.min(lo, d.bars[k].l); hi = Math.max(hi, d.bars[k].h); }
    const k15 = i15.get(Math.floor((m.t + TFMS) / 900e3) * 900e3 - 900e3);
    const dk = new Date(m.t - 7 * 3600e3).toISOString().slice(0, 10);
    if (dk !== dayKey) { dayKey = dk; dayN = 0; }
    dayN++;
    sigs.push({
      d, m, set: d.set, nth: dayN,
      run: (w === 1 ? b.c - lo : hi - b.c) / a,            // move already made in the last 12 candles, ATR
      ext21: w * (b.c - e21[i]) / a,                        // distance beyond EMA21, ATR
      body: Math.abs(b.c - b.o) / a,                        // size of the signal candle, ATR
      risk: Math.abs(b.c - m.stop) / a,
      emaStack: w * Math.sign(e9[i] - e21[i]) > 0 && w * Math.sign(e21[i] - e50[i]) > 0,
      above50: w * (b.c - e50[i]) > 0,
      above200: w * (b.c - e200[i]) > 0,
      ema15: k15 !== undefined && w * (c15[k15] - e15[k15]) > 0,
      slope21: w * (e21[i] - e21[i - 5]) > 0,
      rsi: w === 1 ? rsi[i] : 100 - rsi[i],
      pullback: (() => { for (let k = i - 1; k >= Math.max(0, i - 6); k--) if (w * (d.bars[k].l * (w === 1) + d.bars[k].h * (w === -1) - e21[k]) <= 0) return true; return false; })(),
      ny: nyMin(m.t),
    });
  }
}
const res = (s, r = 2) => trade(s.d, s.m.t, s.m.side, s.m.stop, r);
for (const s of sigs) s.r2 = res(s);
const days = { train: 0, test: 0 };
for (const d of data) days[d.set] += (d.to - d.from - 3 * 86400e3) / 86400e3 * 5 / 7;
const stat = (list, set) => { const a = list.filter((s) => s.set === set && s.r2 !== null); const t = a.reduce((x, s) => x + s.r2, 0); return [a.length / days[set], a.length ? 100 * a.filter((s) => s.r2 > 0).length / a.length : 0, a.length ? t / a.length : 0, t]; };
const rows = [];
const add = (name, f) => { const l = sigs.filter(f); const [tn, tw, ta, tt] = stat(l, 'train'); const [sn, sw, sa, stt] = stat(l, 'test'); rows.push({ name, 'tr/day': +tn.toFixed(1), 'tr win': Math.round(tw), 'tr avgR': +ta.toFixed(3), 'te/day': +sn.toFixed(1), 'te win': Math.round(sw), 'te avgR': +sa.toFixed(3), 'te totalR': +stt.toFixed(1) }); };

add('ALL Gold signals', () => true);
// lateness buckets
for (const [lo, hi] of [[0, 1.5], [1.5, 2.5], [2.5, 4], [4, 99]]) add(`run ${lo}-${hi} ATR`, (s) => s.run >= lo && s.run < hi);
for (const [lo, hi] of [[-9, 0.5], [0.5, 1.5], [1.5, 3], [3, 99]]) add(`beyond EMA21 ${lo}-${hi} ATR`, (s) => s.ext21 >= lo && s.ext21 < hi);
for (const [lo, hi] of [[0, 0.8], [0.8, 1.5], [1.5, 99]]) add(`candle body ${lo}-${hi} ATR`, (s) => s.body >= lo && s.body < hi);
for (const [lo, hi] of [[0, 50], [50, 65], [65, 75], [75, 101]]) add(`RSI(trade side) ${lo}-${hi}`, (s) => s.rsi >= lo && s.rsi < hi);
// EMA confirmations
add('EMA 9>21>50 stacked', (s) => s.emaStack);
add('beyond EMA50', (s) => s.above50);
add('beyond EMA200', (s) => s.above200);
add('15m close beyond 15m EMA50', (s) => s.ema15);
add('EMA21 sloping our way', (s) => s.slope21);
add('pulled back to EMA21 in last 6', (s) => s.pullback);
add('strong (★) only', (s) => s.m.strong);
add('first 2 of the day', (s) => s.nth <= 2);
// combos
add('not late: run<2.5 & ext21<1.5', (s) => s.run < 2.5 && s.ext21 < 1.5);
add('not late + EMA21 slope', (s) => s.run < 2.5 && s.ext21 < 1.5 && s.slope21);
add('not late + 15m EMA50', (s) => s.run < 2.5 && s.ext21 < 1.5 && s.ema15);
add('not late + EMA50', (s) => s.run < 2.5 && s.ext21 < 1.5 && s.above50);
add('pullback + EMA21 slope', (s) => s.pullback && s.slope21);
add('pullback + 15m EMA50', (s) => s.pullback && s.ema15);
add('pullback + slope + 15m', (s) => s.pullback && s.slope21 && s.ema15);
add('pullback + slope + not late', (s) => s.pullback && s.slope21 && s.run < 2.5);
add('RSI<65 + slope', (s) => s.rsi < 65 && s.slope21);
add('RSI<65 + 15m EMA50', (s) => s.rsi < 65 && s.ema15);
add('slope + 15m EMA50', (s) => s.slope21 && s.ema15);
add('slope + 15m + EMA50', (s) => s.slope21 && s.ema15 && s.above50);
add('slope + 15m + RSI<75', (s) => s.slope21 && s.ema15 && s.rsi < 75);
add('slope + stacked', (s) => s.slope21 && s.emaStack);
add('slope + stacked + 15m', (s) => s.slope21 && s.emaStack && s.ema15);
for (const s of sigs) s.r15 = res(s, 1.5), s.r3 = res(s, 3);
const rr = (k, f) => { const o = {}; for (const set of ['train','test']) { const a = sigs.filter((x) => x.set === set && f(x) && x[k] !== null); o[set] = (a.reduce((p, x) => p + x[k], 0) / a.length).toFixed(3); } return o; };
console.log('slope+15m at 1.5R', rr('r15', (s) => s.slope21 && s.ema15), 'at 3R', rr('r3', (s) => s.slope21 && s.ema15));
const quick = (f) => { const a = sigs.filter((x) => f(x) && x.r2 === -1); return a.length; };
console.table(rows.slice(-6).concat(rows.slice(0,1)));

// ── entry improvement: instead of buying the close, wait for a pullback into the signal candle ──
const SP = Number(process.env.SPREAD ?? 0.2);
function limitTrade(s, frac, validBars, rMult = 2, maxMin = 240) {
  const { d, m } = s; const long = m.side === 'long';
  const close = d.bars[d.bi.get(m.t)].c;
  const L = long ? close - (close - m.stop) * frac : close + (m.stop - close) * frac; // price for the order
  let j = d.idx.get(m.t + TFMS) ?? d.m1.findIndex((b) => b.t >= m.t + TFMS);
  if (j < 0) return null;
  const until = m.t + TFMS + validBars * TFMS;
  const target = long ? L + (L - m.stop) * rMult : L - (m.stop - L) * rMult;
  for (; j < d.m1.length && d.m1[j].t < until; j++) {
    const b = d.m1[j];
    // the target reached before the fill: the move left without us
    if (long ? b.h >= target : b.l + SP <= target) return null;
    if (long ? b.l + SP <= L : b.h >= L) break;
  }
  if (j >= d.m1.length || d.m1[j].t >= until) return null;
  const fillBar = d.m1[j];
  const risk = Math.abs(L - m.stop);
  // same minute: the stop counts if it was touched too
  if (long ? fillBar.l <= m.stop : fillBar.h + SP >= m.stop) return -1;
  const end = Math.min(d.m1.length, j + maxMin);
  for (let k = j + 1; k < end; k++) {
    const b = d.m1[k]; const lo = long ? b.l : b.l + SP, hi = long ? b.h : b.h + SP;
    if (long ? lo <= m.stop : hi >= m.stop) return -1;
    if (long ? hi >= target : lo <= target) return rMult;
  }
  const last = d.m1[end - 1];
  return (long ? last.c - L : L - (last.c + SP)) / risk;
}
const rows2 = [];
const addL = (name, f, frac, valid, r = 2) => {
  const out = {};
  for (const set of ['train', 'test']) {
    const l = sigs.filter((s) => s.set === set && f(s));
    const res = l.map((s) => limitTrade(s, frac, valid, r)).filter((x) => x !== null);
    const t = res.reduce((a, b) => a + b, 0);
    out[set] = [res.length / days[set], res.length ? 100 * res.filter((x) => x > 0).length / res.length : 0, res.length ? t / res.length : 0, l.length ? 100 * res.length / l.length : 0, t];
  }
  rows2.push({ name, frac, valid, r, 'tr/day': +out.train[0].toFixed(1), 'tr win': Math.round(out.train[1]), 'tr avgR': +out.train[2].toFixed(3), 'te/day': +out.test[0].toFixed(1), 'te win': Math.round(out.test[1]), 'te avgR': +out.test[2].toFixed(3), 'te fill%': Math.round(out.test[3]), 'te totalR': +out.test[4].toFixed(1) });
};
for (const f of [0.25, 0.4, 0.5, 0.6]) for (const v of [3, 6]) addL('all', () => true, f, v);
for (const f of [0.4, 0.5]) for (const r of [1.5, 2, 3]) addL('EMA21 slope', (s) => s.slope21, f, 6, r);
addL('slope + 15m EMA50', (s) => s.slope21 && s.ema15, 0.5, 6);
addL('slope + stacked', (s) => s.slope21 && s.emaStack, 0.5, 6);

