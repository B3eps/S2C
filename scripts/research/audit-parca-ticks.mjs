import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, minute } from './data.mjs';
import { CONTRACT } from '../../src/lib/types.ts';

const archive = JSON.parse(readFileSync('analysis/research-parca-m1-historical.json', 'utf8'));
const commission = archive.rules.commissionPct;
const assumedSpread = 0.20;
const results = [];
const hour = 60 * minute;

function cachePath(when) {
  const d = new Date(when);
  const route = `ticks/XAU-USD/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCHours()}`;
  return `${cache}/${encodeURIComponent(route)}.json`;
}

function tickReplay(trade, ticks, realAsk) {
  const first = ticks[0];
  const sign = trade.side === 'long' ? 1 : -1;
  const ask = tick => realAsk ? tick.askPrice : tick.bidPrice + assumedSpread;
  const mark = tick => sign > 0 ? tick.bidPrice : ask(tick);
  const entry = sign > 0 ? ask(first) : first.bidPrice;
  if (sign * (mark(first) - trade.sl) <= 0 || sign * (trade.tp - entry) <= 0) return { reason: 'open-outside-bracket', entry };
  for (const tick of ticks) {
    const exit = mark(tick);
    const reason = sign * (exit - trade.sl) <= 0 ? 'sl' :
      sign * (exit - trade.tp) >= 0 ? 'tp' :
        tick.timestamp >= trade.openedAt + 120 * minute ? 'time' : null;
    if (!reason) continue;
    const pnl = (sign * (exit - entry) - (exit + entry) * commission / 100) * trade.lots * CONTRACT;
    return { reason, entry, exit, pnl, closedAt: tick.timestamp, closedSpread: tick.askPrice - tick.bidPrice };
  }
  return { reason: 'no-expiry-quote', entry };
}
for (const [period, { outputs }] of Object.entries(archive.rawOutput)) {
  const { trades } = outputs['fvg-retest'];
  for (const trade of [trades.find(t => t.pnl < 0), trades.find(t => t.pnl > 0)]) {
    const from = trade.openedAt, to = from + 121 * minute;
    const hours = [];
    for (let at = Math.floor(from / hour) * hour; at < to; at += hour) {
      const path = cachePath(at);
      assert.ok(existsSync(path), `Run fetch-parca-audit-ticks.ps1 first. Missing ${path}`);
      hours.push({ at, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
    }
    const ticks = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(from), to: new Date(to) },
      timeframe: 'tick', format: 'json', volumes: false, useCache: true, cacheFolderPath: cache });
    assert.ok(ticks.length > 0);
    let previous = from;
    for (const t of ticks) {
      assert.ok(t.timestamp >= previous && t.timestamp < to && t.askPrice >= t.bidPrice);
      previous = t.timestamp;
    }
    assert.ok(ticks.at(-1).timestamp >= from + 120 * minute, 'No data at the time cutoff');
    const fixed = tickReplay(trade, ticks, false);
    const quoted = tickReplay(trade, ticks, true);
    results.push({ period, utc: new Date(from).toISOString(), side: trade.side, ticks: ticks.length, hours,
      initialStamp: ticks[0].timestamp, initialBid: ticks[0].bidPrice, initialAsk: ticks[0].askPrice,
      observedSpread: ticks[0].askPrice - ticks[0].bidPrice, original: {
        pnl: trade.pnl, entry: trade.entry, exit: trade.exit, sl: trade.sl, tp: trade.tp, reason: trade.reason,
      }, fixed, quoted });
    console.log(period, new Date(from).toISOString(), trade.reason, fixed.reason, quoted.reason,
      [trade.pnl, fixed.pnl, quoted.pnl].map(n => n?.toFixed(2)).join('/'));
  }
}
writeFileSync('analysis/research-parca-m1-tick-check.json', JSON.stringify(results, null, 2) + '\n');
