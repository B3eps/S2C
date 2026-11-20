import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { day, minute, isoDay, loadSessions } from './data.mjs';
import { CONTRACT, MIN_LOT } from '../../src/lib/types.ts';

const bundle = await build({ entryPoints: ['scripts/research/s2c.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { conservativeCandle, simulateCandle, entryPrice, markPrice, tradePnl, maxLotsFor } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const epsilon = 1e-8;
const near = (a, b, label) => assert.ok(Math.abs(a - b) < epsilon, `${label}: ${a} vs ${b}`);
const cohorts = [];
const sources = new Map();
const load = file => JSON.parse(readFileSync(file, 'utf8'));
for (const strategy of ['fib', 'opening', 'failed', 'vwap']) {
  for (const split of ['development', 'validation', 'test']) {
    const archived = load(`analysis/research-${strategy}-${split}.json`);
    const { start, end, excluded, hash } = archived.source;
    const source = [start, end, excluded];
    sources.set(JSON.stringify(source), { dates: source, hash });
    for (const [variant, paths] of Object.entries(archived.results)) {
      cohorts.push({ strategy, variant, split, source, trades: paths.conservative.trades,
        spread: archived.spread, commission: archived.rules.commissionPct });
    }
  }
}
const sensitivity = load('analysis/research-vwap-sensitivity.json');
const cross = sensitivity.input.cross;
const crossDates = [cross.from, cross.to, cross.excluded];
sources.set(JSON.stringify(crossDates), { dates: crossDates, hash: cross.hash });
const vwapArchive = load('analysis/research-vwap-test.json');
cohorts.push({ strategy: 'vwap', variant: 'vwap-reversion', split: 'cross', source: crossDates,
  trades: sensitivity.results.original.cross.trades, spread: vwapArchive.spread, commission: vwapArchive.rules.commissionPct });

const data = new Map();
for (const [key, source] of sources) {
  const raw = await loadSessions(source.dates);
  assert.equal(raw.hash, source.hash, 'Market data changed since archive');
  data.set(key, new Map(raw.sessions.filter(s => s.eligible).map(s => [s.t, s])));
}

function followTarget(session, exitCandle, sign, targetBid) {
  // Start in the next complete minute. A touch in the exit candle is reported separately.
  const after = session.bars.slice(exitCandle + 1);
  for (let n = 1; n <= 30; n++) {
    const bar = after[n - 1];
    if (!bar || bar.t !== session.bars[exitCandle].t + n * minute ||
        bar.t >= session.t + 1140 * minute) return { postExitTarget: 'eksik' };
    const extreme = sign > 0 ? bar.h : bar.l;
    if (sign * (extreme - targetBid) >= -epsilon) return { postExitTarget: 'temas', targetAfterMinutes: n };
  }
  return { postExitTarget: 'yok' };
}

function walkTrade(t, session, spread, commission, expiresAt = t.openedAt + 120 * minute) {
  const sign = t.side === 'long' ? 1 : -1;
  const bars = session.bars;
  const start = bars.findIndex(b => b.t === t.openedAt);
  assert.ok(start >= 0 && start > 0, 'Entry minute missing');
  const startBid = bars[start].o;
  const book = { positions: [t], orders: [], balance: 5000, peak: 5000, spread, commissionPct: commission,
    leverage: 10, dayFloor: -Infinity, maxFloor: () => -Infinity };
  const observe = bid => sign * (markPrice(t.side, bid, spread) - t.entry);
  let best = 0, worst = 0, gaps = 0;
  let exit, exitBar, exitIndex, atOpen, scenarios;
  for (let i = start; i < bars.length; i++) {
    const b = bars[i];
    if (i > start) gaps += (b.t - bars[i - 1].t) / minute - 1;
    const forced = b.t >= session.t + 1140 * minute || b.t >= expiresAt;
    const candle = forced ? { ...b, h: b.o, l: b.o, c: b.o } : b;
    best = Math.max(best, observe(b.o));
    worst = Math.min(worst, observe(b.o));
    const selected = conservativeCandle(book, candle).events[0];
    if (selected || forced) {
      exit = selected ?? { price: markPrice(t.side, b.o, spread), reason: 'time' };
      scenarios = ['high-first', 'low-first'].map(path => simulateCandle(book, candle, path).events[0]?.reason ?? null);
      exitBar = b;
      exitIndex = i;
      atOpen = forced;
      break;
    }
    best = Math.max(best, observe(sign > 0 ? b.h : b.l));
    worst = Math.min(worst, observe(sign > 0 ? b.l : b.h));
  }
  assert.ok(exit, 'Trade outlasted archived session');
  return { start, startBid, best, worst, gaps, exit, exitBar, exitIndex, atOpen, scenarios };
}

function audit(t, session, spread, commission) {
  const { start, startBid, best, worst, gaps, exit, exitBar, exitIndex, atOpen, scenarios } =
    walkTrade(t, session, spread, commission);
  const sign = t.side === 'long' ? 1 : -1;
  const bars = session.bars;
  near(entryPrice(t.side, startBid, spread), t.entry, 'entry');
  assert.equal(exit?.reason, t.reason);
  near(exit.price, t.exit, 'exit');
  assert.equal(t.closedAt, exitBar.t + (atOpen ? 0 : minute));
  near(tradePnl(t, t.exit, commission), t.pnl, 'PnL');

  const units = t.lots * CONTRACT;
  const bidExit = t.exit - (t.side === 'short' ? spread : 0);
  const targetBid = t.tp - (t.side === 'short' ? spread : 0);
  const priceMoveUsd = sign * (bidExit - startBid) * units;
  const spreadUsd = spread * units;
  const commissionUsd = (t.entry + t.exit) * units * commission / 100;
  near(priceMoveUsd - spreadUsd - commissionUsd, t.pnl, 'price/cost identity');
  const worseThanStopUsd = t.reason === 'sl' ? Math.max(0, sign * (t.sl - t.exit) * units) : 0;
  const stopFill = t.reason !== 'sl' ? null : worseThanStopUsd > epsilon ? 'açılışta stop ötesi' : 'stop seviyesinde';
  const ambiguous = scenarios[0] !== scenarios[1];
  const beforeTargetProgress = best / Math.abs(t.tp - t.entry);
  const prior15ATR = start >= 16 && t.context?.atr
    ? sign * (bars[start - 1].c - bars[start - 16].c) / t.context.atr : null;
  const diagnosis = t.reason === 'time' ? 'süre/seans kapanışı' :
    ambiguous ? 'aynı mumda yol sırası sonucu değiştiriyor' :
    worseThanStopUsd > epsilon ? 'açılış stopun ötesinde' :
    t.reason === 'tp' ? 'hedef gerçekleşti' :
    exitIndex - start < 3 ? 'ilk üç mumda stop' :
    beforeTargetProgress >= 0.5 ? 'önce hedef mesafesinin yarısına ilerledi, sonra stop' :
    'hedef mesafesinin yarısı görülmeden stop';
  return {
    date: session.date, spread, openedUTC: new Date(t.openedAt).toISOString(), closedUTC: new Date(t.closedAt).toISOString(),
    exitCandleUTC: new Date(exitBar.t).toISOString(), side: t.side, lots: t.lots,
    entry: t.entry, stop: t.sl, target: t.tp, exit: t.exit, reason: t.reason, diagnosis,
    candleCount: exitIndex - start + (atOpen ? 0 : 1), pnlUsd: t.pnl,
    priceMoveUsd, spreadUsd, commissionUsd, worseThanStopUsd, stopFill,
    highFirstExit: scenarios[0], lowFirstExit: scenarios[1], ambiguous, barsMissingWhileOpen: gaps,
    beforeTargetProgress, adverseBeforeExitCandleUsd: Math.abs(worst) * units, prior15ATR,
    ...followTarget(session, exitIndex, sign, targetBid), context: t.context,
  };
}

const records = [];
for (const { strategy, variant, split, source, trades, spread, commission } of cohorts) {
  const index = data.get(JSON.stringify(source));
  for (const t of trades) {
    const session = index.get(Math.floor(t.openedAt / day) * day);
    assert.ok(session, `Missing session for ${strategy}/${variant}/${split} ${t.openedAt}`);
    records.push({ strategy, variant, split, ...audit(t, session, spread, commission) });
  }
}

const sum = (rows, field) => rows.reduce((a, b) => a + b[field], 0);
function summarize(rows) {
  const losses = rows.filter(t => t.pnlUsd < 0);
  const wins = rows.filter(t => t.pnlUsd > 0);
  const stops = losses.filter(t => t.reason === 'sl');
  const after = stops.filter(t => t.postExitTarget === 'temas');
  const noAfter = stops.filter(t => t.postExitTarget === 'yok');
  const group = (items, key) => Object.fromEntries([...new Set(items.map(key))].sort().map(k => {
    const selected = items.filter(t => key(t) === k);
    const n = selected.length;
    const winnerCount = selected.filter(t => t.pnlUsd > 0).length;
    return [k, { n, wins: winnerCount, losses: selected.filter(t => t.pnlUsd < 0).length,
      net: sum(selected, 'pnlUsd'), winRate: winnerCount / n }];
  }));
  return {
    n: rows.length, won: wins.length, lost: losses.length, net: sum(rows, 'pnlUsd'),
    netBeforeCosts: sum(rows, 'priceMoveUsd'),
    cost: sum(rows, 'spreadUsd') + sum(rows, 'commissionUsd'),
    lossOnlyBidMove: sum(losses, 'priceMoveUsd'),
    lossOnlyCost: sum(losses, 'spreadUsd') + sum(losses, 'commissionUsd'),
    pricePositiveButNetLoss: losses.filter(t => t.priceMoveUsd > epsilon).length,
    stopLosses: stops.length, timeLosses: losses.filter(t => t.reason === 'time').length,
    stopsFirstThree: stops.filter(t => t.candleCount <= 3).length,
    winnersFirstThree: wins.filter(t => t.candleCount <= 3).length,
    stopGap: stops.filter(t => t.worseThanStopUsd > epsilon).length,
    stopGapCost: sum(stops, 'worseThanStopUsd'),
    ambiguous: rows.filter(t => t.ambiguous).length,
    ambiguousLoss: losses.filter(t => t.ambiguous).length,
    stopAfterHalfTarget: stops.filter(t => t.beforeTargetProgress >= 0.5).length,
    tradeDuringMissingMinute: rows.filter(t => t.barsMissingWhileOpen > 0).length,
    targetWithin30AfterStop: after.length, noTargetWithin30AfterStop: noAfter.length,
    targetAfterStopUnknown: stops.length - after.length - noAfter.length,
    bySide: group(rows, t => t.side),
    byEntryHour: group(rows, t => t.openedUTC.slice(11, 13)),
    byPrior15: group(rows, t => t.prior15ATR === null ? '?' : t.prior15ATR <= -1 ? 'karşı' : t.prior15ATR >= 1 ? 'aynı' : 'nötr'),
  };
}

const mergedSessions = new Map();
for (const sessions of data.values()) for (const [stamp, session] of sessions) mergedSessions.set(stamp, session);
const combinedVwap = sensitivity.results.original.combined.trades;
const stopFactors = [1.25, 1.5, 2];
const delayMinutes = [1, 3];
const newProbe = values => Object.fromEntries(values.map(k => [k,
  { n: 0, flippedToWin: 0, flippedToLoss: 0, baseNet: 0, net: 0, skipped: 0, skippedBaseWins: 0, overlap: 0, lastExit: -Infinity }]));
const stopProbe = newProbe(stopFactors);
const delayProbe = newProbe(delayMinutes);
function compareTrade(base, replacement, session, spread, commission, summary) {
  if (!replacement || replacement.lots < MIN_LOT) {
    summary.skipped++;
    summary.skippedBaseWins += Number(base.pnl > 0);
    return { skipped: true };
  }
  const replay = walkTrade(replacement, session, spread, commission, base.openedAt + 120 * minute);
  const pnl = tradePnl(replacement, replay.exit.price, commission);
  const time = replay.exitBar.t + (replay.atOpen ? 0 : minute);
  if (replacement.openedAt < summary.lastExit) summary.overlap++;
  summary.lastExit = Math.max(summary.lastExit, time);
  summary.n++;
  summary.baseNet += base.pnl;
  summary.net += pnl;
  summary.flippedToWin += Number(base.pnl < 0 && pnl > 0);
  summary.flippedToLoss += Number(base.pnl > 0 && pnl < 0);
  return { pnl, exit: replay.exit.reason, lots: replacement.lots, sl: replacement.sl };
}
const combinedRows = [];
for (const t of combinedVwap) {
  const session = mergedSessions.get(Math.floor(t.openedAt / day) * day);
  assert.ok(session, 'Missing combined VWAP session');
  const spread = vwapArchive.spread, commission = vwapArchive.rules.commissionPct;
  const row = audit(t, session, spread, commission);
  const sized = order => {
    const riskPerLot = -tradePnl({ ...order, lots: 1 }, order.sl, commission);
    return { ...order, lots: Math.floor(t.plannedRisk / riskPerLot / MIN_LOT + epsilon) * MIN_LOT };
  };
  const widenedStop = Object.fromEntries(stopFactors.map(factor => {
    const sl = t.entry + factor * (t.sl - t.entry);
    return [factor, compareTrade(t, sized({ ...t, sl }), session, spread, commission, stopProbe[factor])];
  }));
  const delayedEntry = Object.fromEntries(delayMinutes.map(wait => {
    const openedAt = t.openedAt + wait * minute;
    const open = session.bars.find(b => b.t === openedAt)?.o;
    // A known stop/target in the waiting window invalidates the old bracket.
    const stopOrTargetBefore = Date.parse(row.exitCandleUTC) < openedAt;
    let replacement;
    if (open !== undefined && !stopOrTargetBefore) {
      const quote = markPrice(t.side, open, spread);
      const entry = entryPrice(t.side, open, spread);
      const sign = t.side === 'long' ? 1 : -1;
      if (sign * (quote - t.sl) > 0 && sign * (t.tp - entry) > 0 && sign * (entry - t.sl) >= 1) {
        replacement = sized({ ...t, entry, openedAt });
      }
    }
    return [wait, compareTrade(t, replacement, session, spread, commission, delayProbe[wait])];
  }));
  combinedRows.push({ strategy: 'vwap', variant: 'vwap-reversion', split: 'combined', ...row, widenedStop, delayedEntry });
}
for (const summary of [...Object.values(stopProbe), ...Object.values(delayProbe)]) {
  summary.expectancy = summary.net / summary.n;
  summary.baseExpectancy = summary.baseNet / summary.n;
  delete summary.lastExit;
}
const sensitivityLedger = load('.cache/research-vwap-sensitivity-trades.json');
assert.deepEqual(sensitivityLedger.input, sensitivity.input, 'Sensitivity ledgers use different quotes');
const sensitivityRows = [];
for (const [variant, { spread, trades }] of Object.entries(sensitivityLedger.variants)) {
  for (const [period, outcomes] of Object.entries(trades)) {
    const summary = sensitivity.results[variant][period];
    assert.equal(outcomes.length, summary.n);
    near(outcomes.reduce((sum, t) => sum + t.pnl, 0), summary.net, 'sensitivity ledger aggregate');
    for (const t of outcomes) {
      const session = mergedSessions.get(Math.floor(t.openedAt / day) * day);
      assert.ok(session, 'Missing sensitivity session');
      sensitivityRows.push({ strategy: 'vwap', variant, split: period === 'formerTest' ? 'test' : period,
        ...audit(t, session, spread, vwapArchive.rules.commissionPct) });
    }
  }
}
const original = records.filter(r => r.split !== 'cross');
const main = { fib: 'fib-60-70', opening: 'opening-breakout', failed: 'reentry', vwap: 'vwap-reversion' };
const views = {
  original: summarize(original),
  mainTests: Object.fromEntries(Object.entries(main).map(([k, v]) =>
    [k, summarize(records.filter(r => r.strategy === k && r.variant === v && r.split === 'test'))])),
  vwapAll: summarize(combinedRows),
  vwapStopProbe: stopProbe,
  sensitivityAuditCount: { records: sensitivityRows.length, losses: sensitivityRows.filter(r => r.pnlUsd < 0).length },
  vwapDelayProbe: delayProbe,
  vwapByPeriod: Object.fromEntries(['development','validation','cross','test'].map(split =>
    [split, summarize(records.filter(r => r.variant === main.vwap && r.split === split))])),
};
const columns = [...Object.keys(records[0]).filter(k => k !== 'context'), 'targetAfterMinutes', 'context', 'widenedStop', 'delayedEntry'];
const csvCell = value => {
  if (value == null) return '';
  if (typeof value === 'object') value = JSON.stringify(value);
  if (typeof value === 'number') value = String(value).replace('.', ',');
  return '"' + String(value).replaceAll('"', '""') + '"';
};
const csv = [columns.join(';'), ...[...records, ...combinedRows, ...sensitivityRows].map(row => columns.map(key => csvCell(row[key])).join(';'))];
writeFileSync('analysis/research-loss-audit.csv', '\ufeff' + csv.join('\r\n') + '\r\n');
writeFileSync('analysis/research-loss-audit-summary.json', JSON.stringify(views, null, 2) + '\n');
console.log(`Included ${combinedRows.length} separately sized combined VWAP records`);
console.log(`Replayed ${records.length} records, ${records.filter(r => r.pnlUsd < 0).length} losses`);
console.log(`Replayed ${sensitivityRows.length} additional sensitivity records, ${sensitivityRows.filter(r => r.pnlUsd < 0).length} losses`);

// Diagnose the selected archived candidate before changing its signals.
const candidateRows = [];
for (const { split, source, trades, spread, commission } of cohorts.filter(c => c.variant === 'reentry-confirm')) {
  const index = data.get(JSON.stringify(source));
  let balance = 5000;
  for (const t of trades) {
    const session = index.get(Math.floor(t.openedAt / day) * day);
    const row = audit(t, session, spread, commission);
    const start = session.bars.findIndex(b => b.t === t.openedAt);
    const sign = t.side === 'long' ? 1 : -1;
    const entryBid = session.bars[start].o;
    const expiresAt = t.openedAt + 120 * minute;
    const noStop = walkTrade({ ...t, sl: undefined }, session, spread, commission, expiresAt);
    const future = {};
    for (const n of [5, 15, 30, 60, 120]) {
      const span = session.bars.slice(start, start + n);
      const last = span.at(-1);
      if (!last || last.t !== t.openedAt + (n - 1) * minute || last.t >= session.t + 1140 * minute) {
        future[n] = null;
        continue;
      }
      future[n] = {
        signedBidMove: sign * (last.c - entryBid),
        targetSeen: span.some(b => sign * (markPrice(t.side, sign > 0 ? b.h : b.l, spread) - t.tp) >= -epsilon),
        sweepBroken: span.some(b => sign * ((sign > 0 ? b.l : b.h) - t.context.sweep) < 0),
      };
    }
    const sizeFor = order => {
      const riskPerLot = -tradePnl({ ...order, lots: 1 }, order.sl, commission);
      return Math.min(Math.floor(t.plannedRisk / riskPerLot / MIN_LOT + epsilon) * MIN_LOT,
        maxLotsFor(balance, order.entry, vwapArchive.rules.goldLeverage));
    };
    const replay = order => {
      const sized = { ...order, lots: sizeFor(order) };
      if (sized.lots < MIN_LOT) return null;
      const result = walkTrade(sized, session, spread, commission, expiresAt);
      return { pnl: tradePnl(sized, result.exit.price, commission), reason: result.exit.reason,
        lot: sized.lots, entry: sized.entry, sl: sized.sl, openedAt: sized.openedAt,
        closedAt: result.exitBar.t + (result.atOpen ? 0 : minute) };
    };
    const wider = Object.fromEntries([1.25, 1.5].map(factor => [factor,
      replay({ ...t, sl: t.entry + factor * (t.sl - t.entry) })]));
    const earlierTime = t.openedAt - t.context.waited * minute;
    const earlyBar = session.bars[start - t.context.waited];
    assert.equal(earlyBar.t, earlierTime, 'Missing first reentry open');
    const earlyEntry = entryPrice(t.side, earlyBar.o, spread);
    const earlyDistance = sign * (earlyEntry - t.sl);
    const validEarly = sign * (markPrice(t.side, earlyBar.o, spread) - t.sl) > 0 && earlyDistance >= 1;
    const beforeConfirm = validEarly && sign * (t.tp - earlyEntry) > 0 ?
      replay({ ...t, entry: earlyEntry, openedAt: earlierTime }) : null;
    const beforeConfirmOwnTarget = validEarly ?
      replay({ ...t, entry: earlyEntry, openedAt: earlierTime, tp: earlyEntry + sign * 1.5 * earlyDistance }) : null;
    candidateRows.push({
      split, ...row, earlyCostPerOunce: sign * (earlyEntry - t.entry), noStop: {
        reason: noStop.exit.reason, reachedTarget: noStop.exit.reason === 'tp',
        exit: noStop.exit.price, exitCandle: new Date(noStop.exitBar.t).toISOString(),
        pnlAtOriginalSize: tradePnl(t, noStop.exit.price, commission),
      }, future, wider, beforeConfirm, beforeConfirmOwnTarget,
    });
    balance += t.pnl;
  }
}

function summarizeCandidate(rows) {
  const losses = rows.filter(r => r.pnlUsd < 0);
  const horizons = Object.fromEntries([5, 15, 30, 60, 120].map(n => {
    const observed = losses.map(r => r.future[n]).filter(Boolean);
    return [n, { n: observed.length, direction: observed.filter(r => r.signedBidMove > 0).length,
      hit: observed.filter(r => r.targetSeen).length, sweepBroken: observed.filter(r => r.sweepBroken).length }];
  }));
  const paired = alternative => {
    const matched = rows.map(row => ({ base: row.pnlUsd, alternative: alternative(row) })).filter(r => r.alternative);
    return { n: matched.length, base: sum(matched, 'base'), alternative: matched.reduce((p, r) => p + r.alternative.pnl, 0),
      improved: matched.filter(r => r.alternative.pnl > r.base).length,
      flippedToWin: matched.filter(r => r.base < 0 && r.alternative.pnl > 0).length,
      flippedToLoss: matched.filter(r => r.base > 0 && r.alternative.pnl < 0).length };
  };
  return {
    n: rows.length, losses: losses.length, lossStops: losses.filter(r => r.reason === 'sl').length,
    earlyStops: losses.filter(r => r.reason === 'sl' && r.candleCount <= 3).length,
    reachedTargetWithoutStop: losses.filter(r => r.noStop.reachedTarget).length,
    worseWithoutStop: losses.filter(r => r.noStop.pnlAtOriginalSize < r.pnlUsd - epsilon).length,
    meanEarlyEntryImprovement: -sum(rows, 'earlyCostPerOunce') / rows.length,
    horizons, wider125: paired(r => r.wider[1.25]), wider150: paired(r => r.wider[1.5]),
    beforeConfirm: paired(r => r.beforeConfirm), beforeConfirmOwnTarget: paired(r => r.beforeConfirmOwnTarget),
  };
}

const anchorCheck = [];
const fib = cohorts.find(c => c.variant === 'fib-60-70' && c.split === 'test');
let fibBalance = 5000;
for (const t of fib.trades) {
  const session = data.get(JSON.stringify(fib.source)).get(Math.floor(t.openedAt / day) * day);
  const { pivotFrom, pivotTo, knownAt, zone } = t.context;
  const bars = new Map(session.bars.map(b => [b.t, b]));
  const sign = t.side === 'long' ? 1 : -1;
  const a = sign > 0 ? bars.get(pivotFrom).l : bars.get(pivotFrom).h;
  const b = sign > 0 ? bars.get(pivotTo).h : bars.get(pivotTo).l;
  const bounds = [b - 0.60 * (b - a), b - 0.70 * (b - a)].sort((a, b) => a - b);
  near(bounds[0], zone[0], 'Fib lower');
  near(bounds[1], zone[1], 'Fib upper');
  assert.equal(knownAt, pivotTo + 4 * minute);
  assert.ok(knownAt <= t.openedAt - minute);
  const checked = audit(t, session, fib.spread, fib.commission);
  const beforeAndExit = session.bars.filter(x => x.t >= t.openedAt && x.t <= Date.parse(checked.exitCandleUTC));
  const originBrokenByExit = beforeAndExit.some(x => sign * ((sign > 0 ? x.l : x.h) - a) <= 0);
  const originStop = markPrice(t.side, a - sign * 0.2 * t.context.atr, fib.spread);
  const originRiskPerLot = -tradePnl({ ...t, lots: 1 }, originStop, fib.commission);
  const originLots = Math.min(Math.floor(t.plannedRisk / originRiskPerLot / MIN_LOT + epsilon) * MIN_LOT,
    maxLotsFor(fibBalance, t.entry, vwapArchive.rules.goldLeverage));
  let originOutcome = null;
  if (originLots >= MIN_LOT) {
    const changed = { ...t, sl: originStop, lots: originLots };
    const walked = walkTrade(changed, session, fib.spread, fib.commission);
    originOutcome = { pnl: tradePnl(changed, walked.exit.price, fib.commission), reason: walked.exit.reason,
      lot: originLots, sl: originStop };
  }
  anchorCheck.push({ openedUTC: checked.openedUTC, pnl: t.pnl, pivotFrom, pivotTo, knownAt, fromPrice: a,
    toPrice: b, zone, originBrokenByExit, originOutcome });
  fibBalance += t.pnl;
}

const candidateSummary = Object.fromEntries(['development', 'validation', 'test', 'combined'].map(split =>
  [split, summarizeCandidate(candidateRows.filter(r => split === 'combined' || r.split === split))]));
writeFileSync('analysis/research-best-candidate-diagnosis.json',
  JSON.stringify({ candidateSummary, candidateRows, anchorCheck }) + '\n');
console.log(`Diagnosed ${candidateRows.length} trades of the selected candidate and verified ${anchorCheck.length} Fibonacci anchors`);
