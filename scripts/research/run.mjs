import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { day, minute, splits, holdouts, loadSessions } from './data.mjs';

const bundle = await build({ entryPoints: ['scripts/research/s2c.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const s2c = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { accountLimits, maximumLossFloor, countedDays, PROGRAMS, propDay, entryPrice, markPrice, equityAt, tradePnl,
  riskLots, maxLotsFor, conservativeCandle, simulateCandle, DEFAULT_SPREAD } = s2c;
const rules = PROGRAMS.find(p => p.id === 'ftm-infinity-plus').rules;
const size = 5000;
const commission = rules.commissionPct;
const paths = ['conservative', 'high-first', 'low-first'];

export function prepare(session, detector, startOffset = 420) {
  let history = [], ranges = [], detect = detector(), previous;
  const signals = new Map();
  for (const b of session.bars) {
    if (b.t >= session.t + 1140 * minute) break;
    if (previous && previous.t + minute !== b.t) {
      history = [];
      ranges = [];
      detect = detector();
    }
    const atr = ranges.length === 20 ? ranges.reduce((sum, value) => sum + value, 0) / 20 : undefined;
    const prior = history.at(-1)?.c ?? b.o;
    history.push(b);
    const signal = detect(history, atr, session.t);
    if (signal && b.t >= session.t + startOffset * minute && b.t + minute < session.t + 1020 * minute) {
      signals.set(b.t + minute, { ...signal, knownAt: b.t + minute });
    }
    ranges.push(Math.max(b.h - b.l, Math.abs(b.h - prior), Math.abs(b.l - prior)));
    if (ranges.length > 20) ranges.shift();
    previous = b;
  }
  return { ...session, signals };
}

function play(sessions, mode, limited, spread) {
  const account = { size, balance: size, peak: size, rules, tradingDays: [], dayPnl: {}, payouts: [] };
  const trades = [], daily = [];
  let position, equityPeak = size, balancePeak = size, worstBelowPeak = 0, closedDD = 0;
  let status = 'active', breaches, statusDate, skipped = 0, gapsExposed = 0, prior;
  for (const session of sessions) {
    const { bars, signals, date, t } = session;
    const before = account.balance;
    const dayStartEquity = before;
    const close = (price, reason, stamp) => {
      const pnl = tradePnl(position, price, commission);
      account.balance += pnl;
      account.peak = Math.max(account.peak, account.balance);
      equityPeak = Math.max(equityPeak, account.balance);
      balancePeak = Math.max(balancePeak, account.balance);
      closedDD = Math.max(closedDD, balancePeak - account.balance);
      worstBelowPeak = Math.max(worstBelowPeak, equityPeak - account.balance);
      trades.push({ ...position, exit: price, reason, closedAt: stamp, pnl, r: pnl / position.plannedRisk });
      position = undefined;
    };
    for (const b of bars) {
      if (b.t >= t + day) throw new Error('Out-of-session execution');
      if (position && prior && b.t - prior.t > minute) gapsExposed++;
      const lim = accountLimits(account, { dayStartEquity });
      const walk = (candle, openOnly = false) => {
        const book = {
          balance: account.balance, peak: account.peak, positions: [position], orders: [],
          spread, commissionPct: commission, leverage: rules.goldLeverage,
          dayFloor: limited ? lim.dayFloor : -Infinity,
          maxFloor: peak => limited ? maximumLossFloor(account, peak) : -Infinity,
        };
        const result = mode === 'conservative' ? conservativeCandle(book, candle) : simulateCandle(book, candle, mode);
        worstBelowPeak = Math.max(worstBelowPeak, equityPeak - result.worst);
        equityPeak = Math.max(equityPeak, result.closeEquity);
        for (const event of result.events) close(event.price, event.reason, b.t + (openOnly ? 0 : minute));
        if (result.breach) {
          status = 'violated';
          statusDate = date;
          breaches = result.breach.floor;
        }
      };
      let exitedAtOpen = false;
      if (position && (b.t >= t + 1140 * minute || b.t - position.openedAt >= 120 * minute)) {
        walk({ ...b, h: b.o, l: b.o, c: b.o }, true);
        if (position) close(markPrice(position.side, b.o, spread), 'time', b.t);
        exitedAtOpen = true;
        if (limited && status === 'active' && account.balance < Math.max(lim.dayFloor, lim.maxFloor) - 1e-8) {
          status = 'violated';
          statusDate = date;
          breaches = lim.dayFloor >= lim.maxFloor ? 'day' : 'max';
        }
      }
      const signal = signals.get(b.t);
      if (!position && !exitedAtOpen && signal && status === 'active') {
        const { side, stopBid, rr, context, knownAt } = signal;
        const sign = side === 'long' ? 1 : -1;
        const entry = entryPrice(side, b.o, spread);
        const sl = markPrice(side, stopBid, spread);
        const distance = sign * (entry - sl);
        const riskPerOz = distance + (entry + sl) * commission / 100;
        const lots = Math.min(riskLots(25, riskPerOz), maxLotsFor(account.balance, entry, rules.goldLeverage));
        if (sign * (markPrice(side, b.o, spread) - sl) > 0 && distance >= 1 && lots >= 0.01) {
          position = { id: String(b.t), side, lots, entry, sl, tp: entry + sign * rr * distance,
            orderType: 'market', openedAt: b.t, knownAt, plannedRisk: -tradePnl({ side, lots, entry }, sl, commission), context };
          const key = propDay(b.t);
          if (!account.tradingDays.includes(key)) account.tradingDays.push(key);
        } else skipped++;
      }
      if (position && status === 'active') walk(b);
      if (limited && status === 'active' && !position && account.balance >= lim.target && countedDays(account) >= rules.minDays) {
        status = 'passed';
        statusDate = date;
      }
      prior = b;
      if (status !== 'active') break;
    }
    daily.push({ date, pnl: account.balance - before, balance: account.balance });
    if (status !== 'active') break;
  }
  if (position) throw new Error('Position left open at the end of the session');
  return { status, statusDate, breaches, balance: account.balance, trades, daily,
    worstBelowPeak, closedDD, skipped, gapsExposed };
}

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.floor(p * (sorted.length - 1))] : null;
}

function summarize(run) {
  const { trades, daily, balance, worstBelowPeak, closedDD, skipped, gapsExposed } = run;
  const winners = trades.filter(t => t.pnl > 0), losers = trades.filter(t => t.pnl < 0);
  const sum = ts => ts.reduce((s, t) => s + t.pnl, 0);
  const won = sum(winners), lost = sum(losers);
  const n = trades.length, p = n ? winners.length / n : 0, z = 1.96;
  const center = n ? (p + z * z / (2 * n)) / (1 + z * z / n) : 0;
  const half = n ? z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / (1 + z * z / n) : 0;
  const byDate = new Map(daily.map(d => [d.date, { pnl: d.pnl, trades: 0 }]));
  for (const trade of trades) byDate.get(propDay(trade.openedAt)).trades++;
  const clusters = [...byDate.values()];
  let state = 92107;
  const boot = [];
  for (let i = 0; i < 2000 && n; i++) {
    let samplePnl = 0, sampleTrades = 0;
    for (const _ of clusters) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const sample = clusters[Math.floor(state / 2 ** 32 * clusters.length)];
      samplePnl += sample.pnl;
      sampleTrades += sample.trades;
    }
    if (sampleTrades) boot.push(samplePnl / sampleTrades);
  }
  boot.sort((a, b) => a - b);
  const days = daily.map(d => d.pnl).sort((a, b) => a - b);
  return { n, wins: winners.length, losses: losers.length, flat: n - winners.length - losers.length,
    winRate: n ? p : null, winCI: n ? [center - half, center + half] : null,
    averageWin: winners.length ? won / winners.length : null, averageLoss: losers.length ? lost / losers.length : null,
    net: balance - size, expectancy: n ? (won + lost) / n : null, expectationCI: n ? [percentile(boot, .025), percentile(boot, .975)] : null,
    profitFactor: lost ? -won / lost : null, worstBelowPeak, closedDD, skipped, gapsExposed,
    dayCount: days.length, avgDay: days.length ? (balance - size) / days.length : null,
    medianDay: percentile(days, .5), worstDay: days[0], bestDay: days.at(-1),
    upDays: days.filter(d => d > 1e-8).length, downDays: days.filter(d => d < -1e-8).length,
    flatDays: days.filter(d => Math.abs(d) <= 1e-8).length, hundredDays: days.filter(d => d >= 100).length };
}

function experiment(data, detector, spread) {
  const prepared = data.sessions.filter(s => s.eligible).map(s => prepare(s, detector));
  const runs = {};
  for (const path of paths) {
    const raw = play(prepared, path, false, spread);
    const windows = [5, 20].map(length => {
      const accounts = [];
      for (let i = 0; i + length <= prepared.length; i += length) {
        const slice = prepared.slice(i, i + length);
        const run = play(slice, path, true, spread);
        accounts.push({ from: slice[0].date, through: slice.at(-1).date, status: run.status, statusDate: run.statusDate,
          breach: run.breaches, balance: run.balance, trades: run.trades.length });
      }
      return { length, accounts, leftover: prepared.length % length };
    });
    runs[path] = { summary: summarize(raw), trades: raw.trades, daily: raw.daily, windows };
  }
  return runs;
}

const shared = ['scripts/research/run.mjs', 'scripts/research/data.mjs', 'scripts/research/s2c.ts',
  'src/lib/execution.ts', 'src/lib/programs.ts', 'src/lib/types.ts', 'src/lib/accountRules.ts',
  'arastirma-hafizasi/deneyler/donem-kaydi.md'];
const strategies = {
  fib: ['fibonacci', '01-fibonacci'],
  opening: ['opening', '02-acilis-araligi'],
  failed: ['failed', '03-basarisiz-kirilim'],
  vwap: ['vwap', '04-vwap-donusu'],
};

function fingerprint(files) {
  return Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
}

async function main() {
  const [strategy, split] = process.argv.slice(2);
  if (!Object.hasOwn(strategies, strategy) || !['development', 'validation', 'freeze', 'test'].includes(split)) {
    throw new Error('Usage: node scripts/research/run.mjs fib|opening|failed|vwap development|validation|freeze|test');
  }
  const [module, document] = strategies[strategy];
  const lock = `arastirma-hafizasi/deneyler/${document}-kural-kilidi.json`;
  const files = [...shared, `scripts/research/${module}.mjs`, `arastirma-hafizasi/deneyler/${document}-protokol.md`];
  if (split === 'freeze') {
    writeFileSync(lock, JSON.stringify(fingerprint(files), null, 2) + '\n', { flag: 'wx' });
    return;
  }
  if (split === 'test') {
    const expected = JSON.parse(readFileSync(lock, 'utf8'));
    for (const [file, hash] of Object.entries(fingerprint(files))) {
      if (expected[file] !== hash) throw new Error(`Frozen rules changed: ${file}`);
    }
  }
  const { detector, variants } = await import(`./${module}.mjs`);
  const data = await loadSessions(split === 'test' ? holdouts[strategy] : splits[split]);
  const { sessions, ...source } = data;
  const coverage = sessions.map(({ date, missing, eligible }) => ({ date, missing, eligible }));
  const results = {};
  for (const variant of variants) results[variant.id] = experiment(data, () => detector(variant), DEFAULT_SPREAD);
  const out = { strategy, split, source, coverage, spread: DEFAULT_SPREAD, rules, results };
  const report = `analysis/research-${strategy}-${split}.json`;
  writeFileSync(report, JSON.stringify(out) + '\n');
  console.log(report);
  for (const [variant, result] of Object.entries(results)) {
    const { n, net, winRate, expectancy } = result.conservative.summary;
    console.log(variant, { n, net, winRate, expectancy });
  }
}

if (process.argv[1]?.endsWith('run.mjs')) await main();
