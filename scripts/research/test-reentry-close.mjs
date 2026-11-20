import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { splits, loadSessions } from './data.mjs';
import { detector as archived } from './failed.mjs';

// Diagnostic hypothesis, declared before executing results:
// one close at least 0.50 ATR inside the breached channel can substitute
// for waiting an additional 1–3 bars. Test only the already-seen periods.
const root = 'arastirma-hafizasi/deneyler/';
const lock = JSON.parse(readFileSync(root + '03-basarisiz-kirilim-kural-kilidi.json', 'utf8'));
for (const [file, sha] of Object.entries(lock)) {
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), sha, file);
}
const runner = new URL('./run.mjs', import.meta.url);
const hook = registerHooks({
  load(url, context, nextLoad) {
    const r = nextLoad(url, context);
    return url === runner.href ? { ...r, source: String(r.source) + '\nexport { experiment };' } : r;
  },
});
const { experiment } = await import(runner);
hook.deregister();

function strongerClose() {
  const detect = archived({ confirm: false });
  return (history, atr, start) => {
    const signal = detect(history, atr, start);
    if (!signal) return;
    const sign = signal.side === 'long' ? 1 : -1;
    const edge = sign > 0 ? signal.context.low : signal.context.high;
    if (sign * (history.at(-1).c - edge) >= 0.5 * signal.context.atr) return signal;
  };
}

const output = {};
for (const [split, dates] of Object.entries(splits)) {
  const data = await loadSessions(dates);
  const archive = JSON.parse(readFileSync(`analysis/research-failed-${split}.json`, 'utf8'));
  assert.equal(archive.source.hash, data.hash);
  const base = experiment(data, () => archived({ confirm: false }), archive.spread);
  assert.deepEqual(JSON.parse(JSON.stringify(base)), archive.results.reentry);
  const result = experiment(data, strongerClose, archive.spread);
  output[split] = { dates, hash: data.hash, base: base.conservative.summary, result };
  console.log(split, result.conservative.summary.n, result.conservative.summary.expectancy,
    result.conservative.summary.expectationCI);
}
writeFileSync('analysis/research-reentry-stronger-close.json', JSON.stringify(output) + '\n');
