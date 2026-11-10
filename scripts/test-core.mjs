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
