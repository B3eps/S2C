// Runs the real S2C app/store in a clean throw-away profile: 1m Parça Gold A+ strategy,
// actual account rules, orders, SL/TP, fees, violations and full-balance payout requests.
//   node scripts/account-1m-sim.mjs
// Env: ACCOUNTS (default 200) · RISK (% per trade, default 0.5) · MAX_HOURS (default 6)
//      MAXDAYS (per historical window, default 30) · NET_TARGET (user payout target, default $200)
// Output: analysis/account-1m-ftm-plus-5000.jsonl and account-1m run log.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const FAST = !!process.env.FAST;
const PER = Number(process.env.ACCOUNTS ?? (FAST ? 1 : 200));
const RISK = Number(process.env.RISK ?? 0.5);
const SIZE = 5000;
const PRESET = process.env.PRESET ?? 'aplus';
if (!['aplus', 'gold', 'classic'].includes(PRESET)) throw new Error('PRESET must be aplus, gold, or classic');
if (!['aplus', 'gold'].includes(PRESET)) throw new Error('PRESET must be aplus or gold');
const MAXDAYS = Number(process.env.MAXDAYS ?? (FAST ? 4 : 30));
const NET_TARGET = Number(process.env.NET_TARGET ?? 200);
const MAX_MS = Number(process.env.MAX_HOURS ?? 6) * 3600e3;
const PROGRAM_ID = 'ftm-infinity-plus';
const RUN_TAG = process.env.RUN_TAG ?? new Date().toISOString().replace(/[:.]/g, '-');
const OUT = 'analysis';
fs.mkdirSync(OUT, { recursive: true });
const FILE = `${OUT}/account-1m-ftm-plus-5000-${PRESET}-${RUN_TAG}.jsonl`;
fs.writeFileSync(FILE, '');
const LOG = `${OUT}/account-1m-ftm-plus-5000-${PRESET}-${RUN_TAG}.log`;
fs.writeFileSync(LOG, '');
const log = (...a) => { const s = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.error(s); fs.appendFileSync(LOG, s + '\n'); };

// session starts: Tuesday 03:00 UTC of periods whose candles are already cached on this machine
const DAY = 86_400_000;
const PERIOD_STARTS = ['2024-05-14', '2024-06-04', '2024-07-02', '2024-09-17', '2024-10-22', '2024-11-05', '2025-01-02', '2025-02-11', '2025-03-04', '2025-04-08', '2025-05-20', '2025-08-05', '2025-09-16', '2025-10-07', '2025-11-18', '2026-02-17', '2026-04-07', '2026-05-12', '2026-06-02']
  .map((d) => Date.parse(`${d}T03:00:00Z`));
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 5176, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.S2C_BROWSER || 'chrome' });
  const context = await browser.newContext(); // fresh profile: no accounts, no journal, no settings
  const page = await context.newPage();
  await page.exposeFunction('__simProgress', (s) => log(s));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Panel', exact: true }).waitFor();
  const clean = await page.evaluate(() => { const s = window.__s2c.getState(); return [s.accounts.length, s.trades.length, s.sessions.length]; });
  assert.deepEqual(clean, [0, 0, 0], 'profil temiz değil');
  log('temiz profil, hesap/işlem/seans: 0/0/0');

  // the bot lives in the page, next to the app's own store
  await page.evaluate(() => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__runAccount = async (cfg) => {
      const [st, ps, pv, cal, mk, types, prog] = await Promise.all([import('/src/store.ts'), import('/src/lib/parcaSetup.ts'), import('/src/lib/parcaVariants.ts'), import('/src/lib/calendar.ts'), import('/src/lib/market.ts'), import('/src/lib/types.ts'), import('/src/lib/programs.ts')]);
      const S = window.__s2c;
      const MIN = 60000, H = 3600000, DAY = 86400000;
      S.getState().setPane(0, { tf: '1m', ind: [] });
      const params = cfg.preset === 'gold' ? pv.GOLD_SETUP_DEFAULTS : cfg.preset === 'classic' ? ps.SETUP_DEFAULTS : pv.GOLD_A_SETUP_DEFAULTS;
      const forced = async (startMs, fn) => {
        // randomStart() = lo + Math.random()*(hi-lo): hand it the fraction of the wanted minute
        const lo = Date.now() - 3 * 365 * DAY, hi = Date.now() - 14 * DAY;
        const frac = (startMs - lo) / (hi - lo), real = Math.random;
        Math.random = () => frac;
        try { await fn(); } finally { Math.random = real; }
      };
      const out = { programId: cfg.programId, size: cfg.size, starts: [], periodSequence: 'forward-only, non-overlapping sampled windows; gaps not replayed', events: [], trades: [], stepEnds: [], payouts: [], skipped: 0, signals: 0 };
      const ctxByOpen = new Map();
      const optimizedFeeds = new WeakSet();
      let startIdx = 0;
      let progressDay = -1;
      await forced(cfg.starts[startIdx++], () => S.getState().createAccount(cfg.size, cfg.programId));
      const accId = S.getState().accounts[0].id;
      const acc = () => S.getState().accounts.find((x) => x.id === accId);
      out.fee = acc().fee; out.rules = acc().rules;
      const begin = () => { out.starts.push(S.getState().session?.startMs); return ps.createSetupEngine('1m', params); };
      let engine = begin(), lastBucket = -1, stall = 0, reason = 'bitmedi';
      const ahead = (feed, mark) => {
        // protective / blocking levels around the entry, causal: prev day, Asia, London, 4h swings, round numbers
        const t = mark.t, long = mark.side === 'long', L = [];
        const days = feed.days(), end = mk.dayStart(t) + DAY, di = days.findIndex((x) => x.end === end);
        if (di > 0) L.push({ p: days[di - 1].h, k: 'önceki gün' }, { p: days[di - 1].l, k: 'önceki gün' });
        const ds = mk.dayStart(t), r = { asia: null, london: null };
        for (const b of feed.bars('5m')) { if (b.t < ds) continue; if (b.t + 5 * MIN > t) break; const s = cal.marketSession(b.t).key; const k = s === 'asia' ? 'asia' : s === 'london' ? 'london' : null; if (!k) continue; r[k] = r[k] ? [Math.max(r[k][0], b.h), Math.min(r[k][1], b.l)] : [b.h, b.l]; }
        if (r.asia) L.push({ p: r.asia[0], k: 'Asya' }, { p: r.asia[1], k: 'Asya' });
        if (r.london) L.push({ p: r.london[0], k: 'Londra' }, { p: r.london[1], k: 'Londra' });
        const h4 = feed.bars('4h').filter((b) => b.t + 4 * H <= t).slice(-90);
        const hi = [], lo = [];
        for (let i = 3; i < h4.length - 3; i++) { let a = true, b2 = true; for (let k = -3; k <= 3; k++) if (k) { if (h4[i + k].h >= h4[i].h) a = false; if (h4[i + k].l <= h4[i].l) b2 = false; } if (a) hi.push(h4[i].h); if (b2) lo.push(h4[i].l); }
        hi.slice(-5).forEach((p) => L.push({ p, k: '4sa tepe' })); lo.slice(-5).forEach((p) => L.push({ p, k: '4sa dip' }));
        const a100 = Math.floor(mark.entry / 100) * 100; L.push({ p: a100, k: "100'lük" }, { p: a100 + 100, k: "100'lük" });
        const risk = Math.abs(mark.entry - mark.stop), atr = Math.max(risk / 2.5, 0.5);
        const prot = L.filter((x) => (long ? x.p <= mark.entry : x.p >= mark.entry)).map((x) => ({ ...x, d: Math.abs(mark.entry - x.p) })).sort((a, b) => a.d - b.d)[0];
        const fwd = L.filter((x) => (long ? x.p > mark.entry : x.p < mark.entry) && x.k !== "100'lük").map((x) => ({ ...x, d: Math.abs(x.p - mark.entry) })).sort((a, b) => a.d - b.d)[0];
        const ev = cal.eventsBetween(t - 3 * H, t + 3 * H).map((e) => Math.abs(e.t - (t + 5 * MIN)) / MIN);
        const np = new Date(t - 5 * H);
        return { atLevel: !!prot && prot.d <= atr * 0.75, levelKind: prot && prot.d <= atr * 0.75 ? prot.k : 'yok', aheadR: fwd ? fwd.d / risk : 9, aheadKind: fwd ? fwd.k : 'yok', news60: ev.some((m) => m <= 60), hourUtc: new Date(t).getUTCHours(), dow: new Date(t).getUTCDay(), riskUsd: risk, np: np.getUTCHours() };
      };
      for (;;) {
        const state = S.getState(), a = acc();
        if (a.status !== 'active') { reason = 'ihlal: ' + (a.violation ?? ''); break; }
        if (!state.session) {
          if (state.overlay) S.getState().dismissOverlay();
          if (a.phase === 'funded' && a.payouts.length >= cfg.maxPayouts) { reason = 'ödeme hedefi tamam'; break; }
          if (startIdx >= cfg.starts.length) { reason = 'başlangıç listesi bitti'; break; }
          out.stepEnds.push(S.getState().trades.filter((t) => t.accountId === accId).length);
          await forced(cfg.starts[startIdx++], () => S.getState().startSession(accId));
          if (!S.getState().session) { reason = 'seans açılamadı'; break; }
          progressDay = -1;
          engine = begin(); lastBucket = -1;
          continue;
        }
        const feed = st.getFeed();
        if (!feed) { await sleep(50); continue; }
        // Feed.bars() normally concatenates the entire history on every minute. Cache the
        // same shallow array views as new aggregate bars arrive; all candle objects remain
        // the real store objects, so this changes cost only, not replay information.
        if (!optimizedFeeds.has(feed)) {
          const cache = new Map();
          const bars = feed.bars.bind(feed);
          feed.bars = (tf) => {
            let row = cache.get(tf);
            if (!row) { row = { rows: feed.hist[tf].concat(feed.agg[tf]), n: feed.agg[tf].length }; cache.set(tf, row); return row.rows; }
            const source = feed.agg[tf];
            while (row.n < source.length) row.rows.push(source[row.n++]);
            return row.rows;
          };
          feed.verifyCachedBars = () => {
            for (const tf of ['1m', '5m', '15m', '1h', '4h']) {
              const expected = bars(tf), cached = feed.bars(tf);
              if (expected.length !== cached.length || expected.some((bar, i) => bar !== cached[i])) throw new Error(`Feed bar cache mismatch: ${tf}`);
            }
            return true;
          };
          optimizedFeeds.add(feed);
        }
        if (feed.clock - state.session.startMs > cfg.maxDays * DAY) { await S.getState().endSession('user'); reason = a.phase === 'funded' ? 'süre doldu (fonlu)' : 'süre doldu'; if (a.phase === 'funded' && startIdx < cfg.starts.length) continue; break; }
        const before = feed.clock;
        S.getState().stepMinutes(1);
        if (feed.clock === before) { if (++stall > 400) { reason = 'veri alınamadı'; break; } await sleep(25); continue; }
        stall = 0;
        const sess = S.getState().session;
        if (!sess) continue;
        const simulatedDay = Math.floor((feed.clock - sess.startMs) / DAY);
        if (simulatedDay > progressDay) {
          progressDay = simulatedDay;
          const cacheOk = feed.verifyCachedBars();
          await window.__simProgress?.(`#${cfg.index} ${acc().phase}: sim day ${simulatedDay + 1}/${cfg.maxDays}, trades ${S.getState().trades.filter((t) => t.accountId === accId).length}, signals ${out.signals}, feed cache ${cacheOk ? 'OK' : 'FAIL'}`);
        }
        // Check every minute after exits and before taking any new signal.
        const cur = acc();
        if (cur.status === 'active' && cur.phase === 'funded' && !sess.positions.length && !sess.orders.length && !st.payoutBlocker(cur, 0)) {
          const lim = st.accountLimits(cur, null);
          const grossAvailable = Math.max(0, cur.balance - cur.size - lim.buffer);
          const expectedShare = prog.payoutNet(grossAvailable, prog.splitFor(cur.rules, cur.payouts.length), cur.rules.payoutFeePct ?? 0);
          const previousPaid = cur.payouts.reduce((sum, payout) => sum + payout.amount, 0);
          if (previousPaid + expectedShare >= cfg.netTarget) {
            const n = cur.payouts.length;
            await S.getState().requestPayout(accId);
            const after = acc();
            if (after.payouts.length > n) out.payouts.push({ gross: after.payouts.at(-1).gross, amount: after.payouts.at(-1).amount, atClock: feed.clock });
            if (after.payouts.reduce((sum, payout) => sum + payout.amount, 0) >= cfg.netTarget) { reason = 'çekim hedefi (tam bakiye ödemeleri)'; break; }
          }
        }
        // Ask the 1m engine only after the minute candle closes.
        const bucket = Math.floor(feed.clock / MIN);
        if (bucket !== lastBucket) {
          lastBucket = bucket;
          const res = engine({ bars: feed.bars('1m'), clock: feed.clock, days: feed.days(), series: { '5m': feed.bars('5m'), '15m': feed.bars('15m'), '1h': feed.bars('1h'), '4h': feed.bars('4h') } });
          let mark = null;
          for (let i = res.marks.length - 1; i >= 0 && !mark; i--) { const m = res.marks[i]; if (m.t + MIN < feed.clock - MIN) break; if (m.kind === 'signal' && m.t + MIN === feed.clock) mark = m; }
          if (mark) {
            out.signals++;
            if (sess.positions.length || sess.orders.length) { out.skipped++; continue; }
            const ctx = { ...ahead(feed, mark), prob: mark.prob, source: mark.source, strong: !!mark.strong, side: mark.side, entry: mark.entry, stop: mark.stop, target: mark.target, signalT: mark.t };
            S.getState().openTicket(mark.side, 'market');
            S.getState().updateTicket({ type: 'market', sl: mark.stop, tp: mark.target, riskPct: cfg.riskPct, useRisk: true });
            const n0 = S.getState().session.positions.length;
            S.getState().submitTicket();
            const sess2 = S.getState().session;
            if (sess2 && sess2.positions.length > n0) ctxByOpen.set(sess2.positions[sess2.positions.length - 1].openedAt, { ...ctx, fill: sess2.positions[sess2.positions.length - 1].entry, lots: sess2.positions[sess2.positions.length - 1].lots });
            else { out.skipped++; S.getState().cancelTicket(); }
          }
        }
      }
      const a = acc();
      for (const t of S.getState().trades.filter((x) => x.accountId === accId).sort((x, y) => x.openedAt - y.openedAt))
        out.trades.push({ tf: t.tf, side: t.side, lots: t.lots, entry: t.entry, exit: t.exit, sl: t.sl, tp: t.tp, openedAt: t.openedAt, closedAt: t.closedAt, pnl: t.pnl, commission: (t.entry + t.exit) * t.lots * types.CONTRACT * (a.rules.commissionPct ?? 0) / 100, r: t.r, reason: t.reason, ctx: ctxByOpen.get(t.openedAt) ?? null });
      out.status = a.status; out.phase = a.phase; out.step = a.step ?? 0; out.balance = a.balance; out.violation = a.violation ?? null; out.reason = reason;
      out.payoutsTotal = a.payouts.reduce((x, p) => x + p.amount, 0); out.payoutsGross = a.payouts.reduce((x, p) => x + p.gross, 0); out.nPayouts = a.payouts.length;
      out.stepEnds.push(out.trades.length);
      if (S.getState().session) await S.getState().endSession('user');
      return out;
    };
  });

  const t0 = Date.now();
  const order = [];
  for (let i = 0; i < PER; i++) order.push({ i, p: PROGRAM_ID });
  const rand = rng(20261113);
  let done = 0;
  for (const { i, p } of order.slice(0, FAST ? 1 : order.length)) {
    if (Date.now() - t0 > MAX_MS) { log('süre bütçesi doldu'); break; }
    const initial = PERIOD_STARTS[Math.floor(rand() * PERIOD_STARTS.length)];
    const candidates = [initial, ...PERIOD_STARTS.filter((t) => t > initial + MAXDAYS * DAY)].sort((a, b) => a - b);
    const starts = [];
    for (const t of candidates) if (!starts.length || t > starts.at(-1) + MAXDAYS * DAY) starts.push(t);
    while (starts.length > 6) starts.pop();
    const started = Date.now();
    let res;
    try {
      res = await page.evaluate((cfg) => window.__runAccount(cfg), { programId: p, size: SIZE, starts, riskPct: RISK, maxDays: MAXDAYS, maxPayouts: 3, preset: PRESET, netTarget: NET_TARGET, index: i });
    } catch (e) { log('HESAP HATASI', p, i, String(e).slice(0, 200)); await page.reload(); await page.getByRole('button', { name: 'Panel', exact: true }).waitFor(); continue; }
    done++;
    fs.appendFileSync(FILE, JSON.stringify({ ...res, index: i, risk: RISK, preset: PRESET, timeframe: '1m', maxDays: MAXDAYS, netTarget: NET_TARGET }) + '\n');
    log(`hesap ${done}/${order.length} ${p} ${PRESET} #${i}: ${res.status}/${res.phase}/adım${res.step} · ${res.trades.length} işlem · ödeme $${res.payoutsTotal.toFixed(0)} · net-fee $${(res.payoutsTotal - (res.fee ?? 0)).toFixed(0)} · ${res.reason} · ${Math.round((Date.now() - started) / 1000)} sn`);
    // a new account every time starts from nothing: wipe the app state between accounts
    await page.evaluate(async () => { await window.__s2c.getState().resetAllAccounts(); });
    const left = await page.evaluate(() => window.__s2c.getState().accounts.length);
    if (left !== 0) { log('sıfırlama başarısız, sayfa yenileniyor'); await context.clearCookies(); await page.reload(); await page.getByRole('button', { name: 'Panel', exact: true }).waitFor(); }
  }
  log('BİTTİ', `${done} hesap`, 'sayfa hataları:', JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser?.close();
  await server.close();
}
