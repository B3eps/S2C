import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, day, minute, splits, holdouts, loadSessions } from './data.mjs';
import { scanSession, scheduleEntries, variants } from './parca-m1-rules.mjs';

const root = 'arastirma-hafizasi/deneyler/';
const frozenSpec = root + '10-parca-m1-kural-kilidi.json';
const shared = ['scripts/research/run.mjs', 'scripts/research/data.mjs', 'scripts/research/s2c.ts',
  'src/lib/execution.ts', 'src/lib/programs.ts', 'src/lib/types.ts', 'src/lib/accountRules.ts'];
const own = ['scripts/research/run-parca-m1.mjs', 'scripts/research/parca-m1-rules.mjs', root + '10-parca-m1-protokol.md'];
const fingerprint = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const lock = JSON.parse(readFileSync(root + '03-basarisiz-kirilim-kural-kilidi.json', 'utf8'));
for (const file of shared) assert.equal(fingerprint(file), lock[file], file);
const fingerprints = Object.fromEntries([...shared, ...own].map(file => [file, fingerprint(file)]));
const forwardPeriod = ['2026-11-20', '2027-02-01', []];
const command = process.argv[2] ?? 'historical';
if (command === 'freeze') {
  writeFileSync(frozenSpec, JSON.stringify({ forwardPeriod, primary: 'fvg-retest', fingerprints }, null, 2) + '\n', { flag: 'wx' });
  process.exit(0);
}
assert.ok(command === 'historical' || command === 'forward', 'Expected historical, freeze, or forward');
if (command === 'forward') {
  const frozen = JSON.parse(readFileSync(frozenSpec, 'utf8'));
  assert.deepEqual(frozen.fingerprints, fingerprints, 'Frozen inputs changed');
  assert.deepEqual(frozen.forwardPeriod, forwardPeriod);
  assert.ok(Date.now() >= Date.parse(forwardPeriod[1]), 'Forward window has not closed');
}
// Use exactly the previously vetted S2C execution core without changing frozen historical scripts.
const base = new URL('./run.mjs', import.meta.url);
const hook = registerHooks({ load(url, context, nextLoad) {
  const r = nextLoad(url, context);
  return url === base.href ? { ...r, source: String(r.source) + '\nexport { play, summarize, DEFAULT_SPREAD, rules };' } : r;
} });
const { play, summarize, DEFAULT_SPREAD, rules } = await import(base);
hook.deregister();

const periods = command === 'forward' ? { forward: forwardPeriod } :
  { ...splits, seen: ['2026-09-07', '2026-11-19', [...holdouts.opening[2], ...holdouts.failed[2]]] };

async function fullBars(session) {
  const t = session.t;
  // loadSessions checked the same cache payload and fingerprint. Read early-day M1
  // for context only; strategy execution remains on its validated session.bars.
  const rows = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(t), to: new Date(t + day) },
    timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: cache });
  let previous = -Infinity;
  return rows.map(({ timestamp: t, open: o, high: h, low: l, close: c, volume: v }) => {
    assert.ok(t > previous && t % minute === 0 && h >= Math.max(o, c) && l <= Math.min(o, c));
    previous = t;
    return { t, o, h, l, c, v };
  });
}

function accounts(sessions, spread) {
  return [5, 20].map(length => {
    const results = [];
    for (let i = 0; i + length <= sessions.length; i += length) {
      const group = sessions.slice(i, i + length);
      const r = play(group, 'conservative', true, spread);
      results.push({ from: group[0].date, through: group.at(-1).date, status: r.status, type: r.breaches,
        statusDate: r.statusDate, balance: r.balance, trades: r.trades.length });
    }
    return { length, remainder: sessions.length % length, results };
  });
}

function lossReview(trades, cached) {
  const sessionsByEntry = new Map(cached.map(({ session }) => [session.t, session]));
  const memo = [];
  for (const t of trades.filter(t => t.pnl < 0)) {
    const start = Math.floor(t.openedAt / day) * day;
    const bars = sessionsByEntry.get(start).bars;
    const exitBar = bars.findIndex(b => b.t === t.closedAt - minute);
    const path = t.reason === 'sl' && exitBar >= 0 ? bars.slice(exitBar + 1, exitBar + 31) : [];
    const sign = t.side === 'long' ? 1 : -1;
    const target = t.context.targetBid;
    const subsequent = path.findIndex((b, i) => path.slice(0, i + 1).every((p, j) => p.t === t.closedAt + j * minute) &&
      sign * ((sign > 0 ? b.h : b.l) - target) >= 0);
    memo.push({ openedAt: t.openedAt, side: t.side, reason: t.reason, pnl: t.pnl,
      reachedTargetAfterStop: subsequent >= 0 ? subsequent + 1 : path.length === 30 &&
        path.at(-1).t === t.closedAt + 29 * minute ? false : null });
  }
  return memo;
}

let prefixChecks = 0;
const rawOutput = {};
for (const [period, dates] of Object.entries(periods)) {
  const data = await loadSessions(dates);
  const cached = [];
  for (const session of data.sessions.filter(s => s.eligible)) {
    const bars = await fullBars(session);
    const scan = scanSession(bars, session.t);
    for (const e of scan.events) {
      assert.ok(e.breakoutKnownAt <= e.setupAt - minute && (e.targetKnownAt === undefined || e.targetKnownAt <= e.setupAt));
      assert.equal(e.m15Dir, e.side);
    }
    if (command === 'historical' && cached.length < 3) {
      for (const cutoff of [session.t + 600 * minute, session.t + 720 * minute, session.t + 900 * minute]) {
        const prefix = scanSession(bars.filter(b => b.t < cutoff), session.t);
        assert.deepEqual(prefix.events, scan.events.filter(e => e.setupAt <= cutoff));
        for (const variant of variants) {
          const full = scheduleEntries(session, scan, variant, DEFAULT_SPREAD, rules.commissionPct).signals;
          const truncated = scheduleEntries({ ...session, bars: session.bars.filter(b => b.t <= cutoff) },
            prefix, variant, DEFAULT_SPREAD, rules.commissionPct).signals;
          assert.deepEqual([...truncated], [...full].filter(([stamp]) => stamp <= cutoff));
          prefixChecks++;
        }
      }
    }
    cached.push({ session, scan });
  }
  const outputs = {};
  for (const variant of variants) {
    const prepare = spread => cached.map(({ session, scan }) => scheduleEntries(session, scan, variant, spread, rules.commissionPct));
    const sessions = prepare(DEFAULT_SPREAD);
    const nominal = play(sessions, 'conservative', false, DEFAULT_SPREAD);
    for (const t of nominal.trades) {
      assert.equal(t.openedAt, t.knownAt);
      assert.ok(Math.abs(t.tp - (t.context.targetBid + (t.side === 'short' ? DEFAULT_SPREAD : 0))) < 1e-8);
    }
    const paths = Object.fromEntries(['high-first', 'low-first'].map(name => [name, summarize(play(sessions, name, false, DEFAULT_SPREAD))]));
    const stressed = summarize(play(prepare(0.50), 'conservative', false, 0.50));
    outputs[variant] = { summary: summarize(nominal), paths, stressed,
      counts: Object.fromEntries(Object.keys(sessions[0]?.counts ?? {}).map(key => [key, sessions.reduce((n, s) => n + s.counts[key], 0)])),
      accounts: accounts(sessions, DEFAULT_SPREAD), daily: nominal.daily, trades: nominal.trades,
      losses: lossReview(nominal.trades, cached) };
    const s = outputs[variant].summary;
    console.log(period, variant, s.n, s.net.toFixed(2), s.expectancy?.toFixed(2));
  }
  rawOutput[period] = { period: dates, hash: data.hash,
    coverage: data.sessions.map(({ date, missing, eligible }) => ({ date, missing, eligible })), outputs };
}
writeFileSync(`analysis/research-parca-m1-${command}.json`, JSON.stringify({ command, prefixChecks, rules, rawOutput }) + '\n');
