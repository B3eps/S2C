// Fits the Parça Gold probability model: logistic regression on causal features of each engulf
// signal, target = 1R reached before the stop. Fitted on TRAIN periods only; TEST periods are
// scored once with the frozen weights to check calibration and hit rate.
//   node scripts/fit-gold-model.mjs 5m
import { sigs, sim } from './research-winrate.mjs';

// the features the engine can compute from closed candles; must match src/lib/parcaModel.ts
const FEATS = [
  ['adx', (s) => s.adx],
  ['vol', (s) => Math.min(s.vol, 2.5)],
  ['slope21', (s) => Math.max(-1, Math.min(1.5, s.slope21))],
  ['ext21', (s) => Math.max(-1, Math.min(4, s.ext21))],
  ['rsi', (s) => s.rsi],
  ['engulfLog', (s) => Math.log(Math.max(0.2, Math.min(10, s.engulfRatio)))],
  ['riskAtr', (s) => Math.min(6, s.riskAtr)],
  ['room', (s) => Math.min(3, s.roomR)],
  ['m15', (s) => (s.m15 ? 1 : 0)],
  ['htf', (s) => (s.htf ? 1 : 0)],
];
for (const s of sigs) s.y = sim(s, { r: 1 });
const rows = sigs.filter((s) => s.y !== null && FEATS.every(([, f]) => Number.isFinite(f(s))));
const train = rows.filter((s) => s.set === 'train'), test = rows.filter((s) => s.set === 'test');
const X = (s) => FEATS.map(([, f]) => f(s));
// standardise with TRAIN statistics only
const mu = FEATS.map((_, j) => train.reduce((a, s) => a + X(s)[j], 0) / train.length);
const sd = FEATS.map((_, j) => Math.sqrt(train.reduce((a, s) => a + (X(s)[j] - mu[j]) ** 2, 0) / train.length) || 1);
const z = (s) => X(s).map((v, j) => (v - mu[j]) / sd[j]);
const sig = (x) => 1 / (1 + Math.exp(-x));

// L2-regularised logistic regression by gradient descent
const lambda = Number(process.env.L2 ?? 0.05);
let w = new Array(FEATS.length).fill(0), b = 0;
const Z = train.map(z), Y = train.map((s) => (s.y > 0 ? 1 : 0));
for (let it = 0; it < 4000; it++) {
  const gw = new Array(FEATS.length).fill(0); let gb = 0;
  for (let n = 0; n < Z.length; n++) {
    const e = sig(b + Z[n].reduce((a, v, j) => a + v * w[j], 0)) - Y[n];
    gb += e; for (let j = 0; j < w.length; j++) gw[j] += e * Z[n][j];
  }
  b -= 0.1 * gb / Z.length;
  for (let j = 0; j < w.length; j++) w[j] -= 0.1 * (gw[j] / Z.length + lambda * w[j]);
}
const p = (s) => sig(b + z(s).reduce((a, v, j) => a + v * w[j], 0));

console.log('weights (per 1 sd):', Object.fromEntries(FEATS.map(([n], j) => [n, +w[j].toFixed(3)])), 'bias', +b.toFixed(3));
const days = { train: 0, test: 0 };
const { data } = await import('./backtest-parca.mjs');
for (const d of data) days[d.set] += (d.to - d.from - 3 * 86400e3) / 86400e3 * 5 / 7;
const table = [];
for (const th of [0, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75]) {
  const r = {};
  for (const [set, list] of [['train', train], ['test', test]]) {
    const a = list.filter((s) => p(s) >= th);
    const t = a.reduce((x, s) => x + s.y, 0);
    r[set] = [a.length / days[set], a.length ? 100 * a.filter((s) => s.y > 0).length / a.length : 0, a.length ? t / a.length : 0, a.length ? 100 * a.reduce((x, s) => x + p(s), 0) / a.length : 0];
  }
  table.push({ 'P >=': th, 'tr n/day': +r.train[0].toFixed(2), 'tr win%': Math.round(r.train[1]), 'tr avgR': +r.train[2].toFixed(3), 'te n/day': +r.test[0].toFixed(2), 'te win%': Math.round(r.test[1]), 'te predicted%': Math.round(r.test[3]), 'te avgR': +r.test[2].toFixed(3) });
}
console.table(table);
// calibration on TEST: predicted vs real by probability band
const cal = [];
for (const [lo, hi] of [[0, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 1]]) {
  const a = test.filter((s) => p(s) >= lo && p(s) < hi);
  cal.push({ band: `${lo}-${hi}`, n: a.length, predicted: a.length ? Math.round(100 * a.reduce((x, s) => x + p(s), 0) / a.length) : '-', real: a.length ? Math.round(100 * a.filter((s) => s.y > 0).length / a.length) : '-' });
}
console.log('TEST calibration'); console.table(cal);
console.log('MODEL', JSON.stringify({ feats: FEATS.map(([n]) => n), mu: mu.map((x) => +x.toFixed(5)), sd: sd.map((x) => +x.toFixed(5)), w: w.map((x) => +x.toFixed(5)), b: +b.toFixed(5) }));
