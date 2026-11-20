import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { getHistoricalRates } from 'dukascopy-node';
import { cache, day, minute, loadSessions } from './data.mjs';
import { scanSession, scheduleEntries } from './parca-m1-rules.mjs';

// One post-historical hypothesis: a directionally valid M1 trigger has more
// room to continue after a recent return into a pre-existing M15 FVG.
const root = 'arastirma-hafizasi/deneyler/';
const ruleLock = JSON.parse(readFileSync(root + '10-parca-m1-kural-kilidi.json', 'utf8'));
for (const [file, sha256] of Object.entries(ruleLock.fingerprints)) {
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), sha256);
}
const runner = new URL('./run.mjs', import.meta.url);
const hook = registerHooks({ load(url, context, nextLoad) {
  const r = nextLoad(url, context);
  return url === runner.href ? { ...r, source: String(r.source) + '\nexport { play, summarize, DEFAULT_SPREAD, rules };' } : r;
} });
const { play, summarize, DEFAULT_SPREAD, rules } = await import(runner);
hook.deregister();

const width = 15 * minute;
export function withM15Poi(bars, events) {
  const byClose = new Map();
  let block, recent = [], zones = [], prev;
  for (const b of bars) {
    if (prev && b.t - prev.t !== minute) {
      block = undefined;
      recent = [];
      zones = [];
    }
    prev = b;
    const now = b.t + minute;
    zones = zones.filter(z => now - z.formed <= 180 * minute &&
      (z.side > 0 ? b.c >= z.low : b.c <= z.high));
    for (const z of zones) {
      if (b.h >= z.low && b.l <= z.high && z.side * (b.c - (z.high + z.low) / 2) > 0) z.touched = now;
    }
    const bucket = Math.floor(b.t / width) * width;
    if (!block || block.t !== bucket) block = { t: bucket, l: b.l, h: b.h, n: 1 };
    else { block.n++; block.l = Math.min(block.l, b.l); block.h = Math.max(block.h, b.h); }
    if (now === bucket + width && block.n === 15) {
      const first = recent.at(-2);
      if (first && bucket - first.t === 2 * width) {
        if (block.l - first.h >= 0.20) zones.push({ formed: now, low: first.h, high: block.l, side: 1 });
        if (first.l - block.h >= 0.20) zones.push({ formed: now, low: block.h, high: first.l, side: -1 });
      }
      recent = [...recent.slice(-1), block];
    }
    byClose.set(now, zones.filter(z => now - (z.touched ?? -Infinity) <= 15 * minute).map(z => ({ ...z })));
  }
  return events.flatMap(e => {
    const zone = byClose.get(e.setupAt)?.filter(z => z.side === e.side).at(-1);
    return zone ? [{ ...e, m15Poi: zone }] : [];
  });
}

const archive = JSON.parse(readFileSync('analysis/research-parca-m1-historical.json', 'utf8'));
const result = {};
let prefixChecks = 0;
for (const [name, archived] of Object.entries(archive.rawOutput)) {
  const source = await loadSessions(archived.period);
  assert.equal(source.hash, archived.hash);
  const cached = [];
  for (const session of source.sessions.filter(s => s.eligible)) {
    const rows = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(session.t), to: new Date(session.t + day) },
      timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: cache });
    const bars = rows.map(({ timestamp: t, open: o, high: h, low: l, close: c, volume: v }) => ({ t, o, h, l, c, v }));
    const scan = scanSession(bars, session.t);
    const events = withM15Poi(bars, scan.events);
    if (cached.length < 4) {
      for (const minutes of [600, 720, 900]) {
        const cutoff = session.t + minutes * minute;
        const prefix = bars.filter(b => b.t < cutoff);
        assert.deepEqual(withM15Poi(prefix, scanSession(prefix, session.t).events), events.filter(e => e.setupAt <= cutoff));
        prefixChecks++;
      }
    }
    cached.push({ session, scan, events });
  }
  result[name] = {};
  for (const type of ['fvg-retest', 'ifvg-double']) {
    const run = (filtered, spread) => play(cached.map(({ session, scan, events }) =>
      scheduleEntries(session, filtered ? { ...scan, events } : scan, type, spread, rules.commissionPct)), 'conservative', false, spread);
    const reference = run(false, DEFAULT_SPREAD);
    assert.deepEqual(JSON.parse(JSON.stringify(reference.trades)), archived.outputs[type].trades);
    const nominal = run(true, DEFAULT_SPREAD);
    const spread = run(true, 0.50);
    result[name][type] = { summary: summarize(nominal), stress: summarize(spread), trades: nominal.trades, daily: nominal.daily };
    const s = result[name][type].summary;
    console.log(name, type, s.n, s.net.toFixed(2), s.expectancy?.toFixed(2));
  }
}
writeFileSync('analysis/research-parca-m1-poi.json', JSON.stringify({ prefixChecks, result }) + '\n');
