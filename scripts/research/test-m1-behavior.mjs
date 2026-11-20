import assert from 'node:assert/strict';
import test from 'node:test';
import { minute } from './data.mjs';
import { evaluatePath, scanBehavior } from './m1-behavior-rules.mjs';

const bar = (i, o = 100, h = 100.5, l = 99.5, c = o) => ({ t: i * minute, o, h, l, c });
const index = bars => new Map(bars.map(row => [row.t, row]));

test('path preserves same-minute uncertainty and later recovery', () => {
  const bars = Array.from({ length: 31 }, (_, i) => bar(i));
  const event = { side: 1, atr: 1.2, t: 0 };
  bars[1] = bar(1, 100, 102, 98);
  assert.equal(evaluatePath(event, index(bars), 0.5)[15].firstBarrier, 'both');
  bars[1] = bar(1, 98, 102, 98);
  const observed = evaluatePath(event, index(bars), 0.5)[15];
  assert.equal(observed.firstBarrier, 'down');
  assert.equal(observed.favorableAfterAdverse, true);
});

test('terminal minute contributes its opening quote only, with side-specific spread and fees', () => {
  const bars = Array.from({ length: 31 }, (_, i) => bar(i));
  bars[5] = bar(5, 100, 110, 90);
  for (const side of [1, -1]) {
    const path = evaluatePath({ side, atr: 2, t: 0 }, index(bars), 0.5)[5];
    assert.equal(path.firstBarrier, 'neither');
    assert.equal(path.net, -0.5 - 200.5 * 0.00005);
  }
  const missing = evaluatePath({ side: 1, atr: 2, t: 0 }, index(bars.filter(b => b.t !== 6 * minute)), 0.5);
  assert.ok(missing[5]);
  assert.equal(missing[15], null);
  assert.equal(missing[30], null);
});

test('hourly levels require a complete previous hour and track the first pierce', () => {
  const bars = Array.from({ length: 423 }, (_, i) => bar(i));
  bars[420] = bar(420, 99.7, 100.5, 99.31, 100.10);
  bars[421] = bar(421, 99.7, 100.5, 99.31, 100.10);
  const scan = scanBehavior(bars, 0, 'hourly');
  const event = scan.events.find(e => e.kind === 'sweep');
  assert.equal(event.level, 99.5);
  assert.equal(event.t, 421 * minute);
  assert.deepEqual(scan.diagnostics.sweep, { raw: 2, priorPierce: 1, duplicate: 0 });
  assert.equal(scanBehavior(bars.filter(b => b.t !== 370 * minute), 0, 'hourly').events.some(e => e.kind === 'sweep'), false);
  assert.deepEqual(scanBehavior(bars.slice(0, 421), 0, 'hourly').events, scan.events.filter(e => e.t <= 421 * minute));
});
