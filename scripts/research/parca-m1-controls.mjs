import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, day, minute, loadSessions } from './data.mjs';
import { scanSession, scheduleEntries } from './parca-m1-rules.mjs';
import { h1Targets, sweepDisplacementRetests, completedUtcDay, dailyReactions } from './parca-m1-liquidity-sequence.mjs';

const archive = JSON.parse(readFileSync('analysis/research-parca-m1-historical.json', 'utf8'));
const lock = JSON.parse(readFileSync('arastirma-hafizasi/deneyler/10-parca-m1-kural-kilidi.json', 'utf8'));
for (const [file, expected] of Object.entries(lock.fingerprints)) {
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, file);
}
const runner = new URL('./run.mjs', import.meta.url);
const hook = registerHooks({ load(url, context, nextLoad) {
  const r = nextLoad(url, context);
  return url === runner.href ? { ...r, source: String(r.source) + '\nexport { play, summarize, DEFAULT_SPREAD, rules };' } : r;
} });
const { play, summarize, DEFAULT_SPREAD: spread, rules } = await import(runner);
hook.deregister();
const bundle = await build({ entryPoints: ['scripts/research/s2c.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { conservativeCandle, entryPrice, markPrice, tradePnl } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const commission = rules.commissionPct;

async function quotes(session) {
  const raw = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(session.t), to: new Date(session.t + day) },
    timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: cache });
  return raw.map(({ timestamp: t, open: o, high: h, low: l, close: c, volume: v }) => ({ t, o, h, l, c, v }));
}

function decorate(bars, scan) {
  const width = 5 * minute;
  const byStamp = new Map();
  const opposingBySignal = new Map();
  const events = new Map(scan.events.map(e => [e.setupAt, e]));
  const tagged = [];
  let previous, bucket, priorBuckets = [], zones = [], ranges = [];
  for (const b of bars) {
    if (previous && b.t - previous.t !== minute) {
      bucket = previous = undefined;
      priorBuckets = []; zones = []; ranges = [];
    }
    if (ranges.length === 20) byStamp.set(b.t, ranges.reduce((sum, r) => sum + r, 0) / 20);
    const prior = previous?.c ?? b.o;
    ranges.push(Math.max(b.h - b.l, Math.abs(b.h - prior), Math.abs(b.l - prior)));
    if (ranges.length > 20) ranges.shift();
    previous = b;
    const now = b.t + minute;
    const blockStart = Math.floor(b.t / width) * width;
    if (bucket?.t !== blockStart) bucket = { t: blockStart, h: b.h, l: b.l, n: 1 };
    else { bucket.h = Math.max(bucket.h, b.h); bucket.l = Math.min(bucket.l, b.l); bucket.n++; }
    zones = zones.filter(z => now - z.formed <= 180 * minute);
    if (bucket.n === 5 && now === blockStart + width) {
      zones = zones.filter(z => z.side > 0 ? b.c >= z.low : b.c <= z.high);
      const first = priorBuckets.at(-2);
      if (first && first.t === blockStart - 2 * width) {
        if (bucket.l - first.h >= 0.20) zones.push({ side: 1, low: first.h, high: bucket.l, formed: now });
        if (first.l - bucket.h >= 0.20) zones.push({ side: -1, low: bucket.h, high: first.l, formed: now });
      }
      priorBuckets = [...priorBuckets.slice(-1), bucket];
    }
    const e = events.get(now);
    if (e) {
      const lo = Math.min(b.c, e.targetBid ?? b.c), hi = Math.max(b.c, e.targetBid ?? b.c);
      const opposing = zones.filter(z => z.side === -e.side);
      opposingBySignal.set(now, { close: b.c, zones: opposing });
      const blockers = opposing.filter(z => Math.max(lo, z.low) < Math.min(hi, z.high));
      tagged.push({ ...e, turnedM1: scan.contextByClose.get(b.t)?.m1 === -e.side, blockers: blockers.map(z => ({ ...z })) });
    }
  }
  return { ...scan, events: tagged, atrByOpen: byStamp, opposingBySignal };
}

function isolated(position, session, index) {
  const book = { balance: 5000, peak: 5000, spread, commissionPct: commission, leverage: rules.goldLeverage,
    positions: [position], orders: [], dayFloor: -Infinity, maxFloor: () => -Infinity };
  for (const b of session.bars.slice(index)) {
    const end = b.t >= position.openedAt + 120 * minute || b.t >= session.t + 1140 * minute;
    const candle = end ? { ...b, h: b.o, l: b.o, c: b.o } : b;
    const out = conservativeCandle(book, candle).events[0];
    if (out || end) {
      const exit = out?.price ?? markPrice(position.side, b.o, spread);
      return { exit, reason: out?.reason ?? 'time', pnl: tradePnl(position, exit, commission),
        closedAt: b.t + (end ? 0 : minute) };
    }
  }
  throw new Error('No exit in eligible replay session');
}

function match(trade, prepared) {
  const { session, scan, openings } = prepared;
  const i = openings.get(trade.openedAt);
  const same = isolated(trade, session, i);
  assert.ok(Math.abs(same.pnl - trade.pnl) < 1e-8 && same.reason === trade.reason && same.closedAt === trade.closedAt);
  const actualAtr = scan.atrByOpen.get(trade.openedAt);
  const side = trade.side === 'long' ? 1 : -1;
  const candidates = [];
  for (const [t, index] of openings) {
    const minutesAway = Math.abs(t - trade.openedAt) / minute;
    if (minutesAway > 45 || t < session.t + 480 * minute || t >= session.t + 960 * minute || prepared.triggered.has(t)) continue;
    const tilt = scan.contextByClose.get(t), candidateAtr = scan.atrByOpen.get(t);
    if (tilt?.m1 !== side || tilt.m15 !== side || !actualAtr || !candidateAtr) continue;
    const ratio = candidateAtr / actualAtr;
    if (ratio < 0.75 || ratio > 1.25) continue;
    candidates.push({ t, index, distance: minutesAway / 45 + Math.abs(Math.log(ratio)) });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.t - b.t);
  const controls = candidates.slice(0, 3).map(({ t, index }) => {
    const entry = entryPrice(trade.side, session.bars[index].o, spread);
    const delta = entry - trade.entry;
    const synthetic = { ...trade, entry, sl: trade.sl + delta, tp: trade.tp + delta, openedAt: t };
    return { openedAt: t, entry, ...isolated(synthetic, session, index) };
  });
  return { t: trade.openedAt, date: session.date, side: trade.side, pnl: trade.pnl, risk: trade.plannedRisk,
    stop: trade.sl, target: trade.tp, reason: trade.reason, controls };
}

function summarizeMatch(rows) {
  const compare = rows.filter(r => r.controls.length);
  const averages = compare.map(r => {
    const control = r.controls.reduce((total, c) => total + c.pnl, 0) / r.controls.length;
    return { date: r.date, actual: r.pnl, control, delta: r.pnl - control };
  });
  const mean = (items, field) => items.length ? items.reduce((n, x) => n + x[field], 0) / items.length : null;
  const dates = [...new Set(averages.map(r => r.date))];
  const groups = dates.map(date => averages.filter(r => r.date === date));
  const sums = groups.map(g => g.reduce((s, r) => s + r.delta, 0));
  let state = 314159;
  const distribution = [];
  for (let iteration = 0; iteration < 4000 && groups.length; iteration++) {
    let n = 0, sum = 0;
    for (const _ of groups) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const k = Math.floor((state / 2 ** 32) * groups.length);
      n += groups[k].length; sum += sums[k];
    }
    distribution.push(sum / n);
  }
  distribution.sort((a, b) => a - b);
  return { actualN: rows.length, matchedN: compare.length, matchedDays: groups.length,
    controlN: compare.reduce((n, r) => n + r.controls.length, 0),
    avgActual: mean(averages, 'actual'), avgControl: mean(averages, 'control'), delta: mean(averages, 'delta'),
    ci: distribution.length ? [distribution[99], distribution[3899]] : null,
    winners: compare.filter(r => r.pnl > 0).length,
    winsWithoutAWinningControl: compare.filter(r => r.pnl > 0 && r.controls.every(c => c.pnl <= 0)).length };
}

function profitability(run) {
  const { trades, daily } = run;
  const top = Math.max(0, ...daily.map(x => x.pnl));
  const s = summarize(run);
  const r = trades.map(t => t.r).sort((a, b) => a - b);
  return { ...s, netWithoutTopDay: s.net - top, topDay: top, medianNetR: r[Math.floor(r.length / 2)] ?? null };
}

// Context from Parça's MSP lesson: price closes beyond the extreme associated
// with the FVG. The three formation candles are our explicit approximation.
function waitForRegionExtreme(session, scan) {
  const times = new Map(session.bars.map((bar, i) => [bar.t, i]));
  const selected = [];
  for (const e of scan.events.filter(e => e.inverted && e.targetBid !== null)) {
    const formed = times.get(e.inverted.formedAt - minute);
    const signal = times.get(e.setupAt - minute);
    if (formed === undefined || signal === undefined || formed < 2) continue;
    const setupBars = session.bars.slice(formed - 2, formed + 1);
    if (setupBars[2].t - setupBars[0].t !== 2 * minute) continue;
    const threshold = e.side > 0 ? Math.max(...setupBars.map(b => b.h)) : Math.min(...setupBars.map(b => b.l));
    for (let i = signal; i <= signal + 8; i++) {
      const b = session.bars[i];
      if (!b || b.t !== e.setupAt + (i - signal - 1) * minute || b.t >= session.t + 960 * minute) break;
      const now = b.t + minute;
      const context = scan.contextByClose.get(now);
      if (context?.m15 !== e.side || context?.m1 !== e.side) break;
      if (i > signal) {
        const adverse = e.side > 0 ? b.l : b.h;
        const favorable = e.side > 0 ? b.h : b.l;
        if (e.side * (adverse - e.stopBid) <= 0 || e.side * (favorable - e.targetBid) >= 0) break;
      }
      if (e.side * (b.c - threshold) > 0) {
        selected.push({ ...e, setupAt: now, originalSetupAt: e.setupAt, regionExtreme: threshold });
        break;
      }
    }
  }
  return selected;
}

function withH1(scan, targets, clamp) {
  return scan.events.flatMap(e => {
    const h1 = targets.get(e.setupAt);
    if (!h1) return [];
    const { side } = e;
    let targetBid = h1.price - side * 0.10;
    const entry = scan.opposingBySignal.get(e.setupAt);
    if (clamp && entry) {
      for (const z of entry.zones) {
        const near = side > 0 ? z.low : z.high;
        if (side * (near - entry.close) > 0 && side * (targetBid - near) > 0) targetBid = near - side * 0.10;
      }
    }
    return [{ ...e, targetBid, originalTargetBid: e.targetBid, h1Target: h1 }];
  });
}

function pairedTargets(baseline, run) {
  const first = new Map(baseline.trades.map(t => [t.openedAt, t]));
  const pairs = run.trades.flatMap(t => {
    const original = first.get(t.openedAt);
    return original?.entry === t.entry && original.sl === t.sl && original.lots === t.lots ? [[original, t]] : [];
  });
  const sum = i => pairs.reduce((p, item) => p + item[i].pnl, 0);
  return { n: pairs.length, baseline: sum(0), alternative: sum(1),
    improved: pairs.filter(([a, b]) => b.pnl > a.pnl + 1e-8).length,
    worsened: pairs.filter(([a, b]) => b.pnl < a.pnl - 1e-8).length };
}

const types = ['fvg-retest', 'ifvg-double'];
let prefixChecks = 0;
const result = {};
for (const [period, archived] of Object.entries(archive.rawOutput)) {
  const source = await loadSessions(archived.period);
  assert.equal(source.hash, archived.hash);
  const cached = [];
  const priorDays = [];
  for (const session of source.sessions.filter(s => s.eligible)) {
    const bars = await quotes(session);
    const original = scanSession(bars, session.t);
    const scan = decorate(bars, original);
    const h1 = h1Targets(bars, scan.events);
    const sequence = sweepDisplacementRetests(session, scan);
    const daily = dailyReactions(priorDays, bars, scan.events, session.t);
    if (cached.length < 4) {
      const cutoff = session.t + 720 * minute;
      const earlier = bars.filter(b => b.t < cutoff);
      const prefix = decorate(earlier, scanSession(earlier, session.t));
      assert.deepEqual(prefix.events, scan.events.filter(e => e.setupAt <= cutoff));
      assert.deepEqual([...prefix.atrByOpen], [...scan.atrByOpen].filter(([t]) => t < cutoff));
      const prefixSession = { ...session, bars: session.bars.filter(b => b.t < cutoff) };
      assert.deepEqual(waitForRegionExtreme(prefixSession, prefix),
        waitForRegionExtreme(session, scan).filter(e => e.setupAt <= cutoff));
      assert.deepEqual([...h1Targets(earlier, prefix.events)], [...h1].filter(([stamp]) => stamp <= cutoff));
      assert.deepEqual(sweepDisplacementRetests(prefixSession, prefix), sequence.filter(e => e.setupAt <= cutoff));
      assert.deepEqual(dailyReactions(priorDays, earlier, prefix.events, session.t),
        daily.filter(e => e.setupAt <= cutoff));
      prefixChecks++;
    }
    cached.push({ session, original, scan, h1, sequence, daily, openings: new Map(session.bars.map((b, i) => [b.t, i])),
      triggered: new Set(original.events.map(e => e.setupAt)) });
    const day = completedUtcDay(bars, session.t);
    if (day) priorDays.push(day);
  }
  const index = new Map(cached.map(p => [p.session.t, p]));
  result[period] = {};
  for (const type of types) {
    const baseline = play(cached.map(p => scheduleEntries(p.session, p.original, type, spread, commission)), 'conservative', false, spread);
    assert.deepEqual(JSON.parse(JSON.stringify(baseline.trades)), archived.outputs[type].trades);
    const comparisons = baseline.trades.map(t => match(t, index.get(Math.floor(t.openedAt / day) * day)));
    const modified = {};
    for (const [label, predicate] of [['m1-turn', e => e.turnedM1], ['clear-m5-path', e => !e.blockers.length]]) {
      const prepared = cached.map(p => scheduleEntries(p.session, { ...p.scan, events: p.scan.events.filter(predicate) }, type, spread, commission));
      modified[label] = profitability(play(prepared, 'conservative', false, spread));
    }
    if (type === 'ifvg-double') {
      const prepared = cached.map(p => scheduleEntries(p.session,
        { ...p.scan, events: waitForRegionExtreme(p.session, p.scan) }, type, spread, commission));
      const run = play(prepared, 'conservative', false, spread);
      modified['region-extreme'] = { ...profitability(run),
        delayed: run.trades.filter(t => t.context.setupAt > t.context.originalSetupAt).length,
        trades: run.trades };
    }
    for (const [label, clamp] of [['h1-target', false], ['h1-before-m5-gap', true]]) {
      const prepared = cached.map(p => scheduleEntries(p.session,
        { ...p.scan, events: withH1(p.scan, p.h1, clamp) }, type, spread, commission));
      const run = play(prepared, 'conservative', false, spread);
      for (const t of run.trades) assert.ok(t.context.h1Target.knownAt <= t.context.setupAt);
      modified[label] = { ...profitability(run), pairs: pairedTargets(baseline, run), trades: run.trades };
    }
    const dailyRun = play(cached.map(p => scheduleEntries(p.session, { ...p.scan, events: p.daily },
      type, spread, commission)), 'conservative', false, spread);
    modified['daily-zone-scenario'] = { ...profitability(dailyRun), trades: dailyRun.trades };
    result[period][type] = { baseline: profitability(baseline), match: summarizeMatch(comparisons), modified, comparisons };
    console.log(period, type, result[period][type].match, Object.fromEntries(Object.entries(modified).map(([k, v]) =>
      [k, [v.n, v.expectancy]])));
  }
  const sequence = play(cached.map(p => scheduleEntries(p.session, { ...p.scan, events: p.sequence }, 'swing-control', spread, commission)),
    'conservative', false, spread);
  result[period]['sweep-displacement-retest'] = { summary: profitability(sequence), trades: sequence.trades };
  console.log(period, 'sweep-displacement-retest', sequence.trades.length, result[period]['sweep-displacement-retest'].summary.expectancy);
}
for (const type of types) {
  result.combined ??= {};
  result.combined[type] = summarizeMatch(Object.values(result).flatMap(period => period[type]?.comparisons ?? []));
}
writeFileSync('analysis/research-parca-m1-controls.json', JSON.stringify({ prefixChecks, result }) + '\n');
