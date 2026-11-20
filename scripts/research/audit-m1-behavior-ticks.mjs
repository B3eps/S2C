import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, minute } from './data.mjs';
import { netPerOunce } from './m1-behavior-rules.mjs';

const hour = 60 * minute;
const horizon = 15 * minute;
const load = suffix => JSON.parse(readFileSync(`analysis/research-m1-behavior${suffix}.json`, 'utf8')).data;
function orderedPairs(data, comparison) {
  return Object.entries(data).flatMap(([period, record]) => {
    const rows = new Map(record.rows.map(row => [row.id, row]));
    return record.pairs[comparison].pairs.flatMap(([a, b]) => {
      const pair = [rows.get(a), rows.get(b)];
      return pair.every(event => event.paths[0.5]?.[15]) ? [{ period, comparison, pair }] : [];
    });
  }).sort((a, b) => a.pair[0].t - b.pair[0].t || a.pair[1].t - b.pair[1].t);
}

function cacheHours(event) {
  const hours = [];
  for (let t = Math.floor(event.t / hour) * hour; t < event.t + horizon + minute; t += hour) hours.push(t);
  return hours;
}

const selected = [...orderedPairs(load('-hourly'), 'sweep-near'), ...orderedPairs(load(''), 'fib-depth')].slice(0, 3);
const hours = [...new Set(selected.flatMap(x => x.pair.flatMap(cacheHours)))].sort((a, b) => a - b);
const iso = t => new Date(t).toISOString();
const selection = { hours: hours.map(iso), pairs: selected.map(({ period, comparison, pair }) => ({
  period, comparison, events: pair.map(({ id, t }) => ({ id, utc: iso(t) })),
})) };

if (process.argv.includes('--manifest')) {
  writeFileSync('analysis/research-m1-behavior-tick-manifest.json', JSON.stringify(selection, null, 2) + '\n');
  console.log(selection.hours.join('\n'));
} else {
  const hashes = Object.fromEntries(hours.map(t => {
    const d = new Date(t);
    const route = `ticks/XAU-USD/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCHours()}`;
    const file = `${cache}/${encodeURIComponent(route)}.json`;
    assert.ok(existsSync(file), `Missing tick cache ${iso(t)}`);
    return [iso(t), createHash('sha256').update(readFileSync(file)).digest('hex')];
  }));
  const results = [];
  for (const { period, comparison, pair } of selected) {
    const outcomes = [];
    for (const event of pair) {
      const from = event.t, to = from + horizon + minute;
      const ticks = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(from), to: new Date(to) },
        timeframe: 'tick', format: 'json', volumes: false, useCache: true, cacheFolderPath: cache });
      let previous = from;
      for (const tick of ticks) {
        assert.ok(tick.timestamp >= previous && tick.timestamp < to && tick.askPrice >= tick.bidPrice);
        previous = tick.timestamp;
      }
      const first = ticks[0];
      const last = ticks.find(tick => tick.timestamp >= from + horizon);
      assert.ok(first && first.timestamp < from + minute && last, `Missing boundary quote ${iso(from)}`);
      const replay = fixed => {
        const ask = tick => fixed ? tick.bidPrice + 0.50 : tick.askPrice;
        const entry = event.side > 0 ? ask(first) : first.bidPrice;
        const ret = tick => netPerOunce(event.side, entry, event.side > 0 ? tick.bidPrice : ask(tick));
        let firstBarrier = 'neither', favorableAfterAdverse = false;
        for (const tick of ticks) {
          if (tick.timestamp > last.timestamp) break;
          const net = ret(tick);
          if (net >= event.atr && firstBarrier === 'down') favorableAfterAdverse = true;
          if (firstBarrier === 'neither' && Math.abs(net) >= event.atr) firstBarrier = net > 0 ? 'up' : 'down';
          if (tick === last) break;
        }
        return { net: ret(last), firstBarrier, favorableAfterAdverse };
      };
      outcomes.push({ id: event.id, utc: iso(from), atr: event.atr, openingDelayMs: first.timestamp - from,
        endingDelayMs: last.timestamp - from - horizon, openingSpread: first.askPrice - first.bidPrice,
        endingSpread: last.askPrice - last.bidPrice, bars: event.paths[0.5][15], fixedSpreadTicks: replay(true), quotes: replay(false) });
    }
    results.push({ period, comparison, outcomes });
  }
  writeFileSync('analysis/research-m1-behavior-ticks.json', JSON.stringify({ selection, hashes, results }, null, 2) + '\n');
  for (const row of results.flatMap(x => x.outcomes)) {
    console.log(row.utc, row.openingSpread.toFixed(3), row.bars.net.toFixed(3), row.quotes.net.toFixed(3),
      row.bars.firstBarrier, row.quotes.firstBarrier);
  }
}
