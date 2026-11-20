// Unattended, signal-by-signal audit of the Parça engines on real Dukascopy XAU/USD candles.
//   node scripts/analyze-signals.mjs            full run (long)
//   FAST=1 node scripts/analyze-signals.mjs     smoke test
// Writes analysis/rapor.md (read this), analysis/sinyaller.csv (every signal and why), analysis/ilerleme.log.
// Costs no tokens: it runs the app's own engine code (bundled from src/) outside the browser.
import fs from 'node:fs';
import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';

const FAST = !!process.env.FAST;
const OUT = 'analysis';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/ilerleme.log`, '');
const log = (...a) => { const s = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.error(s); fs.appendFileSync(`${OUT}/ilerleme.log`, s + '\n'); };

async function load(p) {
  const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const [market, parca, ind, variants, cal, feedMod] = await Promise.all(
  ['src/lib/market.ts', 'src/lib/parcaSetup.ts', 'src/lib/indicators.ts', 'src/lib/parcaVariants.ts', 'src/lib/calendar.ts', 'src/lib/feed.ts'].map(load));
const { GOLD_SETUP_DEFAULTS: GOLD, GOLD_A_SETUP_DEFAULTS: APLUS } = variants;

const MIN = 60_000, H = 3_600_000, DAY = 86_400_000;
const SP = Number(process.env.SPREAD ?? 0.2);
const TFMS = { '1m': MIN, '5m': 5 * MIN, '15m': 15 * MIN, '1h': H, '4h': 4 * H };
const TFK = { '1m': 'm1', '5m': 'm5', '15m': 'm15', '1h': 'h1' };

// TRAIN: the probability model was fitted here. TEST: looked at repeatedly while choosing presets,
// so only roughly clean. FRESH: never used for any choice, the one honest out-of-sample set.
const TRAIN = ['2024-05-13:2024-06-14', '2024-06-30:2024-07-19', '2024-09-16:2024-10-09', '2024-10-21:2024-11-29', '2025-01-02:2025-01-15'];
const TEST = ['2025-04-07:2025-04-30', '2025-08-01:2025-08-28', '2025-10-01:2025-10-31', '2026-04-01:2026-04-17', '2026-05-12:2026-06-26'];
const FRESH = ['2025-02-10:2025-02-22', '2025-03-03:2025-03-17', '2025-05-19:2025-06-01', '2025-09-16:2025-09-30', '2025-11-18:2025-11-30', '2026-02-16:2026-02-28', '2026-03-21:2026-04-01'];
const SETS = FAST ? { train: TRAIN.slice(0, 1), test: TEST.slice(0, 1), fresh: FRESH.slice(0, 1) } : { train: TRAIN, test: TEST, fresh: FRESH };

async function rates(tf, from, to, useCache = true) {
  const rows = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date(from), to: new Date(to) }, timeframe: TFK[tf], priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache, cacheFolderPath: '.cache/dukascopy' });
  return rows.filter((b) => b.timestamp >= from && b.timestamp < to).map((b) => ({ t: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume ?? 0 }));
}
const open = (rows) => rows.filter((b) => !market.isClosed(b.t));
const agg = (bars, ms) => { const out = []; for (const b of bars) { const t = Math.floor(b.t / ms) * ms, l = out[out.length - 1]; if (l && l.t === t) { l.h = Math.max(l.h, b.h); l.l = Math.min(l.l, b.l); l.c = b.c; l.v += b.v; } else out.push({ ...b, t }); } return out; };

// ── data ────────────────────────────────────────────────────────────────────────────────────
const periods = [];
for (const [set, specs] of Object.entries(SETS)) for (const spec of specs) {
  const [from, to] = spec.split(':').map((d) => Date.parse(d + 'T00:00:00Z'));
  const m1 = open(await rates('1m', from, to));
  const h1 = open(await rates('1h', from - 90 * DAY, to));
  const d = { set, spec, from, to, m1, h1, h4: agg(h1, 4 * H), days: market.dailyBars(h1), m5: agg(m1, 5 * MIN), m15: agg(m1, 15 * MIN) };
  d.idx = new Map(m1.map((b, i) => [b.t, i]));
  d.series = { '5m': d.m5, '15m': d.m15, '1h': h1, '4h': d.h4 };
  d.tfBars = (tf) => (tf === '1m' ? m1 : tf === '5m' ? d.m5 : d.m15);
  d.news = cal.eventsBetween(from - DAY, to + DAY).map((e) => e.t);
  periods.push(d);
  log('veri', set, spec, m1.length, 'dakika');
}
const tradingDays = (d) => (d.to - d.from - 3 * DAY) / DAY * 5 / 7;
const dayCount = (set) => periods.filter((d) => d.set === set).reduce((a, d) => a + tradingDays(d), 0);

// ── 1) is the data real? ────────────────────────────────────────────────────────────────────
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const dataReport = [];
{
  log('veri doğrulama');
  let bad = 0, dup = 0, back = 0, gaps = 0, gapMin = 0, jumps = 0, flat = 0, total = 0;
  const jumpAt = [];
  const shortDays = [];
  for (const d of periods) {
    let prev;
    const perDay = new Map();
    for (const b of d.m1) {
      total++;
      if (!(b.h >= Math.max(b.o, b.c, b.l) && b.l <= Math.min(b.o, b.c, b.h) && b.v >= 0 && [b.o, b.h, b.l, b.c].every(Number.isFinite))) bad++;
      if (b.h === b.l) flat++;
      if (prev) {
        if (b.t === prev.t) dup++; else if (b.t < prev.t) back++;
        const g = (b.t - prev.t) / MIN;
        if (g > 1 && g <= 60 && !market.isClosed(prev.t + MIN) && !market.isClosed(b.t - MIN)) { gaps++; gapMin += g - 1; }
        if (Math.abs(b.o - prev.c) / prev.c > 0.005) { jumps++; jumpAt.push(new Date(b.t).toISOString().slice(0, 16)); }
      }
      prev = b;
      const k = market.dayStart(b.t);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    for (const [k, n] of perDay) if (n < 1100 && n > 60 && k > d.from + DAY && k < d.to - DAY) shortDays.push(`${new Date(k + 7 * H).toISOString().slice(0, 10)} (${n})`);
  }
  dataReport.push(['Toplam 1dk mum', total], ['Geçersiz OHLC (high<low vb.)', bad], ['Tekrarlı / geri giden zaman', `${dup} / ${back}`], ['Piyasa açıkken delik (dakika)', `${gaps} delik, ${gapMin} dk`], ['Bir dakikada %0,5+ fiyat sıçraması', jumps ? `${jumps}: ${jumpAt.slice(0, 6).join(', ')}` : 0], ['Tek fiyatlı (h=l) mum', flat], ['1100 dakikadan kısa işlem günü', shortDays.length ? shortDays.slice(0, 12).join(', ') + (shortDays.length > 12 ? ` … (${shortDays.length})` : '') : 'yok']);

  // cache vs a fresh download straight from Dukascopy (bypasses the disk cache)
  const rng = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  let checked = 0, mism = 0, missing = 0, extra = 0; const bad2 = [];
  const picks = FAST ? 2 : 14;
  for (let n = 0; n < picks; n++) {
    const d = periods[Math.floor(rng() * periods.length)];
    const day = market.dayStart(d.from + 3 * DAY + Math.floor(rng() * Math.max(1, (d.to - d.from) / DAY - 5)) * DAY);
    const from = day, to = day + DAY;
    try {
      const fresh = open(await rates('1m', from, to, false));
      const mine = new Map(d.m1.filter((b) => b.t >= from && b.t < to).map((b) => [b.t, b]));
      if (!fresh.length && !mine.size) continue;
      checked++;
      for (const f of fresh) { const m = mine.get(f.t); if (!m) { missing++; continue; } if (['o', 'h', 'l', 'c'].some((k) => Math.abs(m[k] - f[k]) > 1e-6)) { mism++; bad2.push(new Date(f.t).toISOString()); } mine.delete(f.t); }
      extra += mine.size;
    } catch (e) { log('yeniden indirme başarısız', String(e).slice(0, 80)); }
  }
  dataReport.push([`Önbellek ↔ Dukascopy'den taze indirme (${checked} gün)`, `${mism} farklı mum, ${missing} eksik, ${extra} fazla${bad2.length ? ' → ' + bad2.slice(0, 3).join(', ') : ''}`]);

  // native 5m / 15m / 1h candles vs the 1m aggregation
  for (const tf of ['5m', '15m', '1h']) {
    let n = 0, diff = 0;
    for (const d of periods.slice(0, FAST ? 1 : 3)) {
      const native = new Map(open(await rates(tf, d.from, d.to)).map((b) => [b.t, b]));
      const mine = tf === '5m' ? d.m5 : tf === '15m' ? d.m15 : agg(d.m1, H);
      for (const b of mine) { const x = native.get(b.t); if (!x) continue; n++; if (['o', 'h', 'l', 'c'].some((k) => Math.abs(b[k] - x[k]) > 1e-6)) diff++; }
    }
    dataReport.push([`Dukascopy'nin kendi ${tf} mumu ↔ 1dk'dan kurulan`, `${n} mumdan ${diff} fark`]);
  }

  // an independent source: COMEX gold futures (Yahoo GC=F) daily closes. Futures trade at a premium to
  // spot, so levels differ; what must agree is the daily price path (day-to-day % change).
  try {
    const p1 = Math.floor(Math.min(...periods.map((d) => d.from)) / 1000) - 5 * 86400, p2 = Math.floor(Math.max(...periods.map((d) => d.to)) / 1000) + 86400;
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=${p1}&period2=${p2}&interval=1d`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    const res = j.chart.result[0];
    const yh = new Map(res.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), res.indicators.quote[0].close[i]]).filter((x) => Number.isFinite(x[1])));
    const mine = new Map();
    for (const d of periods) for (const x of d.days) mine.set(new Date(x.end - 6 * H).toISOString().slice(0, 10), x.c);
    const dates = [...yh.keys()].sort();
    const pairs = [], basis = [];
    for (let i = 1; i < dates.length; i++) {
      const [a0, a1] = [dates[i - 1], dates[i]];
      if (mine.has(a0) && mine.has(a1)) pairs.push([yh.get(a1) / yh.get(a0) - 1, mine.get(a1) / mine.get(a0) - 1]);
      if (mine.has(a1)) basis.push(yh.get(a1) - mine.get(a1));
    }
    if (pairs.length < 30) throw new Error('kesişen gün az: ' + pairs.length);
    const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1]));
    const cor = pairs.reduce((acc, p) => acc + (p[0] - mx) * (p[1] - my), 0) / Math.sqrt(pairs.reduce((acc, p) => acc + (p[0] - mx) ** 2, 0) * pairs.reduce((acc, p) => acc + (p[1] - my) ** 2, 0));
    const dif = pairs.map((p) => Math.abs(p[0] - p[1]) * 100).sort((x, y) => x - y);
    basis.sort((x, y) => x - y);
    dataReport.push(['Bağımsız kaynak: COMEX altın vadeli (Yahoo GC=F) günlük değişim ↔ bizim', `${pairs.length} gün: korelasyon ${cor.toFixed(4)}, günlük % değişimde ortanca fark %${dif[dif.length >> 1].toFixed(2)}, en büyük %${dif.at(-1).toFixed(2)} (vadeli-spot farkı ortanca ${basis[basis.length >> 1].toFixed(1)} $)`]);
  } catch (e) { dataReport.push(['Bağımsız kaynak (Yahoo GC=F)', `alınamadı: ${String(e).slice(0, 90)}`]); }
}

// ── 2) signals, outcomes and context ────────────────────────────────────────────────────────
const sessCache = new Map();
const sessOf = (t) => { const k = Math.floor(t / H); if (!sessCache.has(k)) sessCache.set(k, cal.marketSession(k * H).key); return sessCache.get(k); };
const nyFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const nyParts = (t) => { const p = Object.fromEntries(nyFmt.formatToParts(t).map((x) => [x.type, x.value])); return { h: +p.hour, m: +p.minute, dow: p.weekday }; };

function simulate(d, sig, tf, mults = [1, 2]) {
  const long = sig.side === 'long';
  let j = d.idx.get(sig.t + TFMS[tf]) ?? d.m1.findIndex((b) => b.t >= sig.t + TFMS[tf]);
  if (j < 0) return null;
  const close = d.tfBars(tf).find((b) => b.t === sig.t)?.c ?? sig.entry;
  const fill = long ? close + SP : close;
  const risk = Math.abs(fill - sig.stop);
  if (!(risk > 0)) return null;
  const end = Math.min(d.m1.length, j + 240);
  let mfe = 0, mae = 0, stopAt = -1, firstHit = {};
  const res = Object.fromEntries(mults.map((m) => [m, null]));
  for (let q = j; q < end; q++) {
    const b = d.m1[q];
    const lo = long ? b.l : b.l + SP, hi = long ? b.h : b.h + SP;
    const fav = long ? (hi - fill) / risk : (fill - lo) / risk;
    const adv = long ? (fill - lo) / risk : (hi - fill) / risk;
    const stopped = long ? lo <= sig.stop : hi >= sig.stop;
    for (const m of mults) if (res[m] === null) {
      if (stopped) res[m] = -1; // stop first inside a minute
      else if (fav >= m) { res[m] = m; firstHit[m] = q - j; }
    }
    if (!stopped) { mfe = Math.max(mfe, fav); mae = Math.max(mae, adv); }
    if (stopped && stopAt < 0) { stopAt = q - j; }
    if (stopAt >= 0 && mults.every((m) => res[m] !== null)) break;
    if (mults.every((m) => res[m] !== null)) break;
  }
  const last = d.m1[end - 1];
  const mtm = long ? (last.c - fill) / risk : (fill - (last.c + SP)) / risk;
  for (const m of mults) if (res[m] === null) res[m] = Math.max(-1, Math.min(m, mtm));
  return { r: res, mfe, mae, stopMin: stopAt, hitMin: firstHit[1] ?? -1 };
}

function levelsAround(d, sig, tf) {
  const t = sig.t, long = sig.side === 'long';
  const L = [];
  const end = market.dayStart(t) + DAY;
  const di = d.days.findIndex((x) => x.end === end);
  if (di > 0) { L.push({ p: d.days[di - 1].h, k: 'önceki gün' }, { p: d.days[di - 1].l, k: 'önceki gün' }); }
  const wk = (e) => Math.floor(((e - 12 * H) / DAY - 4) / 7);
  if (di > 0) { const cur = wk(d.days[di].end); const pw = d.days.filter((x) => wk(x.end) === cur - 1); if (pw.length) L.push({ p: Math.max(...pw.map((x) => x.h)), k: 'önceki hafta' }, { p: Math.min(...pw.map((x) => x.l)), k: 'önceki hafta' }); }
  const ds = market.dayStart(t);
  const ranges = { asia: null, london: null };
  for (const b of d.m5) { if (b.t < ds) continue; if (b.t + 5 * MIN > t) break; const s = sessOf(b.t); const key = s === 'asia' ? 'asia' : s === 'london' ? 'london' : null; if (!key) continue; const r = ranges[key]; ranges[key] = r ? [Math.max(r[0], b.h), Math.min(r[1], b.l)] : [b.h, b.l]; }
  if (ranges.asia) L.push({ p: ranges.asia[0], k: 'Asya' }, { p: ranges.asia[1], k: 'Asya' });
  if (ranges.london) L.push({ p: ranges.london[0], k: 'Londra' }, { p: ranges.london[1], k: 'Londra' });
  const h4 = d.h4.filter((b) => b.t + 4 * H <= t).slice(-90);
  const hi = [], lo = [];
  for (let i = 3; i < h4.length - 3; i++) {
    let isH = true, isL = true;
    for (let k = -3; k <= 3; k++) if (k) { if (h4[i + k].h >= h4[i].h) isH = false; if (h4[i + k].l <= h4[i].l) isL = false; }
    if (isH) hi.push(h4[i].h); if (isL) lo.push(h4[i].l);
  }
  for (const p of hi.slice(-5)) L.push({ p, k: '4sa tepe' });
  for (const p of lo.slice(-5)) L.push({ p, k: '4sa dip' });
  for (const step of [100, 50]) { const a = Math.floor(sig.entry / step) * step; L.push({ p: a, k: `${step}'lük` }, { p: a + step, k: `${step}'lük` }); }
  return L;
}

const sigs = [];
function collect(tf, params, label) {
  for (const d of periods) {
    const bars = d.tfBars(tf);
    const e21 = ind.ema(bars.map((b) => b.c), 21);
    const atr = ind.atr(bars, 14);
    const adx = ind.IND_BY_ID.adx.calc(bars, { len: 14, adx: 14 }).adx;
    const rsi = ind.IND_BY_ID.rsi.calc(bars, { len: 14, ma: 14 }).v;
    const atrAvg = ind.sma(atr, 288);
    const c15 = d.m15.map((b) => b.c), e15 = ind.ema(c15, 50), i15 = new Map(d.m15.map((b, x) => [b.t, x]));
    const bi = new Map(bars.map((b, i) => [b.t, i]));
    const marks = parca.analyzeParcaSetup({ tf, bars, clock: d.to, days: d.days, series: d.series, params }).marks;
    const sweeps = marks.filter((m) => m.kind === 'sweep');
    for (const m of marks.filter((x) => x.kind === 'signal' && x.t >= d.from + 3 * DAY)) {
      const i = bi.get(m.t); if (i === undefined || !(atr[i] > 0)) continue;
      const w = m.side === 'long' ? 1 : -1, a = atr[i], b = bars[i], p = bars[i - 1];
      const sim = simulate(d, m, tf, [1, 2]); if (!sim) continue;
      const risk = Math.abs(m.entry - m.stop);
      const lv = levelsAround(d, { ...m, entry: m.entry }, tf);
      const prot = lv.filter((x) => (long(w) ? x.p <= m.entry : x.p >= m.entry) && x.k !== "50'lük").map((x) => ({ ...x, dist: Math.abs(m.entry - x.p) }));
      const ahead = lv.filter((x) => (long(w) ? x.p > m.entry : x.p < m.entry) && x.k !== "100'lük" && x.k !== "50'lük").map((x) => ({ ...x, dist: Math.abs(x.p - m.entry) })).sort((x, y) => x.dist - y.dist);
      const near = prot.sort((x, y) => x.dist - y.dist)[0];
      const k15 = i15.get(Math.floor((m.t + TFMS[tf]) / 900e3) * 900e3 - 900e3);
      const dayStartT = market.dayStart(m.t);
      const sameDaySweep = sweeps.some((s) => s.side === m.side && s.t < m.t && s.t >= dayStartT);
      const np = nyParts(m.t);
      const news = d.news.reduce((best, e) => Math.min(best, Math.abs(e - (m.t + TFMS[tf]))), Infinity) / MIN;
      const bias3 = parca.biasAt(m.t + TFMS[tf], d.days, d.h1, d.h4, 3) === w;
      const aheadR = ahead.length ? ahead[0].dist / risk : 9;
      sigs.push({
        label, tf, set: d.set, t: m.t, side: m.side, source: m.source, prob: m.prob, strong: !!m.strong,
        entry: m.entry, stop: m.stop, target: m.target, riskAtr: risk / a,
        r1: sim.r[1], r2: sim.r[2], mfe: sim.mfe, mae: sim.mae, stopMin: sim.stopMin, hitMin: sim.hitMin,
        hour: np.h, dow: np.dow,
        adx: adx[i], vol: a / atrAvg[i], slope21: w * (e21[i] - e21[i - 5]) / a, ext21: w * (b.c - e21[i]) / a,
        rsi: w === 1 ? rsi[i] : 100 - rsi[i], engulfRatio: Math.abs(b.c - b.o) / Math.max(1e-9, Math.abs(p.c - p.o)),
        m15: k15 !== undefined && w * (c15[k15] - e15[k15]) > 0, double: m.source.includes('MSP'), swept: sameDaySweep,
        htf: /^(15dk|1sa|4sa) /.test(m.source), ifvg: m.source.includes('iFVG'), bias3, news60: news <= 60,
        atLevel: !!near && near.dist <= 0.75 * a, levelKind: near && near.dist <= 0.75 * a ? near.k : 'yok', levelDist: near ? near.dist / a : 9,
        aheadR, aheadKind: ahead.length ? ahead[0].k : 'yok',
        loss: sim.r[1] < 0 ? (sim.mfe >= 0.5 ? 'döndü (0,5R+ gördü)' : sim.stopMin >= 0 && sim.stopMin <= 30 ? 'hemen stop (≤30 dk)' : 'yavaş stop') : '',
      });
    }
    log(label, tf, d.set, d.spec, 'sinyal toplam', sigs.length);
  }
}
const long = (w) => w === 1;

log('sinyaller toplanıyor');
collect('5m', GOLD, 'Gold 5dk');
collect('5m', APLUS, 'Gold A+ 5dk');
if (!FAST) collect('15m', GOLD, 'Gold 15dk');

// ── helpers for the report ──────────────────────────────────────────────────────────────────
const pct = (x) => `${Math.round(x * 100)}%`;
const f2 = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const stat = (list, key = 'r1') => { const r = list.map((s) => s[key]); const m = mean(r); const ci = 1.96 * sd(r) / Math.sqrt(Math.max(1, r.length)); return { n: r.length, win: r.length ? r.filter((x) => x > 0).length / r.length : NaN, avg: m, ci }; };
const cell = (list) => { const s = stat(list); return s.n ? `${s.n} · ${pct(s.win)} · ${f2(s.avg)}R ±${f2(s.ci)}` : '–'; };
const mdTable = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
const byLabel = (label) => sigs.filter((s) => s.label === label);
const setsOf = (list) => ({ train: list.filter((s) => s.set === 'train'), test: list.filter((s) => s.set === 'test'), fresh: list.filter((s) => s.set === 'fresh') });
const section = (title, body) => `\n## ${title}\n\n${body}\n`;

function groupRows(list, keyFn, order) {
  const groups = new Map();
  for (const s of list) { const k = keyFn(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const keys = order ?? [...groups.keys()].sort();
  return keys.filter((k) => groups.has(k)).map((k) => { const g = groups.get(k); const x = setsOf(g); return [String(k), cell(g), cell(x.train), cell(x.test), cell(x.fresh)]; });
}
const HEAD = ['', 'hepsi (n · kazanma · ort. R ±%95)', 'TRAIN', 'TEST', 'FRESH (temiz)'];

// consistency scan: a feature only counts when the high-vs-low gap has the same sign in all three sets
function scan(list) {
  const rows = [];
  const num = ['adx', 'vol', 'slope21', 'ext21', 'rsi', 'engulfRatio', 'riskAtr', 'aheadR', 'levelDist', 'prob', 'hour'];
  const bin = ['double', 'swept', 'htf', 'ifvg', 'm15', 'bias3', 'atLevel', 'news60', 'strong'];
  const sets = setsOf(list);
  const test = (name, fn) => {
    const out = [];
    for (const k of ['train', 'test', 'fresh']) {
      const a = sets[k].filter((s) => fn(s) === true), b = sets[k].filter((s) => fn(s) === false);
      if (a.length < 8 || b.length < 8) { out.push(NaN); continue; }
      out.push(stat(a).win - stat(b).win);
    }
    const valid = out.filter(Number.isFinite);
    const consistent = valid.length === 3 && valid.every((x) => Math.sign(x) === Math.sign(valid[0]) && Math.abs(x) >= 0.05);
    rows.push({ name, out, consistent, mag: mean(valid.map(Math.abs)) });
  };
  for (const f of num) { const vals = list.map((s) => s[f]).filter(Number.isFinite).sort((a, b) => a - b); const med = vals[vals.length >> 1]; test(`${f} ≥ ortanca (${f2(med)})`, (s) => (Number.isFinite(s[f]) ? s[f] >= med : undefined)); }
  for (const f of bin) test(f, (s) => !!s[f]);
  test('long (short karşısında)', (s) => s.side === 'long');
  return rows.sort((a, b) => b.mag - a.mag);
}

// ── 3) parameter sensitivity ────────────────────────────────────────────────────────────────
const grid = [];
function gridRun(name, tf, params, mult = 1) {
  const rows = { train: [], test: [], fresh: [] };
  for (const d of periods) {
    const bars = d.tfBars(tf);
    const marks = parca.analyzeParcaSetup({ tf, bars, clock: d.to, days: d.days, series: d.series, params }).marks.filter((m) => m.kind === 'signal' && m.t >= d.from + 3 * DAY);
    for (const m of marks) { const s = simulate(d, m, tf, [mult]); if (s) rows[d.set].push({ r1: s.r[mult] }); }
  }
  const st = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, { ...stat(v), perDay: v.length / dayCount(k) }]));
  grid.push({ name, tf, st });
  log('ayar', name, tf, `fresh n=${st.fresh.n} avg=${f2(st.fresh.avg)}`);
}
if (!FAST) {
  gridRun('Gold (şimdiki)', '5m', GOLD);
  for (const w of [6, 8, 14]) gridRun(`pencere ${w}`, '5m', { ...GOLD, window: w });
  for (const g of [0.15, 0.35, 0.45]) gridRun(`en küçük FVG ${g}`, '5m', { ...GOLD, minGap: g });
  for (const p of [1, 3]) gridRun(`salınım ${p} mum`, '5m', { ...GOLD, pivot: p });
  for (const z of [40, 120]) gridRun(`bölge ömrü ${z}`, '5m', { ...GOLD, zoneAge: z });
  for (const b of [1, 3, 6]) gridRun(`bias modu ${b}`, '5m', { ...GOLD, biasMode: b });
  for (const s of [0, 2]) gridRun(`seans ${s}`, '5m', { ...GOLD, session: s });
  gridRun('EMA teyidi kapalı', '5m', { ...GOLD, ema: 0 });
  for (const a of [0, 15, 25, 30]) gridRun(`ADX ≥ ${a}`, '5m', { ...GOLD, adx: a });
  for (const p of [0.45, 0.5, 0.6, 0.65]) gridRun(`olasılık ≥ ${p}`, '5m', { ...GOLD, minP: p });
  for (const s of [1, 2]) gridRun(`likidite şartı ${s}`, '5m', { ...GOLD, sweep: s });
  for (const r of [0.75, 1.5, 2]) gridRun(`hedef ${r}R`, '5m', GOLD, r);
  gridRun('Gold A+ (şimdiki)', '5m', APLUS);
  gridRun('Gold 15dk', '15m', GOLD);
  gridRun('Gold A+ 15dk', '15m', APLUS);
}

// ── 4) the replay the user sees must equal the analysis ────────────────────────────────────
let replayReport = 'çalıştırılmadı';
try {
  log('replay doğrulaması');
  const d = periods.find((x) => x.set === 'fresh');
  const start = d.from + 1 * DAY + 8 * H;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url, 'http://local'); const tf = u.searchParams.get('tf');
    const rows = open(await rates(tf, +u.searchParams.get('from'), +u.searchParams.get('to')));
    return { ok: true, status: 200, json: async () => rows.map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]) };
  };
  const feed = await feedMod.Feed.create(start);
  const end = start + (FAST ? 1 : 4) * DAY;
  const engine = parca.createSetupEngine('5m', GOLD);
  const seen = new Map();
  let steps = 0, last = -1;
  while (feed.clock < end) {
    if (feed.minutes.length - feed.ci < 10) { feed.ensureAhead(); await feed.waitForLoading(); }
    if (!feed.step()) { await feed.waitForLoading(); if (feed.exhausted || feed.loadError) break; continue; }
    steps++;
    const b = Math.floor(feed.clock / TFMS['5m']);
    if (b === last) continue; last = b;
    const r = engine({ bars: feed.bars('5m'), clock: feed.clock, days: feed.days(), series: { '5m': feed.bars('5m'), '15m': feed.bars('15m'), '1h': feed.bars('1h'), '4h': feed.bars('4h') } });
    for (const m of r.marks) if (m.kind === 'signal') { const k = `${m.t}|${m.side}`; if (!seen.has(k)) seen.set(k, { clock: feed.clock, entry: m.entry, stop: m.stop, prob: m.prob }); }
  }
  const finalMarks = parca.analyzeParcaSetup({ tf: '5m', bars: feed.bars('5m'), clock: feed.clock, days: feed.days(), series: { '5m': feed.bars('5m'), '15m': feed.bars('15m'), '1h': feed.bars('1h'), '4h': feed.bars('4h') }, params: GOLD }).marks.filter((m) => m.kind === 'signal' && m.t >= start);
  const fin = new Map(finalMarks.map((m) => [`${m.t}|${m.side}`, m]));
  const onlyLive = [...seen.keys()].filter((k) => !fin.has(k) && +k.split('|')[0] >= start);
  const onlyFinal = [...fin.keys()].filter((k) => !seen.has(k));
  const early = [...seen].filter(([k, v]) => v.clock < +k.split('|')[0] + TFMS['5m']).length;
  const moved = [...seen].filter(([k, v]) => fin.has(k) && (Math.abs(fin.get(k).entry - v.entry) > 1e-9 || Math.abs(fin.get(k).stop - v.stop) > 1e-9)).length;
  replayReport = `Replay ${new Date(start).toISOString().slice(0, 10)} → ${new Date(feed.clock).toISOString().slice(0, 10)}, ${steps} dakika adımı: canlıda görülen ${seen.size} sinyal, sonradan hesaplanan ${fin.size}. Sonradan kaybolan: ${onlyLive.length}, canlıda hiç görülmeyen: ${onlyFinal.length}, mum kapanmadan çıkan: ${early}, giriş/stop değişen: ${moved}. ${onlyLive.length + onlyFinal.length + early + moved === 0 ? '→ AYNI: replayde gördüğün sinyal, analizdeki sinyalin aynısı.' : '→ FARK VAR: incele.'}`;
  globalThis.fetch = realFetch;
} catch (e) { replayReport = `hata: ${String(e).slice(0, 200)}`; }

// ── 5) report ───────────────────────────────────────────────────────────────────────────────
log('rapor yazılıyor');
let md = `# Parça sinyal denetimi\n\nÜretildi: ${new Date().toISOString().slice(0, 16)} UTC · veri: Dukascopy XAU/USD bid · spread ${SP} $ · hedef 1R (aksi belirtilmedikçe) · aynı dakikada stop önce sayılır · her sinyal kapanıştan sonraki ilk dakikadan 240 dk izlendi.\n`;
md += `\n**Dönemler.** TRAIN: olasılık modelinin kurulduğu dönemler (${SETS.train.length}). TEST: ön ayarları seçerken defalarca bakılan dönemler (${SETS.test.length}); tam temiz değil. **FRESH: hiçbir seçimde kullanılmamış ${SETS.fresh.length} dönem; gerçek sınav bu.** Her hücre: sinyal sayısı · kazanma oranı · ortalama R ± %95 güven aralığı. Güven aralığı 0'ı kapsıyorsa sonuç şans olabilir.\n`;
md += section('1. Veri gerçek mi?', mdTable(['Kontrol', 'Sonuç'], dataReport.map((r) => [r[0], String(r[1])])) + `\n**Replay ↔ analiz:** ${replayReport}\n\nNot: Kaynak Dukascopy'nin kendi verisi; aracına/prop firmaya göre birkaç sent-dolar fark olabilir. Bağımsız kaynak satırı varsa günlük kapanışları ayrı bir sağlayıcıyla karşılaştırır.`);

for (const label of ['Gold 5dk', 'Gold A+ 5dk', 'Gold 15dk']) {
  const list = byLabel(label);
  if (!list.length) continue;
  const x = setsOf(list);
  const days = Object.fromEntries(['train', 'test', 'fresh'].map((k) => [k, dayCount(k)]));
  let body = mdTable(['Küme', 'Sinyal/gün', 'Sinyal', 'Kazanma (1R)', 'Ort. R', '%95 aralık', '2R hedefte ort. R'],
    ['train', 'test', 'fresh'].map((k) => { const s = stat(x[k]), s2 = stat(x[k], 'r2'); return [k.toUpperCase(), f2(x[k].length / days[k], 1), String(s.n), pct(s.win), f2(s.avg), `${f2(s.avg - s.ci)} … ${f2(s.avg + s.ci)}`, f2(s2.avg)]; }));
  // per period stability
  const per = periods.map((d) => { const l = list.filter((s) => s.t >= d.from && s.t < d.to); const s = stat(l); return [d.set, d.spec, String(s.n), l.length ? pct(s.win) : '–', f2(s.avg)]; });
  body += `\n**Dönem dönem** (tutarlılık için):\n\n` + mdTable(['Küme', 'Dönem', 'n', 'Kazanma', 'Ort. R'], per);
  // losers anatomy
  const losers = list.filter((s) => s.r1 < 0);
  const lossKinds = groupRows(list.filter((s) => s.r1 < 0), (s) => s.loss);
  body += `\n**Kaybedenlerin yapısı** (${losers.length} kayıp / ${list.length} sinyal): stop'a nasıl gitti?\n\n` + mdTable(['Tür', 'adet · pay', '', '', ''], (() => { const g = new Map(); for (const s of losers) g.set(s.loss, (g.get(s.loss) ?? 0) + 1); return [...g].map(([k, n]) => [k, `${n} · ${pct(n / losers.length)}`, '', '', '']); })()) + `\n- "döndü": fiyat önce en az +0,5R gitti sonra stop oldu (kar alma/kısmi çıkış fırsatı vardı).\n- "hemen stop": 30 dakika içinde, hiç lehine gitmeden.\n`;
  const mf = losers.map((s) => s.mfe), wins = list.filter((s) => s.r1 > 0);
  body += `\nKaybedenlerin ortalama en iyi anı: +${f2(mean(mf))}R; kazananların stop'a en yakın anı: −${f2(mean(wins.map((s) => s.mae)))}R. Ortalama çözülme süresi: kazanan ${f2(mean(wins.filter((s) => s.hitMin >= 0).map((s) => s.hitMin)), 0)} dk, kaybeden ${f2(mean(losers.filter((s) => s.stopMin >= 0).map((s) => s.stopMin)), 0)} dk.\n`;

  body += `\n### Onaylar: kaç şey birden varsa sonuç değişiyor mu?\n\nOnay sayısı = {engulf+MSP birlikte, aynı gün likidite süpürmesi, 15dk EMA50 yönü, 3'ü de aynı bias, ADX≥25, oynaklık≥1,2, 1sa/4sa bölge}.\n\n`;
  const conf = (s) => (s.double ? 1 : 0) + (s.swept ? 1 : 0) + (s.m15 ? 1 : 0) + (s.bias3 ? 1 : 0) + (s.adx >= 25 ? 1 : 0) + (s.vol >= 1.2 ? 1 : 0) + (s.htf ? 1 : 0);
  body += mdTable(HEAD, groupRows(list, (s) => (conf(s) >= 5 ? '5+' : String(conf(s))), ['0', '1', '2', '3', '4', '5+']));
  body += `\n### Destek / direnç: sinyal önemli bir seviyede miydi?\n\nSeviye listesi: önceki gün tepe/dip, önceki hafta tepe/dip, Asya ve Londra aralığı, son 4sa salınımlar, 100/50'lik yuvarlak sayılar. "Seviyede" = koruyucu tarafta 0,75 ATR içinde seviye var (long için altında destek, short için üstünde direnç). "Önünde" = işlem yönündeki en yakın seviyeye mesafe (R).\n\n**Giriş seviyede mi?**\n\n` + mdTable(HEAD, groupRows(list, (s) => (s.atLevel ? `seviyede (${s.levelKind})` : 'seviyede değil')));
  body += `\n**Seviye türüne göre (seviyedeyse):**\n\n` + mdTable(HEAD, groupRows(list.filter((s) => s.atLevel), (s) => s.levelKind));
  body += `\n**Önündeki ilk seviye ne kadar uzakta?**\n\n` + mdTable(HEAD, groupRows(list, (s) => (s.aheadR < 1 ? '<1R' : s.aheadR < 2 ? '1–2R' : s.aheadR < 4 ? '2–4R' : '4R+/yok'), ['<1R', '1–2R', '2–4R', '4R+/yok']));
  body += `\n### Kaynak, saat, yön\n\n**Engulf edilen bölge:**\n\n` + mdTable(HEAD, groupRows(list, (s) => s.source.replace(' + MSP', ''))) + `\n**New York saati (kaba):**\n\n` + mdTable(HEAD, groupRows(list, (s) => (s.hour < 3 ? '00–03' : s.hour < 6 ? '03–06' : s.hour < 9 ? '06–09' : s.hour < 12 ? '09–12' : s.hour < 16 ? '12–16' : '16–24'), ['00–03', '03–06', '06–09', '09–12', '12–16', '16–24'])) + `\n**Yön:**\n\n` + mdTable(HEAD, groupRows(list, (s) => s.side));
  body += `\n### Tutarlı sinyal-kalitesi göstergeleri\n\nBir göstergede "yüksek" ile "düşük" yarı arasındaki kazanma farkı üç kümenin üçünde de aynı yönde ve ≥5 puan ise tutarlı sayıldım. Tutarsızlar büyük olasılıkla geçmişe uydurma.\n\n` + mdTable(['Gösterge', 'TRAIN fark', 'TEST fark', 'FRESH fark', 'Tutarlı mı?'], scan(list).map((r) => [r.name, ...r.out.map((v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${Math.round(v * 100)} puan` : 'az veri')), r.consistent ? '**evet**' : 'hayır']));
  md += section(`2. ${label}`, body);
}

if (grid.length) {
  const base = grid[0];
  md += section('3. Ayar duyarlılığı: şimdiki ayarı değiştirsek ne olurdu?', `Tek ayar değişir, geri kalanı aynı. Hücre: sinyal/gün · kazanma · ort. R. **FRESH sütununa bak;** TRAIN/TEST'te iyi görünen ama FRESH'te bozulan ayar geçmişe uydurmadır.\n\n` + mdTable(['Ayar', 'Grafik', 'TRAIN', 'TEST', 'FRESH', 'FRESH %95 aralık'], grid.map((g) => ['train', 'test', 'fresh'].map((k) => g.st[k]).reduce((acc, s, i) => { acc.push(`${f2(s.perDay, 1)}/gün · ${pct(s.win)} · ${f2(s.avg)}R`); return acc; }, []).reduce((row, c) => [...row, c], [g.name, g.tf]).concat([`${f2(g.st.fresh.avg - g.st.fresh.ci)} … ${f2(g.st.fresh.avg + g.st.fresh.ci)}`]))));
  const better = grid.filter((g) => g !== base && g.tf === '5m' && ['train', 'test', 'fresh'].every((k) => g.st[k].avg > base.st[k].avg) && g.st.fresh.n >= 20);
  md += `\n**Şimdiki ayarı üç kümenin üçünde de geçen değişiklik:** ${better.length ? better.map((g) => `${g.name} (FRESH ${f2(g.st.fresh.avg)}R vs ${f2(base.st.fresh.avg)}R)`).join('; ') : 'yok. Şimdiki ayar bu komşulukta en az onun kadar iyi; ayarla oynamak kazanç getirmiyor.'}\n`;
}

md += section('4. Dürüst uyarılar', `- Bu bir geçmiş testi: ${periods.length} dönem, yaklaşık ${Object.values(SETS).flat().length * 2} haftalık veri. Küçük örneklerde (n<30) yüzdelere güvenme; güven aralığına bak.\n- Spread sabit ${SP} $; haber anı ve seans geçişlerinde gerçek spread çok açılır, kayma yok. Gerçekte sonuçlar biraz daha kötü olur.\n- Dukascopy fiyatı senin aracının fiyatı değil; kıl payı stop/hedef vuruşları farklı çıkabilir.\n- Çok sayıda ayar denendiğinde bir kısmı şans eseri iyi görünür. Bu yüzden yalnızca FRESH'te ve diğer kümelerde birlikte iyi olanı ciddiye al.\n- Hiçbir şey uygulamaya otomatik uygulanmadı; bu rapor sadece ölçüm.\n`);
fs.writeFileSync(`${OUT}/rapor.md`, md);

const cols = ['label', 'tf', 'set', 'time_utc', 'time_ny', 'side', 'source', 'prob', 'strong', 'entry', 'stop', 'target', 'r1', 'r2', 'mfe', 'mae', 'stop_min', 'at_level', 'level_kind', 'ahead_r', 'ahead_kind', 'double', 'swept', 'bias3', 'm15', 'adx', 'vol', 'loss_type', 'neden'];
const q = (x) => (typeof x === 'string' && /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
const csv = [cols.join(',')].concat(sigs.map((s) => {
  const np = nyParts(s.t);
  const why = `bias ${s.bias3 ? '3/3' : '2/3'} ${s.side === 'long' ? 'yukarı' : 'aşağı'}; ${s.source.replace(' + MSP', '')} engulf${s.double ? ' + yapı kırılımı' : ''}${s.swept ? '; aynı gün likidite alındı' : ''}${s.htf ? '; üst zaman dilimi bölgesi' : ''}; ${s.atLevel ? s.levelKind + ' seviyesinde' : 'seviyede değil'}; önünde ${s.aheadR >= 9 ? 'seviye yok' : f2(s.aheadR, 1) + 'R ' + s.aheadKind}`;
  return [s.label, s.tf, s.set, new Date(s.t).toISOString().slice(0, 16), `${np.dow} ${String(np.h).padStart(2, '0')}:${String(np.m).padStart(2, '0')}`, s.side, s.source, s.prob === undefined ? '' : s.prob.toFixed(3), s.strong, s.entry.toFixed(2), s.stop.toFixed(2), s.target.toFixed(2), s.r1.toFixed(2), s.r2.toFixed(2), s.mfe.toFixed(2), s.mae.toFixed(2), s.stopMin, s.atLevel, s.levelKind, s.aheadR.toFixed(2), s.aheadKind, s.double, s.swept, s.bias3, s.m15, s.adx.toFixed(1), s.vol.toFixed(2), s.loss, why].map(q).join(',');
})).join('\n');
fs.writeFileSync(`${OUT}/sinyaller.csv`, '﻿' + csv);
log('BİTTİ', `${sigs.length} sinyal`, `${OUT}/rapor.md`);
