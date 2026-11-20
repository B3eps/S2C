import { build } from 'esbuild';
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const exec = await load('src/lib/execution.ts');
const stats = await load('src/lib/stats.ts');
const calendar = await load('src/lib/calendar.ts');
const backup = await load('src/lib/db.ts');
const programs = await load('src/lib/programs.ts');
const bar = { t: 0, o: 100, h: 110, l: 90, c: 104, v: 1 };
const pos = { side: 'long', sl: 95, tp: 108 };

test('açık pozisyonda aynı mumda SL ve TP görülürse stop önceliklidir', () => {
  assert.deepEqual(exec.positionExit(pos, bar, false, false), { price: 95, reason: 'sl' });
});
test('fiyat boşluğunda stop açılış fiyatından gerçekleşir', () => {
  assert.deepEqual(exec.positionExit(pos, { ...bar, o: 92 }, false, false), { price: 92, reason: 'sl' });
});
test('mum içinde dolan emrin aynı mumdaki stopu işlenir', () => {
  const fill = exec.pendingFill({ side: 'long', type: 'limit', price: 98 }, bar);
  assert.equal(fill, 98);
  assert.deepEqual(exec.positionExit(pos, bar, true, false), { price: 95, reason: 'sl' });
});
test('mum içinde girişten önce gerçekleşmiş olabilecek hedef ertelenir', () => {
  assert.equal(exec.positionExit({ side: 'long', tp: 108 }, bar, true, false), undefined);
  assert.deepEqual(exec.positionExit({ side: 'long', tp: 108 }, bar, true, true), { price: 108, reason: 'tp' });
});
test('short stop emri ve short stop kapanışı', () => {
  assert.equal(exec.pendingFill({ side: 'short', type: 'stop', price: 95 }, bar), 95);
  assert.deepEqual(exec.positionExit({ side: 'short', sl: 105, tp: 92 }, bar, false, false), { price: 105, reason: 'sl' });
});
test('istatistik net sonuç, kazanma oranı ve düşüşü hesaplar', () => {
  const s = stats.summarize([{ pnl: 100, r: 1, realClosedAt: 1 }, { pnl: -40, r: -1, realClosedAt: 2 }]);
  assert.equal(s.net, 60); assert.equal(s.winRate, 50); assert.equal(s.maxDD, 40); assert.equal(s.profitFactor, 2.5);
});
test('BEM ödülü %2 işlem kesintisini düşürür ve eski kural kaydı varsayılan olarak korunur', () => {
  assert.equal(programs.payoutNet(1000, 80, 2), 784);
  assert.equal(programs.payoutNet(1000, 80), 800);
});
test('takvim gerçek NFP ve CPI tarihlerini ve yaz saatini kullanır', () => {
  const events = calendar.eventsBetween(Date.UTC(2025, 0, 1), Date.UTC(2025, 0, 31));
  assert.ok(events.some((e) => e.label === 'NFP' && e.t === Date.UTC(2025, 0, 10, 13, 30)));
  assert.ok(events.some((e) => e.label === 'CPI' && e.t === Date.UTC(2025, 0, 15, 13, 30)));
  assert.equal(calendar.marketSession(Date.UTC(2025, 6, 15, 12)).key, 'overlap');
});
test('geçersiz yedek yazma işleminden önce reddedilir', async () => {
  const bad = { app: 's2c', version: 1, accounts: [{ id: 'a', size: 5000, balance: 'hatalı', rules: {}, tradingDays: [], payouts: [] }], sessions: [], trades: [], shots: [], kv: [] };
  await assert.rejects(() => backup.inspectBackup({ text: async () => JSON.stringify(bad) }), /geçersiz/);
});
test('eksik bölümü olan yedek reddedilir', async () => {
  await assert.rejects(() => backup.inspectBackup({ text: async () => JSON.stringify({ app: 's2c', version: 1, accounts: [] }) }), /eksik/);
});

test('minimum lot 5 dolarlık risk bütçesini aşarsa sıfır lot', () => {
  assert.equal(exec.riskLots(5, 10), 0);
  assert.equal(exec.riskLots(10, 10), 0.01);
});
test('eşit karşıt pozisyonlarda gerçekleşmemiş fiyat birleşimi ihlal üretmez', () => {
  assert.equal(exec.worstEquity(5000, ['long','short'].map(side => ({ side, entry: 100, lots: 1 })), bar), 5000);
});
test('eksik kurallı hesap yedeği reddedilir', async () => {
  const a = { id:'a', no:'S2C-1', createdAt:1, phase:'challenge', status:'active', size:5000, balance:5000, rules:{}, tradingDays:[], payouts:[] };
  const bad = { app:'s2c', version:1, accounts:[a], sessions:[], trades:[], shots:[], kv:[] };
  await assert.rejects(backup.inspectBackup({ text:async()=>JSON.stringify(bad) }), /kuralları/);
});
test('eski yedek tek bir varsayılan setup klasörüne taşınır', async () => {
  const account = { id:'a', no:'S2C-1', createdAt:1, phase:'challenge', status:'active', size:5000, balance:5000, rules:{ target:8, dailyLoss:5, maxLoss:10, split:80, minDays:0, payoutMin:0 }, tradingDays:[], payouts:[] };
  const old = { app:'s2c', version:1, exportedAt:10, accounts:[account], sessions:[], trades:[], shots:[], kv:[] };
  const restored = await backup.inspectBackup({ text:async()=>JSON.stringify(old) });
  assert.equal(restored.accounts[0].setupId, restored.setups[0].id);
  assert.equal(restored.setups.length, 1);
});

// ── piyasa saatleri, işlem günü, veri akışı, Parça Setup, spread ─────────────
const market = await load('src/lib/market.ts');
const feedMod = await load('src/lib/feed.ts');
const parca = await load('src/lib/parcaSetup.ts');
const indicators = await load('src/lib/indicators.ts');
const HOUR = 3_600_000, MINUTE = 60_000;

test('altın kışın cuma 22:00 UTC, yazın 21:00 UTC kapanır; pazar açılışı da kayar', () => {
  assert.equal(market.isClosed(Date.UTC(2024, 10, 8, 21, 30)), false);
  assert.equal(market.isClosed(Date.UTC(2024, 10, 8, 22, 0)), true);
  assert.equal(market.isClosed(Date.UTC(2024, 10, 10, 22, 30)), true);
  assert.equal(market.isClosed(Date.UTC(2024, 10, 10, 23, 0)), false);
  assert.equal(market.isClosed(Date.UTC(2024, 6, 12, 20, 59)), false);
  assert.equal(market.isClosed(Date.UTC(2024, 6, 12, 21, 0)), true);
  assert.equal(market.isClosed(Date.UTC(2024, 6, 14, 22, 0)), false);
});

const hourly = (from, to, price = () => 100) => {
  const out = [];
  for (let t = from; t < to; t += HOUR) if (!market.isClosed(t)) { const p = price(t); out.push({ t, o: p, h: p + 1, l: p - 1, c: p, v: 1 }); }
  return out;
};
test('günlük mum 17:00 New York’ta kesilir; pazar akşamı pazartesiye eklenir', () => {
  assert.equal(market.dayStart(Date.UTC(2024, 10, 10, 23, 30)), market.dayStart(Date.UTC(2024, 10, 11, 12)));
  assert.notEqual(market.dayStart(Date.UTC(2024, 10, 11, 21, 59)), market.dayStart(Date.UTC(2024, 10, 11, 22)));
  const days = market.dailyBars(hourly(Date.UTC(2024, 10, 6, 22), Date.UTC(2024, 10, 13, 22)));
  assert.equal(days.length, 5);
  const monday = days.find((d) => d.end === Date.UTC(2024, 10, 11, 22));
  assert.equal(monday.t, Date.UTC(2024, 10, 10, 23));
});

test('4sa mumlar 1sa mumlardan kurulur ve pazar açılışını içerir', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const q = new URL(url, 'http://local').searchParams;
    assert.equal(q.get('tf'), '1h');
    const rows = hourly(Math.ceil(Number(q.get('from')) / HOUR) * HOUR, Number(q.get('to')), (t) => 100 + (t / HOUR) % 24).map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]);
    return { ok: true, json: async () => rows };
  };
  try {
    const bars = await feedMod.fetchRange('4h', Date.UTC(2024, 10, 8, 16), Date.UTC(2024, 10, 11, 4));
    assert.deepEqual(bars.map((b) => b.t), [Date.UTC(2024, 10, 8, 16), Date.UTC(2024, 10, 8, 20), Date.UTC(2024, 10, 10, 20), Date.UTC(2024, 10, 11, 0)]);
    assert.equal(bars[1].c, 121); // cuma 21:00 mumu dahil
    assert.equal(bars[2].o, 123); // pazar 23:00 açılışı
  } finally { globalThis.fetch = realFetch; }
});

test('spread: long limit satış fiyatı seviyeye inince dolar', () => {
  assert.equal(exec.pendingFill({ side: 'long', type: 'limit', price: 90 }, bar, 0.5), undefined);
  assert.equal(exec.pendingFill({ side: 'long', type: 'limit', price: 90.5 }, bar, 0.5), 90.5);
  assert.equal(exec.pendingFill({ side: 'long', type: 'stop', price: 110.4 }, bar, 0.5), 110.4);
  assert.equal(exec.pendingFill({ side: 'short', type: 'stop', price: 90 }, bar, 0.5), 90);
});
test('spread: short stop ve hedef satış fiyatından tetiklenir', () => {
  assert.deepEqual(exec.positionExit({ side: 'short', sl: 110.3 }, bar, false, false, 0.5), { price: 110.3, reason: 'sl' });
  assert.equal(exec.positionExit({ side: 'short', tp: 90.2 }, bar, false, false, 0.5), undefined);
  assert.deepEqual(exec.positionExit({ side: 'short', tp: 90.5 }, bar, false, false, 0.5), { price: 90.5, reason: 'tp' });
  assert.deepEqual(exec.positionExit({ side: 'long', sl: 95, tp: 108 }, bar, false, false, 0.5), { price: 95, reason: 'sl' });
  assert.equal(exec.markPrice('short', 100, 0.5), 100.5);
  assert.equal(exec.markPrice('long', 100, 0.5), 100);
});
test('spread: açık short için en kötü özkaynak satış fiyatıyla hesaplanır', () => {
  assert.equal(exec.worstEquity(5000, [{ side: 'short', entry: 100, lots: 1 }], bar, 0.5), 5000 - 10.5 * 100);
});

// Deterministic synthetic market: random walk with bursts, so gaps and structure breaks occur.
function synthetic(from, minutes, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let p = 2000, drift = 0;
  for (let i = 0, t = from; out.length < minutes; i++, t += MINUTE) {
    if (market.isClosed(t)) continue;
    if (i % 45 === 0) drift = (rnd() - 0.5) * 1.6;
    const o = p + (rnd() - 0.5) * 0.04;
    const c = o + drift * rnd() + (rnd() - 0.5) * 0.9;
    out.push({ t, o, h: Math.max(o, c) + rnd() * 0.3, l: Math.min(o, c) - rnd() * 0.3, c, v: 1 });
    p = c;
  }
  return out;
}
function aggregate(minutes, ms) {
  const out = [];
  for (const m of minutes) {
    const t = Math.floor(m.t / ms) * ms, last = out[out.length - 1];
    if (last?.t === t) { last.h = Math.max(last.h, m.h); last.l = Math.min(last.l, m.l); last.c = m.c; last.v += m.v; }
    else out.push({ ...m, t });
  }
  return out;
}
const TF_OF = { '1m': MINUTE, '5m': 5 * MINUTE, '15m': 15 * MINUTE, '1h': HOUR, '4h': 4 * HOUR };
const SYN = synthetic(Date.UTC(2024, 10, 3, 23), 9000);
function setupAt(tf, clock, params) {
  const mins = SYN.filter((m) => m.t + MINUTE <= clock);
  const series = Object.fromEntries(['15m', '1h', '4h'].map((k) => [k, aggregate(mins, TF_OF[k])]));
  return parca.analyzeParcaSetup({ tf, bars: aggregate(mins, TF_OF[tf]), clock, series, days: market.dailyBars(series['1h']), params });
}
const END = SYN.at(-1).t + MINUTE;
const markKey = (m) => `${m.t}|${m.side}|${m.kind}|${m.source}`;

test('Parça: oluşan (kapanmamış) mumda işaret çıkmaz', () => {
  for (let k = 0; k < 400; k += 7) {
    const clock = END - k * MINUTE;
    const forming = Math.floor((clock - 1) / TF_OF['5m']) * TF_OF['5m'];
    if (forming + TF_OF['5m'] <= clock) continue;
    assert.equal(setupAt('5m', clock).marks.filter((m) => m.t >= forming).length, 0);
  }
});
test('Parça: geçmiş işaretler sonradan değişmez (repaint ve gelecek veri yok)', () => {
  const full = setupAt('5m', END).marks;
  assert.ok(full.filter((m) => m.kind === 'signal').length >= 3, 'sentetik veride sinyal bekleniyor');
  for (const back of [37, 611, 1444, 3003, 5200]) {
    const clock = END - back * MINUTE;
    const closed = Math.floor(clock / TF_OF['5m']) * TF_OF['5m'];
    assert.deepEqual(setupAt('5m', clock).marks.map(markKey), full.filter((m) => m.t + TF_OF['5m'] <= closed).map(markKey));
  }
});
test('Parça: bias aynı anda bütün zaman dilimlerinde aynıdır', () => {
  for (const back of [0, 13, 250, 1777, 4000]) {
    const clock = END - back * MINUTE;
    const b = ['1m', '5m', '15m', '1h', '4h'].map((tf) => setupAt(tf, clock).bias);
    assert.equal(new Set(b).size, 1, `${back}: ${b}`);
  }
});
test('Parça: muhafazakâr bias karşıt oyu veto eder; çoğunluk modu ayrı çalışır', () => {
  const up = [{ t: 0, end: HOUR, o: 100, h: 101, l: 99, c: 100, v: 1 },
    { t: HOUR, end: 2 * HOUR, o: 100, h: 103, l: 100, c: 102, v: 1 }];
  const down = [{ t: 0, o: 100, h: 103, l: 100, c: 102, v: 1 },
    { t: HOUR, o: 102, h: 101, l: 98, c: 99, v: 1 }];
  assert.equal(parca.biasAt(5 * HOUR, up, up, down, 2), 0);
  assert.equal(parca.biasAt(5 * HOUR, up, up, down, 6), 1);
});
test('Parça: sinyal, bias yönünde engulf ile yapı kırılımının pencere içinde buluşmasıdır', () => {
  const marks = setupAt('1m', END, { session: 0 }).marks;
  const signals = marks.filter((m) => m.kind === 'signal');
  assert.ok(signals.length >= 5, 'sentetik veride sinyal bekleniyor');
  for (const sig of signals) {
    assert.ok(marks.some((m) => m.kind === 'engulf' && m.side === sig.side && m.t <= sig.t && sig.t - m.t <= 8 * MINUTE), 'engulf yok');
    const long = sig.side === 'long';
    assert.ok(long ? sig.stop < sig.entry : sig.stop > sig.entry, 'stop yanlış tarafta');
    assert.ok(Math.abs((sig.target - sig.entry) - (sig.entry - sig.stop)) < 1e-9, 'ilk hedef 1R olmalı');
  }
  // çift teyit: engulf ile yapı kırılımı aynı mumda da olabilir
  assert.ok(signals.some((sig) => marks.some((m) => m.kind === 'engulf' && m.t === sig.t)));
});
test('Parça: engulf, karşı yönlü FVG ya da order block’un içinden kapanıştır', () => {
  const of = (tf) => [...new Set(setupAt(tf, END, { session: 0 }).marks.filter((m) => m.kind === 'engulf').map((m) => m.source))];
  const low = of('1m');
  assert.ok(low.every((x) => /(^| )(iFVG|OB)$/.test(x)), low.join());
  // 1dk grafikte hem kendi boşlukları hem üst zaman dilimi bölgeleri engulf edilir
  assert.ok(low.includes('iFVG'), low.join());
  assert.ok(low.some((x) => /^(5dk|15dk|1sa|4sa) /.test(x)), low.join());
});
test('Parça: seans filtresi Asya saatinde sinyal vermez; elle bias yalnız o yönde sinyal verir', () => {
  const filtered = setupAt('1m', END).marks.filter((m) => m.kind === 'signal');
  assert.ok(filtered.every((m) => calendar.marketSession(m.t).key !== 'asia'));
  const longOnly = setupAt('1m', END, { biasMode: 4, session: 0 }).marks.filter((m) => m.kind !== 'sweep');
  assert.ok(longOnly.length > 0 && longOnly.every((m) => m.side === 'long'));
  assert.equal(setupAt('5m', END, { biasMode: 5 }).bias, -1);
});
test('Parça: mum mum ilerleyen motor, tek geçişle aynı işaretleri verir', () => {
  const engine = parca.createSetupEngine('5m');
  let result;
  for (let clock = END - 3000 * MINUTE; clock <= END; clock += 7 * MINUTE) {
    const mins = SYN.filter((m) => m.t + MINUTE <= clock);
    const series = Object.fromEntries(['15m', '1h', '4h'].map((k) => [k, aggregate(mins, TF_OF[k])]));
    result = engine({ bars: aggregate(mins, TF_OF['5m']), clock, series, days: market.dailyBars(series['1h']) });
  }
  const once = setupAt('5m', END - (3000 % 7) * MINUTE);
  assert.deepEqual(result.marks.map(markKey), once.marks.map(markKey));
  assert.deepEqual(result.zones, once.zones);
  assert.equal(result.bias, once.bias);
});
test('pivot noktaları bir önceki tam işlem gününden hesaplanır', () => {
  const h1 = hourly(Date.UTC(2024, 10, 11, 22), Date.UTC(2024, 10, 13, 22), (t) => (t < Date.UTC(2024, 10, 12, 22) ? 100 : 200));
  const days = market.dailyBars(h1);
  const bars = h1.slice(-6);
  const out = indicators.IND_BY_ID.pivots.calc(bars, {}, { days });
  assert.equal(out.p.at(-1), (101 + 99 + 100) / 3);
  assert.equal(out.r1.at(-1), 2 * 100 - 99);
});

test('Parça Gold: hedef 1R; Gold A+ sinyalleri Gold sinyallerinin alt kümesidir; eski ayar taşınır', async () => {
  const v = await load('src/lib/parcaVariants.ts');
  const open = { session: 0 };
  const gold = setupAt('5m', END, { ...v.GOLD_SETUP_DEFAULTS, ...open, adx: 0 }).marks.filter((m) => m.kind === 'signal');
  assert.ok(gold.length > 0);
  for (const s of gold) assert.ok(Math.abs((s.target - s.entry) - (s.entry - s.stop)) < 1e-9, 'hedef 1R olmalı');
  const strict = setupAt('5m', END, { ...v.GOLD_A_SETUP_DEFAULTS, ...open }).marks.filter((m) => m.kind === 'signal').map(markKey);
  const loose = new Set(setupAt('5m', END, { ...v.GOLD_SETUP_DEFAULTS, ...open, ema: 0 }).marks.filter((m) => m.kind === 'signal').map(markKey));
  assert.ok(strict.every((k) => loose.has(k)), 'A+ yalnızca Gold sinyallerinden seçer');
  const scored = setupAt('5m', END, { ...v.GOLD_SETUP_DEFAULTS, ...open, ema: 0 }).marks.filter((m) => m.kind === 'signal');
  // olasılık, 288 mumluk ATR ortalaması oluştuktan sonra hesaplanır
  const withProb = scored.filter((m) => m.prob !== undefined);
  assert.ok(withProb.length > 0 && withProb.every((m) => m.prob > 0 && m.prob < 1), 'Gold sinyallerinin olasılığı var');
  const aplus = setupAt('5m', END, { ...v.GOLD_A_SETUP_DEFAULTS, ...open }).marks.filter((m) => m.kind === 'signal');
  assert.ok(aplus.every((m) => m.prob >= 0.55));
  assert.equal(v.variantParams('parca-setup-gold', { pivot: 3, sweep: 2, entry: 2, ema: 1 }).adx, 20);
  assert.equal(v.variantParams('parca-setup-gold-a', { adx: 27.5, vol: 1.2 }).minP, 0.55);
});
test('1dk eğitimli filtre Gold sinyallerini eler ve başka zaman diliminde sinyal üretmez', async () => {
  const v = await load('src/lib/parcaVariants.ts');
  const model = await load('src/lib/parcaModel1m.ts');
  const params = { ...v.GOLD_SETUP_DEFAULTS, session: 0, adx: 0, room: 0, noOB: 0 };
  const base = setupAt('1m', END, params).marks.filter((m) => m.kind === 'signal');
  const selected = setupAt('1m', END, { ...params, trained1m: 1 }).marks.filter((m) => m.kind === 'signal');
  assert.ok(base.length > 0 && selected.length > 0 && selected.length < base.length);
  const expected = base.filter((m) => model.trained1mScore(m.source, !!m.strong, m.side, m.t) >= model.TRAINED_1M_THRESHOLD);
  assert.deepEqual(selected.map(markKey), expected.map(markKey));
  assert.ok(selected.every((m) => m.prob === undefined), '5dk olasılık modeli bu sürümde gösterilmez');
  assert.equal(setupAt('5m', END, { ...params, trained1m: 1 }).marks.filter((m) => m.kind === 'signal').length, 0);
  assert.equal(v.variantParams(v.PARCA_TRAINED_1M_ID, { rr: 5 }).rr, v.GOLD_SETUP_DEFAULTS.rr);
});
test('Parça Gold (EMA teyitli): geçmiş işaretler sonradan değişmez, sinyaller EMA yönünde', async () => {
  const { GOLD_SETUP_DEFAULTS } = await load('src/lib/parcaVariants.ts');
  const params = { ...GOLD_SETUP_DEFAULTS, session: 0, room: 0, noOB: 0 };
  const full = setupAt('5m', END, params).marks;
  const loose = setupAt('5m', END, { ...params, ema: 0 }).marks.filter((m) => m.kind === 'signal');
  assert.ok(full.filter((m) => m.kind === 'signal').length < loose.length, 'EMA teyidi sinyal elemeli');
  for (const back of [97, 1300, 4100]) {
    const clock = END - back * MINUTE;
    const closedAt = Math.floor(clock / TF_OF['5m']) * TF_OF['5m'];
    assert.deepEqual(setupAt('5m', clock, params).marks.map(markKey), full.filter((m) => m.t + TF_OF['5m'] <= closedAt).map(markKey));
  }
});

test('Parça Gold: önünde yakın seviye varsa ve OB / 4sa+ iFVG bölgesindeyse girmez; bunlar sinyalleri yalnız eler', async () => {
  const { GOLD_SETUP_DEFAULTS } = await load('src/lib/parcaVariants.ts');
  const base = { ...GOLD_SETUP_DEFAULTS, session: 0, ema: 0, adx: 0, room: 0, noOB: 0 };
  const all = setupAt('5m', END, base).marks.filter((m) => m.kind === 'signal');
  const some = setupAt('5m', END, { ...base, room: 2, noOB: 1 }).marks.filter((m) => m.kind === 'signal');
  const keys = new Set(all.map(markKey));
  assert.ok(some.length < all.length, 'filtre sinyal elemeli');
  assert.ok(some.every((m) => keys.has(markKey(m))), 'filtreli sinyaller alt kümedir');
  assert.ok(some.every((m) => m.liqR === undefined || m.liqR >= 2), 'önünde 2R içinde seviye olan sinyal kalmamalı');
  assert.ok(some.every((m) => !/OB/.test(m.source)), 'OB girişi kalmamalı');
});

test('FTM Infinity: yarı fiyat, 3% statik zarar; Plus: 10% hedef, 5% statik zarar', () => {
  const inf = programs.PROGRAMS.find((p) => p.id === 'ftm-infinity');
  const plus = programs.PROGRAMS.find((p) => p.id === 'ftm-infinity-plus');
  assert.deepEqual([5000, 10000, 20000].map((s) => programs.salePrice(inf.prices[s], inf.discount)), [34, 69, 129]);
  assert.deepEqual([5000, 10000, 20000].map((s) => programs.salePrice(plus.prices[s], plus.discount)), [39, 79, 149]);
  assert.equal(inf.rules.maxLoss, 3);
  assert.equal(plus.rules.maxLoss, 5);
  assert.equal(plus.rules.target, 10);
  assert.equal(inf.rules.maxType, 'static');
});
test('FTM kâr payı ödeme sayısıyla 80 → 85 → 90 olur; BEM sabit kalır', () => {
  const r = programs.PROGRAMS.find((p) => p.id === 'ftm-infinity').rules;
  assert.deepEqual([0, 3, 4, 5, 9].map((n) => programs.splitFor(r, n)), [80, 80, 85, 90, 90]);
  assert.equal(programs.splitFor(programs.PROGRAMS[0].rules, 7), 80);
});

const bookPosition = (overrides = {}) => ({ id: 'p', side: 'long', lots: 0.1, entry: 100, openedAt: -60000, orderType: 'market', ...overrides });
const candleBook = (overrides = {}) => ({
  balance: 5000, peak: 5000, positions: [bookPosition()], orders: [], spread: 0.2,
  commissionPct: 0.005, leverage: 10, dayFloor: 4950, maxFloor: () => 4750, ...overrides,
});
const near = (actual, wanted) => assert.ok(Math.abs(actual - wanted) < 1e-7, `${actual} ≠ ${wanted}`);

test('TP ile ihlal sırası iki OHLC yolunda ayrışır, ihlal anında tasfiye edilir', () => {
  const book = candleBook({ positions: [bookPosition({ tp: 108 })] });
  const high = exec.simulateCandle(book, bar, 'high-first');
  const low = exec.simulateCandle(book, bar, 'low-first');
  assert.equal(high.events[0].reason, 'tp');
  assert.equal(high.breach, undefined);
  assert.equal(low.breach.floor, 'day');
  assert.equal(low.breach.crossing, true);
  near(low.events[0].price, 95.005);
  assert.deepEqual(exec.conservativeCandle(book, bar), low);
  assert.deepEqual(exec.conservativeCandle(book, bar), low);
});

test('stop ihlalden önce geçildiyse stop sonrası dip özkaynağı düşürmez', () => {
  const book = candleBook({ positions: [bookPosition({ sl: 98 })] });
  const result = exec.conservativeCandle(book, bar);
  assert.equal(result.breach, undefined);
  assert.equal(result.events[0].reason, 'sl');
  near(result.worst, 4979.901);
});

test('boşluk açılışında stop ile ihlal aynı anda görünürse önce hesap eşiği değerlendirilir', () => {
  const book = candleBook({ positions: [bookPosition({ sl: 98 })] });
  const result = exec.conservativeCandle(book, { ...bar, o: 92 });
  assert.equal(result.breach.crossing, false);
  assert.deepEqual(result.events, [{ kind: 'exit', id: 'p', price: 92, reason: 'violation' }]);
  const stop = exec.conservativeCandle({ ...book, dayFloor: 4900 }, { ...bar, o: 92 });
  assert.equal(stop.events[0].reason, 'sl');
  assert.equal(stop.events[0].price, 92);
});

test('limit girişinden önceki tepe hedefi tetiklemez, giriş sonrasındaki tepe tetikler', () => {
  const order = { id: 'x', side: 'long', type: 'limit', lots: 0.1, price: 98.2, tp: 108 };
  const book = candleBook({ positions: [], orders: [order], dayFloor: 4900 });
  const high = exec.simulateCandle(book, bar, 'high-first');
  const low = exec.simulateCandle(book, bar, 'low-first');
  assert.deepEqual(high.events, [{ kind: 'fill', order, price: 98.2 }]);
  assert.equal(low.events.at(-1).reason, 'tp');
});

test('short gap emirleri bid ile dolar ve koruma ask ile çalışır', () => {
  const order = { id: 'x', side: 'short', type: 'stop', lots: 0.1, price: 99, sl: 100.2 };
  const result = exec.simulateCandle(candleBook({ positions: [], orders: [order] }), { ...bar, o: 98 }, 'high-first');
  assert.equal(result.events[0].price, 98);
  near(result.events[1].price, 100.2);
  assert.equal(result.events[1].reason, 'sl');
});

test('hedge aynı bid anında değerlenir, kapanan bacak fiyat riskini değiştirir', () => {
  const short = bookPosition({ id: 's', side: 'short' });
  const hedge = candleBook({ positions: [bookPosition(), short] });
  near(exec.conservativeCandle(hedge, bar).worst, 4997.9);
  const closed = candleBook({ positions: [bookPosition({ tp: 101 }), short] });
  assert.equal(exec.simulateCandle(closed, bar, 'high-first').breach.floor, 'day');
  assert.equal(exec.simulateCandle(closed, bar, 'low-first').breach.floor, 'day');
});

test('çıkış komisyonu eşik üstündeki pozisyonu kapanışta ihlal ettirebilir', () => {
  const book = candleBook({ dayFloor: 4979.925, positions: [bookPosition({ sl: 98 })] });
  const result = exec.conservativeCandle(book, bar);
  assert.equal(result.events[0].reason, 'sl');
  assert.equal(result.breach.crossing, false);
  near(result.breach.equity, 4979.901);
});

test('dolum marjı fiyat boşluğunda tekrar kontrol edilir', () => {
  const order = { id: 'x', side: 'long', type: 'stop', lots: 0.5, price: 100 };
  const book = candleBook({ balance: 500, dayFloor: 400, maxFloor: () => 350, positions: [], orders: [order] });
  const result = exec.conservativeCandle(book, { ...bar, o: 102 });
  assert.deepEqual(result.events, [{ kind: 'cancel', order, allowed: 0.48 }]);
});

test('boşluk sayımı hafta sonu ile normal arayı hariç tutar ve uzun kesintiyi görür', () => {
  const wed = Date.UTC(2026,6,1,21);
  assert.equal(feedMod.missingQuoteMinutes(wed, wed + HOUR), 0);
  assert.equal(feedMod.missingQuoteMinutes(wed - MINUTE, wed + HOUR + MINUTE), 2);
  const friday = Date.UTC(2026,6,3,21);
  assert.equal(feedMod.missingQuoteMinutes(friday, Date.UTC(2026,6,5,22)), 0);
  assert.equal(feedMod.missingQuoteMinutes(wed + HOUR, wed + 6 * HOUR), 300);
});

test('önceki hedef marjı serbest bırakır, daha sonraki stop emri dolabilir', () => {
  const position = bookPosition({ tp: 104, lots: 0.45 });
  const order = { id: 'x', side: 'long', type: 'stop', lots: 0.06, price: 105 };
  const book = candleBook({ balance: 500, peak: 500, dayFloor: 0, maxFloor: () => 0, positions: [position], orders: [order] });
  const result = exec.simulateCandle(book, { ...bar, l: 98 }, 'high-first');
  assert.deepEqual(result.events.map(event => event.kind), ['exit', 'fill']);
  near(result.events[1].price, 105);
});

test('gerçekleşen hedef trailing tabanı yükseltince kalan pozisyon aynı fiyatta tekrar kontrol edilir', () => {
  const book = candleBook({ dayFloor: 0, maxFloor: peak => Math.min(5000, peak - 80),
    positions: [bookPosition({ tp: 108 }), bookPosition({ id: 's', side: 'short' })] });
  const result = exec.simulateCandle(book, bar, 'high-first');
  assert.equal(result.breach.floor, 'max');
  assert.equal(result.breach.crossing, false);
  assert.deepEqual(result.events.map(event => event.reason), ['tp', 'violation']);
  near(result.events[1].price, 108.2);
});

const scene = await load('src/lib/drawingScene.ts');
const env = { X: (t) => t, Y: (p) => 200 - p, W: 400, H: 200, bars: [], tfMs: 60000 };
test('yatay çizgi kendi yüksekliğinden tutulur, uzağından tutulmaz', () => {
  const shapes = scene.drawingShapes({ id: 'h', kind: 'hline', a: { t: 50, p: 100 }, b: { t: 50, p: 100 } }, env, false);
  assert.equal(scene.hitShapes(shapes, 300, 103), 'body');
  assert.equal(scene.hitShapes(shapes, 300, 120), null);
});
test('seçili çizimde tutamaç gövdeden önce gelir', () => {
  const d = { id: 't', kind: 'trend', a: { t: 10, p: 100 }, b: { t: 200, p: 150 } };
  assert.equal(scene.hitShapes(scene.drawingShapes(d, env, true), 11, 101), 'a');
  assert.equal(scene.hitShapes(scene.drawingShapes(d, env, false), 11, 101), 'body');
});

const instruments = await load('src/lib/instruments.ts');
test('enstrüman sözleşmesi risk lotunu belirler', () => {
  // 50 $ risk, 500 $ stop: BTC (1 lot = 1 BTC) 0,10 lot, altın sözleşmesiyle 0 lot
  assert.equal(exec.riskLots(50, 500, instruments.INSTRUMENT_BY_ID.btcusd.contract), 0.1);
  assert.equal(exec.riskLots(50, 500), 0);
});
test('FTM kripto kaldıracı ve komisyonu altından ayrıdır, eski kayıtlar altın sayılır', () => {
  const ftm = programs.PROGRAMS.find((p) => p.id === 'ftm-infinity').rules;
  const { btcusd, xauusd } = instruments.INSTRUMENT_BY_ID;
  assert.equal(instruments.leverageFor(ftm, btcusd), 8);
  assert.equal(instruments.leverageFor(ftm, xauusd), 10);
  assert.equal(instruments.commissionFor(ftm, btcusd), 0.03);
  assert.equal(instruments.commissionFor(ftm, xauusd), 0.005);
  assert.equal(instruments.instrumentOf({}).id, 'xauusd');
});
