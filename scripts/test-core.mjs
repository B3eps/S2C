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
test('Parça: sinyal engulf mumundan sonra gelir, aynı mumda değil', () => {
  const marks = setupAt('1m', END).marks;
  const signals = marks.filter((m) => m.kind === 'signal');
  assert.ok(signals.length > 0);
  for (const s of signals) {
    assert.ok(!marks.some((m) => m.kind === 'engulf' && m.t === s.t), 'aynı mumda engulf ve sinyal');
    assert.ok(marks.some((m) => m.kind === 'engulf' && m.side === s.side && m.t < s.t && s.t - m.t <= 8 * MINUTE));
  }
});
test('Parça: FVG tepkisi, iFVG ve üst zaman dilimi bölgeleri ayrı ayrı yakalanır', () => {
  const of = (tf) => new Set(setupAt(tf, END).marks.filter((m) => m.kind === 'engulf').map((m) => m.source));
  const low = [...of('1m')], own = [...of('15m')];
  assert.ok(low.some((s) => / FVG$/.test(s)), low.join());
  assert.ok(low.some((s) => /iFVG$/.test(s)), low.join());
  // 1dk grafikte bölge yalnızca 15dk ve üstünden gelir; 15dk grafikte kendi bölgesi etiketsizdir
  assert.ok(low.every((s) => /^(15dk|1sa|4sa) /.test(s)), low.join());
  assert.ok(own.some((s) => /^(FVG|iFVG|OB)$/.test(s)), own.join());
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
