import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, day, minute, splits, holdouts, loadSessions } from './data.mjs';
import { kinds, scanBehavior, evaluatePath } from './m1-behavior-rules.mjs';

const costs = [0.20, 0.50, 0.65];
const reference = process.argv.includes('--hourly') ? 'hourly' : 'session';
const periods = { ...splits, seen: ['2026-09-07', '2026-11-19', [...holdouts.opening[2], ...holdouts.failed[2]]] };
const mean = list => list.length ? list.reduce((s, x) => s + x, 0) / list.length : null;

function resample(data) {
  const groups = new Map();
  for (const { date, value } of data) {
    const old = groups.get(date) ?? { sum: 0, n: 0 };
    old.sum += value; old.n++;
    groups.set(date, old);
  }
  const days = [...groups.values()];
  if (days.length < 2) return null;
  const draws = [];
  let rng = 20261119;
  for (let i = 0; i < 4000; i++) {
    let sum = 0, n = 0;
    for (const _ of days) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const picked = days[Math.floor(rng / 2 ** 32 * days.length)];
      sum += picked.sum; n += picked.n;
    }
    draws.push(sum / n);
  }
  draws.sort((a, b) => a - b);
  return [draws[99], draws[3899]];
}

function stats(events, horizon, spread) {
  const measured = events.flatMap(e => {
    const sample = e.paths[spread]?.[horizon];
    return sample ? [{ date: e.date, atr: e.atr, ...sample }] : [];
  });
  const wins = measured.filter(x => x.net > 0), losses = measured.filter(x => x.net < 0);
  const totals = new Map();
  const barriers = { up: 0, down: 0, both: 0, neither: 0 };
  for (const row of measured) {
    totals.set(row.date, (totals.get(row.date) ?? 0) + row.net);
    barriers[row.firstBarrier]++;
  }
  const net = measured.reduce((s, e) => s + e.net, 0);
  const topDay = Math.max(0, ...totals.values());
  let bank = 0, peak = 0, dailyDrawdown = 0;
  for (const value of totals.values()) {
    bank += value;
    peak = Math.max(peak, bank);
    dailyDrawdown = Math.max(dailyDrawdown, peak - bank);
  }
  return { n: measured.length, missing: events.length - measured.length, days: totals.size, net,
    average: mean(measured.map(x => x.net)), ci: resample(measured.map(r => ({ date: r.date, value: r.net }))),
    grossBid: mean(measured.map(x => x.grossBid)), wins: wins.length, losses: losses.length,
    averageWin: mean(wins.map(x => x.net)), averageLoss: mean(losses.map(x => x.net)),
    averageMfe: mean(measured.map(x => x.mfe)), averageMae: mean(measured.map(x => x.mae)),
    barriers, lossSawProfitThreshold: losses.filter(x => x.mfe >= x.atr).length,
    lossesWithPositiveBidMove: losses.filter(x => x.grossBid > 0).length,
    adverseFirstAmongLosses: losses.filter(x => x.firstBarrier === 'down').length,
    recoveries: measured.filter(x => x.favorableAfterAdverse).length,
    recoveriesEndingPositive: wins.filter(x => x.favorableAfterAdverse).length,
    positiveDays: [...totals.values()].filter(x => x > 0).length,
    averageSignalDay: mean([...totals.values()]), dailyDrawdown,
    topDay, withoutTopDay: net - topDay };
}

function compatible(a, b, mode) {
  if (a.side !== b.side || a.londonHour !== b.londonHour || Math.abs(a.offset - b.offset) > 90 * minute) return false;
  const ratio = b.atr / a.atr;
  if (ratio < 0.67 || ratio > 1.50) return false;
  if (mode === 'fib') return Math.abs(a.impulseMinutes - b.impulseMinutes) <= 15 &&
    Math.abs(a.impulseATR - b.impulseATR) <= 2 && a.originAt !== b.originAt;
  return Math.abs(Math.abs(a.wickDist) - Math.abs(b.wickDist)) <= 0.12 &&
    Math.abs(a.closeDist - b.closeDist) <= 0.25 && (mode === 'ordinary' || Math.abs(a.body - b.body) <= 0.35);
}

function match(rows, first, second, mode) {
  const available = rows.filter(b => b.kind === second);
  const used = new Set();
  const pairs = [];
  for (const a of rows.filter(b => b.kind === first)) {
    const rank = b => Math.abs(a.offset - b.offset) / (90 * minute) + Math.abs(Math.log(b.atr / a.atr)) +
      (mode === 'fib' ? Math.abs(a.impulseATR - b.impulseATR) / 2 :
        Math.abs(a.closeDist - b.closeDist) + Math.abs(Math.abs(a.wickDist) - Math.abs(b.wickDist)));
    const b = available.filter(x => !used.has(x.id) && compatible(a, x, mode))
      .sort((x, y) => rank(x) - rank(y) || x.t - y.t)[0];
    if (b) {
      used.add(b.id);
      pairs.push({ a, b });
    }
  }
  const summary = Object.fromEntries(costs.map(spread => {
    const values = pairs.flatMap(({ a, b }) => {
      const x = a.paths[spread]?.[15]?.net, y = b.paths[spread]?.[15]?.net;
      return x !== undefined && y !== undefined ? [{ date: a.date, value: x - y, x, y }] : [];
    });
    return [spread, { n: values.length, average: mean(values.map(x => x.value)), ci: resample(values),
      first: mean(values.map(x => x.x)), second: mean(values.map(x => x.y)) }];
  }));
  return { available: available.length, pairs: pairs.map(({ a, b }) => [a.id, b.id]), summary };
}

const data = {};
let prefixChecks = 0;
for (const [period, dates] of Object.entries(periods)) {
  const loaded = await loadSessions(dates);
  const rows = [], coverage = [];
  for (const session of loaded.sessions) {
    if (!session.eligible) { coverage.push({ date: session.date, use: false, reason: 'session-coverage' }); continue; }
    const t = session.t;
    const raw = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(t), to: new Date(t + day) },
      timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: cache });
    const bars = raw.map(({ timestamp: t, open: o, high: h, low: l, close: c, volume: v }) => ({ t, o, h, l, c, v }));
    const byTime = new Map(bars.map(b => [b.t, b]));
    const scan = scanBehavior(bars, t, reference);
    if (reference === 'session' && !scan.range) {
      coverage.push({ date: session.date, use: false, reason: 'reference-coverage' }); continue;
    }
    if (coverage.filter(x => x.use).length < 6) {
      for (const offset of [480, 600, 780, 955]) {
        const cutoff = t + offset * minute;
        assert.deepEqual(scanBehavior(bars.filter(b => b.t < cutoff), t, reference).events, scan.events.filter(x => x.t <= cutoff));
        prefixChecks++;
      }
    }
    coverage.push({ date: session.date, use: true, range: scan.range, events: scan.events.length,
      hours: scan.hours, diagnostics: scan.diagnostics });
    for (const event of scan.events) {
      assert.equal(event.t, event.signalAt + minute);
      if (event.knownAt !== undefined) assert.ok(event.knownAt <= event.signalAt);
      rows.push({ ...event, id: `${event.kind}:${event.side}:${event.t}`, date: session.date,
        paths: Object.fromEntries(costs.map(spread => [spread, evaluatePath(event, byTime, spread)])) });
    }
  }
  const variants = Object.fromEntries(kinds.map(kind => {
    const events = rows.filter(r => r.kind === kind);
    const metrics = Object.fromEntries(costs.map(spread => [spread,
      Object.fromEntries([5, 15, 30].map(horizon => [horizon, stats(events, horizon, spread)]))]));
    return [kind, { signals: events.length, metrics }];
  }));
  const pairs = {
    'sweep-near': match(rows, 'sweep', 'near-turn', 'near'),
    'sweep-ordinary': match(rows, 'sweep', 'ordinary', 'ordinary'),
    'fib-depth': match(rows, 'fib-deep', 'fib-shallow', 'fib'),
  };
  data[period] = { dates, sourceHash: loaded.hash, coverage, variants, pairs, rows };
  for (const [kind, { metrics }] of Object.entries(variants)) {
    const s = metrics[0.50][15];
    console.log(period, kind, s.n, s.days, s.average?.toFixed(3), s.ci?.map(n => n.toFixed(3)).join(' / '));
  }
}

const gates = {};
for (const kind of kinds.filter(x => x !== 'ordinary')) {
  const reasons = [];
  for (const period of ['development', 'validation']) {
    const { metrics } = data[period].variants[kind];
    const nominal = metrics[0.50][15], stress = metrics[0.65][15];
    if (nominal.n < 40 || nominal.days < 20) reasons.push(`${period}: sample`);
    if (!(nominal.ci?.[0] > 0)) reasons.push(`${period}: net interval`);
    if (!(stress.average > 0)) reasons.push(`${period}: stressed costs`);
  }
  const comparison = kind === 'sweep' ? 'sweep-near' : kind === 'fib-deep' ? 'fib-depth' : null;
  if (comparison) {
    const result = data.validation.pairs[comparison].summary[0.50];
    if (result.n < 20 || !(result.average >= 0.15) || !(result.ci?.[0] > 0)) reasons.push('validation: matched advantage');
  }
  gates[kind] = { pass: reasons.length === 0, reasons };
}
console.log('Gates', gates);
const output = reference === 'hourly' ? 'analysis/research-m1-behavior-hourly.json' : 'analysis/research-m1-behavior.json';
writeFileSync(output, JSON.stringify({ reference, prefixChecks, data, gates }) + '\n');
