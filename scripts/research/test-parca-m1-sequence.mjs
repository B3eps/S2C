import { test } from 'node:test';
import assert from 'node:assert/strict';
import { day, minute } from './data.mjs';
import { h1Targets, sweepDisplacementRetests, dailyReactions } from './parca-m1-liquidity-sequence.mjs';
import { scheduleEntries } from './parca-m1-rules.mjs';

const hour = 60 * minute;
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1 });

test('An H1 target is unavailable until both right candles close and a wick then consumes it', () => {
  const highs = [108, 110, 115, 111, 109];
  const bars = highs.flatMap((h, i) => Array.from({ length: 60 }, (_, m) =>
    bar(i * hour + m * minute, 100, h, 98, 100)));
  bars.push(bar(5 * hour, 111, 115, 106, 111));
  const events = [5 * hour - minute, 5 * hour, 5 * hour + minute].map(setupAt => ({ side: 1, setupAt }));
  assert.deepEqual([...h1Targets(bars, events)], [[5 * hour, { side: 1, price: 115, t: 2 * hour, knownAt: 5 * hour }]]);
  assert.equal(h1Targets(bars.filter(b => b.t !== 4 * hour), events).size, 0);
});

test('The break candle must form the actual gap and the gap must close before the retest', () => {
  const start = 8 * hour;
  const bars = [bar(start, 100, 101, 99, 100), bar(start + minute, 100, 104, 99, 103),
    bar(start + 2 * minute, 103, 104, 102, 103), bar(start + 3 * minute, 103, 104, 101.5, 103),
    bar(start + 4 * minute, 103, 104, 102.5, 103.5)];
  const session = { t: 0, bars };
  const e = { side: 1, setupAt: start + 2 * minute, atr: 1.5, sweep: true, stopBid: 98, targetBid: 109 };
  const scan = { events: [e], contextByClose: new Map(bars.map(b => [b.t + minute, { m1: 1, m15: 1 }])) };
  const out = sweepDisplacementRetests(session, scan);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].displacementZone, { lo: 101, hi: 102, knownAt: start + 3 * minute });
  assert.equal(out[0].setupAt, start + 4 * minute);
  assert.equal(sweepDisplacementRetests({ ...session, bars: bars.slice(0, 3) }, scan).length, 0);
  assert.equal(sweepDisplacementRetests({ ...session, bars: bars.filter(b => b.t !== start + 2 * minute) }, scan).length, 0);
  assert.equal(sweepDisplacementRetests({ ...session, bars: bars.map((b, i) => i === 3 ? { ...b, l: 97 } : b) }, scan).length, 0);
  const entry = scheduleEntries(session, { ...scan, events: out }, 'swing-control', 0.20, 0.005);
  assert.deepEqual([...entry.signals.keys()], [start + 4 * minute]);
});

test('An opening quote beyond the target or at the stop must not generate an order', () => {
  const signal = bar(0, 100, 102, 99, 101);
  const setup = { side: 1, setupAt: minute, targetBid: 104, stopBid: 99 };
  const run = open => scheduleEntries({ bars: [signal, bar(minute, open, open, open, open)] },
    { events: [setup] }, 'swing-control', 0.20, 0.005);
  assert.equal(run(104.1).signals.size, 0);
  assert.equal(run(99).signals.size, 0);
  assert.equal(run(101).signals.size, 1);
});

test('A daily FVG requires a completed prior candle and a separate retest after inversion', () => {
  const start = 3 * day;
  const days = [
    { t: 0, knownAt: day, h: 101, l: 97, c: 100 },
    { t: day, knownAt: 2 * day, h: 104, l: 100, c: 103 },
    { t: 2 * day, knownAt: start, h: 106, l: 103, c: 105 },
  ];
  const bars = [bar(start, 104, 104, 102, 103.5), bar(start + minute, 103, 103, 99, 100),
    bar(start + 2 * minute, 100, 102, 100, 101)];
  const events = [1, -1, -1].map((side, i) => ({ side, setupAt: start + (i + 1) * minute }));
  const selected = dailyReactions(days, bars, events, start);
  assert.deepEqual(selected.map(x => x.setupAt), [start + minute, start + 3 * minute]);
  assert.equal(selected[1].daily.flipped, true);
  assert.throws(() => dailyReactions([...days, { knownAt: start + day }], bars, events, start), /open day/);
});
