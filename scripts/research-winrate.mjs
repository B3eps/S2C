// What separates winning from losing Gold signals at a 1R target, and which entry trigger helps.
//   node scripts/research-winrate.mjs 5m
// Rules are picked on TRAIN only; TEST is read once to see whether they hold.
import { data, nyMin } from './backtest-parca.mjs';
import { build } from 'esbuild';
const load = async (p) => { const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
const { GOLD_SETUP_DEFAULTS } = await load('src/lib/parcaVariants.ts');
const ind = await load('src/lib/indicators.ts');
const parca = await load('src/lib/parcaSetup.ts');
const TF = process.argv[2] ?? '5m';
const TFMS = { '1m': 60e3, '5m': 300e3, '15m': 900e3 }[TF];
const SP = Number(process.env.SPREAD ?? 0.2);
const H = 3600e3;

/**
 * One trade. trigger: 'close' buys the signal close; 'break' waits for price to trade `k` ATR
 * beyond the signal candle's extreme within `valid` candles (a stop order: confirmation first).
 * stopMode: 'engine' keeps the engine's stop; 'atr' puts it `stopAtr` ATR from the fill.
 */
function sim(s, { trigger = 'close', k = 0, valid = 3, r = 1, stopMode = 'engine', stopAtr = 1, maxMin = 240 } = {}) {
  const { d, m, i, a } = s; const long = m.side === 'long', w = long ? 1 : -1;
  const sb = d.bars[i];
  let j = d.idx.get(m.t + TFMS) ?? d.m1.findIndex((b) => b.t >= m.t + TFMS);
  if (j < 0) return null;
  let fill;
  if (trigger === 'close') fill = long ? sb.c + SP : sb.c;
  else {
    const lvl = long ? sb.h + k * a : sb.l - k * a; // stop order level (ask for a long)
    const until = m.t + TFMS + valid * TFMS;
    for (; j < d.m1.length && d.m1[j].t < until; j++) {
      const b = d.m1[j];
      if (long ? b.l <= m.stop : b.h + SP >= m.stop) return null; // setup failed before triggering
      if (long ? b.h + SP >= lvl : b.l <= lvl) { fill = long ? Math.max(lvl, b.o + SP) : Math.min(lvl, b.o); break; }
    }
    if (fill === undefined) return null;
  }
  const stop = stopMode === 'engine' ? m.stop : fill - w * stopAtr * a;
  const risk = w * (fill - stop);
  if (!(risk > 0)) return null;
  const target = fill + w * risk * r;
  const end = Math.min(d.m1.length, j + maxMin);
  for (let q = trigger === 'close' ? j : j; q < end; q++) {
    const b = d.m1[q]; const lo = long ? b.l : b.l + SP, hi = long ? b.h : b.h + SP;
    if (q === j && trigger !== 'close') {
      // on the fill minute only the part after the trigger counts: be conservative, stop first
      if (long ? lo <= stop : hi >= stop) return -1;
      continue;
    }
    if (long ? lo <= stop : hi >= stop) return -1;
    if (long ? hi >= target : lo <= target) return r;
  }
  const last = d.m1[end - 1];
  return w * ((long ? last.c : last.c + SP) - fill) / risk;
}

// every engulf signal (EMA filter off so the filter itself is a feature), with features
const sigs = [];
for (const d of data) {
  const c = d.bars.map((b) => b.c);
  const e21 = ind.ema(c, 21), e50 = ind.ema(c, 50);
  const adx = ind.IND_BY_ID.adx.calc(d.bars, { len: 14, adx: 14 }).adx;
  const rsi = ind.IND_BY_ID.rsi.calc(d.bars, { len: 14, ma: 14 }).v;
  const c15 = d.m15.map((b) => b.c), e15 = ind.ema(c15, 50), i15 = new Map(d.m15.map((b, x) => [b.t, x]));
  const atrLong = ind.sma(d.atr, 288);
  for (const m of d.run({ ...GOLD_SETUP_DEFAULTS, ema: 0 }).filter((x) => x.kind === 'signal')) {
    const i = d.bi.get(m.t), a = d.atr[i], b = d.bars[i], p = d.bars[i - 1], w = m.side === 'long' ? 1 : -1;
    const k15 = i15.get(Math.floor((m.t + TFMS) / 900e3) * 900e3 - 900e3);
    // room: distance to the nearest opposing swing extreme of the last 48 candles, in risk units
    let opp = w === 1 ? Infinity : -Infinity;
    for (let x = Math.max(0, i - 48); x < i - 2; x++) { const v = w === 1 ? d.bars[x].h : d.bars[x].l; if (w * (v - b.c) > 0) opp = w === 1 ? Math.min(opp, v) : Math.max(opp, v); }
    const risk = Math.abs(b.c - m.stop);
    const bias3 = [parca.biasAt(m.t + TFMS, d.days, d.h1, d.h4, 3)];
    sigs.push({
      d, m, i, a, set: d.set,
      hour: Math.floor(nyMin(m.t) / 60),
      dow: new Date(m.t - 7 * H).getUTCDay(),
      riskAtr: risk / a,
      body: Math.abs(b.c - b.o) / a,
      wick: (w === 1 ? b.h - b.c : b.c - b.l) / Math.max(1e-9, b.h - b.l),      // share of the range left against the close
      engulfRatio: Math.abs(b.c - b.o) / Math.max(1e-9, Math.abs(p.c - p.o)),
      ext21: w * (b.c - e21[i]) / a,
      slope21: w * (e21[i] - e21[i - 5]) / a,
      e50: w * (b.c - e50[i]) > 0,
      m15: k15 !== undefined && w * (c15[k15] - e15[k15]) > 0,
      adx: adx[i], rsi: w === 1 ? rsi[i] : 100 - rsi[i],
      vol: a / atrLong[i],
      roomR: Number.isFinite(opp) ? Math.abs(opp - b.c) / risk : 9,
      strong: !!m.strong, double: m.source.includes('MSP'), htf: /^(15dk|1sa|4sa) /.test(m.source), ifvg: m.source.includes('iFVG'),
      allAgree: bias3[0] === w,
    });
  }
}
console.error('signals', sigs.length);

const days = { train: 0, test: 0 };
for (const d of data) days[d.set] += (d.to - d.from - 3 * 86400e3) / 86400e3 * 5 / 7;
const summary = (list, opt) => {
  const o = {};
  for (const set of ['train', 'test']) {
    const res = list.filter((s) => s.set === set).map((s) => sim(s, opt)).filter((x) => x !== null);
    const t = res.reduce((x, y) => x + y, 0);
    o[set] = { perDay: +(res.length / days[set]).toFixed(2), win: res.length ? Math.round(100 * res.filter((x) => x > 0).length / res.length) : 0, avgR: res.length ? +(t / res.length).toFixed(3) : 0, n: res.length };
  }
  return o;
};
const row = (name, list, opt = {}) => { const o = summary(list, opt); return { name, 'tr n/day': o.train.perDay, 'tr win%': o.train.win, 'tr avgR': o.train.avgR, 'te n/day': o.test.perDay, 'te win%': o.test.win, 'te avgR': o.test.avgR }; };

// 1) entry trigger and stop at a 1R target
const t1 = [];
t1.push(row('close, engine stop, 1R', sigs));
for (const sa of [0.7, 1, 1.5, 2]) t1.push(row(`close, stop ${sa} ATR, 1R`, sigs, { stopMode: 'atr', stopAtr: sa }));
for (const k of [0, 0.1, 0.25]) for (const v of [1, 3]) t1.push(row(`break +${k} ATR in ${v}, engine stop`, sigs, { trigger: 'break', k, valid: v }));
for (const k of [0, 0.1]) t1.push(row(`break +${k} ATR in 3, stop 1 ATR`, sigs, { trigger: 'break', k, valid: 3, stopMode: 'atr', stopAtr: 1 }));
console.log('\n1) ENTRY TRIGGER / STOP, target 1R'); console.table(t1);

// 2) which features separate winners from losers (TRAIN only), at close + engine stop + 1R
const train = sigs.filter((s) => s.set === 'train');
for (const s of sigs) s.res = sim(s, { r: 1 });
const feats = ['hour', 'riskAtr', 'body', 'wick', 'engulfRatio', 'ext21', 'slope21', 'adx', 'rsi', 'vol', 'roomR'];
const t2 = [];
for (const f of feats) {
  const vals = train.map((s) => s[f]).filter(Number.isFinite).sort((x, y) => x - y);
  const cut = [0.25, 0.5, 0.75].map((q) => vals[Math.floor(q * (vals.length - 1))]);
  const bins = [[-Infinity, cut[0]], [cut[0], cut[1]], [cut[1], cut[2]], [cut[2], Infinity]];
  const cells = bins.map(([lo, hi]) => { const a = train.filter((s) => s[f] >= lo && s[f] < hi && s.res !== null); return a.length ? `${Math.round(100 * a.filter((s) => s.res > 0).length / a.length)}%` : '-'; });
  t2.push({ feature: f, cuts: cut.map((x) => +x.toFixed(2)).join(' / '), 'Q1 win': cells[0], 'Q2 win': cells[1], 'Q3 win': cells[2], 'Q4 win': cells[3] });
}
for (const f of ['strong', 'double', 'htf', 'ifvg', 'e50', 'm15', 'allAgree']) {
  const y = train.filter((s) => s[f] && s.res !== null), n = train.filter((s) => !s[f] && s.res !== null);
  t2.push({ feature: f, cuts: 'true / false', 'Q1 win': `${Math.round(100 * y.filter((s) => s.res > 0).length / y.length)}% (${y.length})`, 'Q2 win': `${Math.round(100 * n.filter((s) => s.res > 0).length / n.length)}% (${n.length})` });
}
console.log('\n2) TRAIN win rate at 1R by feature quartile'); console.table(t2);
export { sigs, sim, row, summary };
