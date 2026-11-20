import assert from 'node:assert/strict';
import { loadSessions, splits, minute } from './data.mjs';
import { prepare } from './run.mjs';

const source = await loadSessions(splits.development);
let count = 0;
for (const name of ['fibonacci', 'opening', 'failed', 'vwap']) {
  const { detector, variants } = await import(`./${name}.mjs`);
  for (const session of source.sessions.filter(s => s.eligible).slice(0, 12)) {
    for (const variant of variants) {
      const make = () => detector(variant);
      const full = prepare(session, make).signals;
      for (const cutoff of new Set([...full.keys(), session.t + 600 * minute])) {
        const bars = session.bars.filter(b => b.t < cutoff);
        const prefix = prepare({ ...session, bars }, make).signals;
        assert.deepEqual([...prefix], [...full].filter(([knownAt]) => knownAt <= cutoff),
          `${name} / ${variant.id} / ${session.date} / ${cutoff}`);
        count++;
      }
    }
  }
}
console.log(`${count} closed-candle prefix comparisons passed`);
