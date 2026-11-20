import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { minute, splits, holdouts, loadSessions } from './data.mjs';
import { detector, variants, adjustAtOpen } from './vwap-sensitivity-rules.mjs';

const memory = 'arastirma-hafizasi/deneyler/';
const lock = JSON.parse(readFileSync(memory + '04-vwap-donusu-kural-kilidi.json', 'utf8'));
for (const [file, sha256] of Object.entries(lock)) {
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), sha256, `Frozen input changed: ${file}`);
}
// Expose private research helpers without changing the byte-for-byte locked runner.
const runner = new URL('./run.mjs', import.meta.url);
const hooks = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    return url === runner.href ? { ...result, source: String(result.source) + '\nexport { play, summarize, entryPrice, markPrice, commission };' } : result;
  },
});
const { prepare, play, summarize, entryPrice, markPrice, commission } = await import(runner);
hooks.deregister();

const periods = {
  development: splits.development,
  validation: splits.validation,
  cross: ['2026-09-07', '2026-11-09', [...holdouts.opening[2], ...holdouts.failed[2]]],
  formerTest: holdouts.vwap,
};
const data = {};
for (const [name, dates] of Object.entries(periods)) data[name] = await loadSessions(dates);
const combined = { sessions: Object.values(data).flatMap(d => d.sessions) };

function auditMove(sessions, run, spread) {
  const byDay = new Map(sessions.map(s => [s.t, s]));
  const rows = [];
  for (const trade of run.trades) {
    const t = trade.openedAt;
    const start = Math.floor(t / (1440 * minute)) * (1440 * minute);
    const bars = byDay.get(start).bars;
    const i = bars.findIndex(b => b.t === t);
    const entryBid = bars[i].o;
    const sign = trade.side === 'long' ? 1 : -1;
    const targetBid = trade.tp - (trade.side === 'short' ? spread : 0);
    const ahead = n => bars[i + n - 1]?.t === t + (n - 1) * minute ? bars.slice(i, i + n) : null;
    const thirty = ahead(30);
    const { reference, atr } = trade.context;
    const row = { t, side: trade.side, entryBid, reference, atr, pnl: trade.pnl, reason: trade.reason, lots: trade.lots,
      targetBeyondReference: sign * (targetBid - reference) > 0,
      reachedWithin30: thirty ? thirty.some(b => sign * ((sign > 0 ? b.h : b.l) - reference) >= 0) : null };
    for (const n of [5, 15, 30]) {
      const future = ahead(n);
      row[`forward${n}`] = future ? sign * (future.at(-1).c - entryBid) / atr : null;
    }
    rows.push(row);
  }
  return rows;
}

function reproduce(period, raw, metrics, sessions, spread) {
  if (period === 'cross') return;
  const prior = JSON.parse(readFileSync(`analysis/research-vwap-${period === 'formerTest' ? 'test' : period}.json`, 'utf8'));
  const saved = prior.results['vwap-reversion'];
  assert.deepEqual({ summary: metrics, trades: raw.trades, daily: raw.daily }, {
    summary: saved.conservative.summary, trades: saved.conservative.trades, daily: saved.conservative.daily,
  });
  for (const path of ['conservative', 'high-first', 'low-first']) {
    assert.deepEqual(play(sessions, path, false, spread).trades, saved[path].trades);
    for (const w of saved[path].windows) {
      for (const row of w.accounts) {
        const slice = sessions.filter(s => s.date >= row.from && s.date <= row.through);
        const account = play(slice, path, true, spread);
        assert.deepEqual([account.status, account.statusDate, account.breaches, account.balance, account.trades.length],
          [row.status, row.statusDate, row.breach, row.balance, row.trades]);
      }
    }
  }
}

const results = {};
const auditLedger = process.argv.includes('--audit-ledger') ? {} : undefined;
let prefixes = 0;
for (const [id, settings] of variants) {
  const spread = settings.spread ?? 0.20;
  const make = () => detector(settings);
  results[id] = {};
  if (auditLedger && id !== 'original') auditLedger[id] = { spread, trades: {} };
  for (const [period, source] of Object.entries({ ...data, combined })) {
    const eligible = source.sessions.filter(s => s.eligible);
    const sessions = eligible.map(s => adjustAtOpen(prepare(s, make), settings.openAdjustment, spread, entryPrice, markPrice));
    if (period === 'development') {
      for (const day of eligible.slice(0, 5)) {
        const all = prepare(day, make).signals;
        for (const cutoff of new Set([...all.keys(), day.t + 600 * minute])) {
          const prefix = prepare({ ...day, bars: day.bars.filter(b => b.t < cutoff) }, make).signals;
          assert.deepEqual([...prefix], [...all].filter(([t]) => t <= cutoff), `${id} ${day.date}`);
          prefixes++;
        }
      }
    }
    const raw = play(sessions, 'conservative', false, spread);
    for (const trade of raw.trades) {
      assert.equal(trade.openedAt, trade.knownAt);
      assert.ok(trade.plannedRisk > 0 && trade.plannedRisk <= 25 + 1e-8);
      if (settings.openAdjustment === 'reference') {
        const expected = markPrice(trade.side, trade.context.reference, spread);
        assert.ok(Math.abs(trade.tp - expected) < 1e-8);
      }
    }
    if (auditLedger?.[id]) auditLedger[id].trades[period] = raw.trades;
    const summary = summarize(raw);
    const metrics = { ...summary, signals: sessions.reduce((n, s) => n + s.signals.size, 0),
      skippedAtOpen: sessions.reduce((n, s) => n + (s.skippedOpenAdjustment ?? 0), 0) };
    results[id][period] = { ...metrics, daily: raw.daily };
    if (id === 'original') {
      if (period !== 'combined') reproduce(period, raw, summary, sessions, spread);
      results[id][period].movements = auditMove(sessions, raw, spread);
      results[id][period].trades = raw.trades;
      results[id][period].fixedFillCost = Object.fromEntries([0.4, 0.6].map(wider => {
        // On a fixed trade ledger, one of entry/exit moves by the added spread.
        const extraCost = raw.trades.reduce((sum, t) => sum + (wider - spread) * t.lots * 100 * (1 + commission / 100), 0);
        return [wider, { extraCost, counterfactualNet: summary.net - extraCost }];
      }));
    }
  }
}
for (const period of Object.keys(data)) {
  assert.deepEqual(results['inner-0.75'][period].daily, results.original[period].daily);
  assert.equal(results['inner-0.75'][period].signals, results.original[period].signals);
}
const input = Object.fromEntries(Object.entries(data).map(([name, d]) =>
  [name, { from: d.start, to: d.end, hash: d.hash, eligible: d.sessions.filter(s => s.eligible).length, excluded: d.excluded }]));
writeFileSync('analysis/research-vwap-sensitivity.json', JSON.stringify({ input, prefixes, results }) + '\n');
console.log(`${variants.length} configurations, ${prefixes} timestamp-prefix checks, archived VWAP ledgers reproduced`);

if (auditLedger) writeFileSync('.cache/research-vwap-sensitivity-trades.json', JSON.stringify({ input, variants: auditLedger }));

if (process.argv.includes('--chart-data')) {
  const old = results.original.formerTest.trades;
  const examples = [old.find(t => t.pnl > 0), old.find(t => t.pnl < 0)];
  const panels = examples.map(trade => ({
    trade, bars: data.formerTest.sessions.find(s => s.bars.some(b => b.t === trade.openedAt)).bars,
  }));
  writeFileSync('analysis/research-vwap-chart-data.json', JSON.stringify(panels) + '\n');
}
