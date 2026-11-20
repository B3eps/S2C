import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { getHistoricalRates } from 'dukascopy-node';
import { mkdir } from 'node:fs/promises';

async function load(path) {
  const built = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
}
const [market, parca] = await Promise.all([load('src/lib/market.ts'), load('src/lib/parcaSetup.ts')]);
const MIN = 60_000;
const TF = { '1m': MIN, '5m': 5 * MIN, '15m': 15 * MIN, '1h': 60 * MIN, '4h': 240 * MIN };
function synthetic(from, count) {
  let seed = 7, price = 2000, drift = 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [];
  for (let i = 0, t = from; out.length < count; i++, t += MIN) {
    if (market.isClosed(t)) continue;
    if (i % 45 === 0) drift = (rnd() - 0.5) * 1.6;
    const o = price + (rnd() - 0.5) * 0.04;
    const c = o + drift * rnd() + (rnd() - 0.5) * 0.9;
    out.push({ t, o, h: Math.max(o, c) + rnd() * 0.3, l: Math.min(o, c) - rnd() * 0.3, c, v: 1 });
    price = c;
  }
  return out;
}
function aggregate(bars, ms) {
  const out = [];
  for (const b of bars) {
    const t = Math.floor(b.t / ms) * ms, last = out.at(-1);
    if (last?.t === t) {
      last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l);
      last.c = b.c; last.v += b.v;
    } else out.push({ ...b, t });
  }
  return out;
}
const minutes = synthetic(Date.UTC(2024, 10, 3, 23), 9000);
const bars = Object.fromEntries(Object.entries(TF).map(([tf, ms]) => [tf, aggregate(minutes, ms)]));
const signals = parca.analyzeParcaSetup({
  tf: '5m', bars: bars['5m'], clock: minutes.at(-1).t + MIN,
  series: bars, days: market.dailyBars(bars['1h']),
}).marks.filter((m) => m.kind === 'signal');
const goldSignals = parca.analyzeParcaSetup({
  tf: '5m', bars: bars['5m'], clock: minutes.at(-1).t + MIN,
  series: bars, days: market.dailyBars(bars['1h']),
  params: { pivot: 3, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 1, session: 1 },
}).marks.filter((m) => m.kind === 'signal');
console.log(`Synthetic signals: classic ${signals.length}, Gold ${goldSignals.length}.`);
const signal = signals.find((m) => m.t > minutes[5000].t && m.t < minutes[8500].t);
assert.ok(signal, 'test için 5dk Parça sinyali gerekli');
const start = signal.t - 10 * MIN;
const close = signal.t + TF['5m'];

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.S2C_BROWSER || 'chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/candles?**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    const tf = q.get('tf');
    const from = Number(q.get('from')), to = Number(q.get('to'));
    const rows = bars[tf].filter((b) => b.t >= from && b.t < to)
      .map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]);
    return route.fulfill({ json: rows });
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Panel', exact: true }).waitFor();
  await page.evaluate(async (at) => {
    const db = await import('/src/lib/db.ts');
    const { DEFAULT_RULES } = await import('/src/lib/types.ts');
    const { propDay } = await import('/src/lib/programs.ts');
    const setupId = window.__s2c.getState().activeSetupId;
    await db.store.putAccount({ id: 'pause-account', setupId, no: 'S2C-1', status: 'active', phase: 'challenge', size: 5000,
      balance: 5000, createdAt: at, rules: DEFAULT_RULES, tradingDays: [], payouts: [] });
    await db.store.putSession({ id: 'pause-session', setupId, accountId: 'pause-account', startMs: at, clockMs: at,
      startedAt: at, dayKey: propDay(at), dayStartEquity: 5000, firstPrice: 2000,
      orders: [], positions: [], drawings: [] });
    localStorage.setItem('s2c:view', 'trade');
  }, start);
  await page.reload();
  await page.waitForFunction(() => window.__s2c?.getState().session?.id === 'pause-session');
  const variants = await page.evaluate(() => window.__s2c.getState().prefs.panes[0].ind.map((ind) => ind.id));
  assert.ok(variants.includes('parca-setup') && variants.includes('parca-setup-gold'));
  await page.evaluate(() => window.__s2c.getState().setPrefs({ speed: 5 }));
  await page.getByTitle('Oynat').click();
  await page.waitForFunction((target) => {
    const s = window.__s2c.getState();
    return !s.playing && s.live.clock === target;
  }, close, { timeout: 30_000 });
  assert.match(await page.locator('.toast').first().textContent(), /Parça (Klasik|Gold) (AL|SAT) sinyali/);
  assert.equal(await page.locator('.chart-overlay svg text').filter({ hasText: /FVG|MSP|\bOB\b|STOP/ }).count(), 0);
  await page.locator('.side-btn.long').click();
  await page.getByRole('button', { name: 'Long aç' }).click();
  const opened = await page.evaluate(() => {
    const s = window.__s2c.getState();
    return { playing: s.playing, clock: s.live.clock, positions: s.session.positions.length };
  });
  assert.deepEqual(opened, { playing: false, clock: close, positions: 1 });
  const realRows = await getHistoricalRates({
    instrument: 'xauusd', dates: { from: new Date('2026-08-11T00:00:00Z'), to: new Date('2026-08-21T00:00:00Z') },
    timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true,
    useCache: true, cacheFolderPath: '.cache/dukascopy',
  });
  const realMinutes = realRows.map((r) => ({ t: r.timestamp, o: r.open, h: r.high, l: r.low, c: r.close, v: r.volume ?? 0 }));
  const realBars = Object.fromEntries(Object.entries(TF).map(([tf, ms]) => [tf, aggregate(realMinutes, ms)]));
  const goldParams = { pivot: 3, window: 6, zoneAge: 60, minGap: 0.45, biasMode: 2, sweep: 2, session: 1 };
  const goldSignal = parca.analyzeParcaSetup({
    tf: '5m', bars: realBars['5m'], clock: realMinutes.at(-1).t + MIN,
    series: realBars, days: market.dailyBars(realBars['1h']),
    params: goldParams,
  }).marks.find((m) => m.kind === 'signal' && m.t === Date.parse('2026-08-20T18:15:00Z'));
  assert.ok(goldSignal, 'cached Gold signal required');
  const goldStart = goldSignal.t - 10 * MIN;
  const goldClose = goldSignal.t + TF['5m'];
  const goldPage = await browser.newPage();
  goldPage.on('pageerror', (error) => errors.push(error.message));
  await goldPage.route('**/api/candles?**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    const tf = q.get('tf'), from = Number(q.get('from')), to = Number(q.get('to'));
    return route.fulfill({ json: realBars[tf].filter((b) => b.t >= from && b.t < to)
      .map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]) });
  });
  await goldPage.goto(server.resolvedUrls.local[0]);
  await goldPage.getByRole('button', { name: 'Panel', exact: true }).waitFor();
  await goldPage.evaluate(async (at) => {
    const db = await import('/src/lib/db.ts');
    const { DEFAULT_RULES } = await import('/src/lib/types.ts');
    const { propDay } = await import('/src/lib/programs.ts');
    const setupId = window.__s2c.getState().activeSetupId;
    await db.store.putAccount({ id: 'gold-account', setupId, no: 'S2C-1', status: 'active', phase: 'challenge', size: 5000,
      balance: 5000, createdAt: at, rules: DEFAULT_RULES, tradingDays: [], payouts: [] });
    await db.store.putSession({ id: 'gold-session', setupId, accountId: 'gold-account', startMs: at, clockMs: at,
      startedAt: at, dayKey: propDay(at), dayStartEquity: 5000, firstPrice: 4000,
      orders: [], positions: [], drawings: [] });
    localStorage.setItem('s2c:view', 'trade');
  }, goldStart);
  await goldPage.reload();
  await goldPage.waitForFunction(() => window.__s2c?.getState().session?.id === 'gold-session');
  await goldPage.evaluate(() => window.__s2c.getState().setPrefs({ speed: 5 }));
  await goldPage.getByTitle('Oynat').click();
  await goldPage.waitForFunction((target) => {
    const s = window.__s2c.getState();
    return !s.playing && s.live.clock === target;
  }, goldClose, { timeout: 30_000 });
  assert.match(await goldPage.locator('.toast').first().textContent(), /Parça Gold (AL|SAT) sinyali/);
  await goldPage.locator('.chart-overlay svg text').filter({ hasText: 'Gold TP' }).first().waitFor();
  assert.equal(await goldPage.locator('.chart-overlay svg text').filter({ hasText: /FVG|MSP|\bOB\b|STOP/ }).count(), 0);
  await mkdir('output/playwright', { recursive: true });
  await goldPage.screenshot({ path: 'output/playwright/parca-classic-gold.png' });
  const minuteSignals = parca.analyzeParcaSetup({
    tf: '1m', bars: realBars['1m'], clock: realMinutes.at(-1).t + MIN,
    series: realBars, days: market.dailyBars(realBars['1h']), params: goldParams,
  }).marks.filter((m) => m.kind === 'signal' && m.t > Date.parse('2026-08-14T00:00:00Z'));
  const minuteSignal = minuteSignals.find((m, i) => i === 0 || m.t - minuteSignals[i - 1].t >= 60 * MIN);
  assert.ok(minuteSignal, 'cached 1m Gold signal required');
  const seekStart = minuteSignal.t - 30 * MIN;
  const seekClose = minuteSignal.t + MIN;
  const seekPage = await browser.newPage();
  seekPage.on('pageerror', (error) => errors.push(error.message));
  await seekPage.route('**/api/candles?**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    const tf = q.get('tf'), from = Number(q.get('from')), to = Number(q.get('to'));
    return route.fulfill({ json: realBars[tf].filter((b) => b.t >= from && b.t < to)
      .map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]) });
  });
  await seekPage.goto(server.resolvedUrls.local[0]);
  await seekPage.getByRole('button', { name: 'Panel', exact: true }).waitFor();
  await seekPage.evaluate(async (at) => {
    const db = await import('/src/lib/db.ts');
    const { DEFAULT_RULES } = await import('/src/lib/types.ts');
    const { propDay } = await import('/src/lib/programs.ts');
    const setupId = window.__s2c.getState().activeSetupId;
    await db.store.putAccount({ id: 'seek-account', setupId, no: 'S2C-1', status: 'active', phase: 'challenge', size: 5000,
      balance: 5000, createdAt: at, rules: DEFAULT_RULES, tradingDays: [], payouts: [] });
    await db.store.putSession({ id: 'seek-session', setupId, accountId: 'seek-account', startMs: at, clockMs: at,
      startedAt: at, dayKey: propDay(at), dayStartEquity: 5000, firstPrice: 4000,
      orders: [], positions: [], drawings: [] });
    localStorage.setItem('s2c:view', 'trade');
  }, seekStart);
  await seekPage.reload();
  await seekPage.waitForFunction(() => window.__s2c?.getState().session?.id === 'seek-session');
  await seekPage.evaluate(() => {
    const s = window.__s2c.getState();
    const panes = s.prefs.panes.map((pane, i) => i === 0
      ? { ...pane, tf: '1m', ind: pane.ind.filter((ind) => ind.id === 'parca-setup-gold') }
      : pane);
    s.setPrefs({ panes, speed: 1 });
  });
  assert.equal(await seekPage.getByRole('button', { name: '32×' }).count(), 0);
  await seekPage.getByRole('button', { name: 'Sinyale ilerle' }).click();
  await seekPage.waitForFunction((target) => {
    const s = window.__s2c.getState();
    return !s.seekingSignal && s.live.clock === target;
  }, seekClose, { timeout: 60_000 });
  assert.match(await seekPage.locator('.toast').first().textContent(), /Parça Gold (AL|SAT) sinyali bulundu/);
  assert.equal((await seekPage.evaluate(() => window.__s2c.getState().session.positions.length)), 0);
  assert.deepEqual(errors, []);
  console.log(`Classic and Gold replay paused on signal closes; 1m seek found a Gold signal after ${Math.round((seekClose - seekStart) / MIN)} minutes; a manual order opened without advancing time.`);
} finally {
  await browser?.close();
  await server.close();
}
