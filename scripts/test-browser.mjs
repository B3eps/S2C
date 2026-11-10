import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

// Each run uses a fresh origin and a disposable browser profile.
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.S2C_BROWSER || 'chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const start = Date.UTC(2025, 0, 7, 10, 12);
  await page.route('**/api/candles?**', route => {
    const q = new URL(route.request().url()).searchParams;
    const step = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240 }[q.get('tf')] * 60000;
    const rows = [];
    for (let t = Math.ceil(Number(q.get('from')) / step) * step; t < Number(q.get('to')); t += step) {
      // Full hourly bars deliberately include an extreme absent in the first twelve minutes.
      rows.push([t, 100, step < 3600000 ? 101 : 180, 99, 100, 1]);
    }
    return route.fulfill({ json: rows });
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Panel', exact: true }).waitFor();
  const probe = await page.evaluate(async start => {
    const db = await import('/src/lib/db.ts');
    const { fetchRange } = await import('/src/lib/feed.ts');
    const { DEFAULT_RULES } = await import('/src/lib/types.ts');
    const setupId = window.__s2c.getState().activeSetupId;
    const a = { id:'a', setupId, no:'S2C-1', status:'active', phase:'challenge', size:5000, balance:5400, createdAt:start, rules:{ ...DEFAULT_RULES, minDays:3, minDayPct:0.31 }, tradingDays:[], payouts:[] };
    const session = { id:'s', setupId, accountId:'a', startMs:start, clockMs:start, startedAt:start, dayKey:'2025-01-07', dayStartEquity:5400,
      firstPrice:100, orders:[{ id:'o',side:'long',type:'limit',lots:0.01,price:90,createdAt:start }],
      positions:[{id:'p',side:'long',lots:0.01,entry:100,openedAt:start,orderType:'market',shotOpen:'img'}],
      drawings:[{id:'d',kind:'trend',a:{t:start-60000,p:99},b:{t:start,p:100}}] };
    const trade = { id:'t',setupId,accountId:'a',sessionId:'s',tf:'1h',side:'long',orderType:'market',reason:'manual',entry:110,exit:100,lots:0.01,pnl:-10,openedAt:start-60000,closedAt:start,realClosedAt:Date.now(),note:'' };
    await db.store.putAccount(a);
    await db.store.putSession(session);
    await db.store.putTrade(trade);
    await db.store.putAccount({ ...a, id:'arch', no:'S2C-2', archived:true });
    await db.store.putSession({ ...session, accountId:'arch', id:'arch-s', endedAt:Date.now(), positions:[], orders:[] });
    await db.store.putTrade({ ...trade, id:'arch-t', accountId:'arch', sessionId:'arch-s', pnl:24, note:'Arşiv testi' });
    await db.store.putShot('img', 'data:image/png;base64,iVBORw0KGgo=');
    const file = await db.exportBackup();
    await db.store.putAccount({ ...a, balance:1 });
    await db.importBackup(new File([file], 'valid.json'));
    const data = JSON.parse(await file.text());
    data.accounts[0].rules = {};
    let rejected = false;
    try { await db.importBackup(new File([JSON.stringify(data)], 'invalid.json')); } catch { rejected = true; }
    localStorage.setItem('s2c:view','trade');
    const partial = await fetchRange('1h', start - 7200000, start);
    return [partial.at(-1).h, partial.at(-1).v, rejected, (await db.store.accounts())[0].balance];
  }, start);
  assert.deepEqual(probe, [101,12,true,5400]);
  await page.reload();
  await page.waitForFunction(() => window.__s2c?.getState().session?.id === 's');
  const restored = await page.evaluate(() => {
    const s = window.__s2c.getState().session;
    return [s.clockMs,s.orders[0].id,s.positions[0].shotOpen,s.drawings[0].id];
  });
  assert.deepEqual(restored,[start,'o','img','d']);
  await page.getByRole('button',{name:'Gün sonuna ilerle'}).click();
  await page.waitForFunction(() => window.__s2c.getState().session?.dayKey === '2025-01-08', null, { timeout: 30000 });
  const dayEnd = await page.evaluate(() => {
    const s = window.__s2c.getState().session;
    return [s.dayKey, s.positions.length, s.clockMs >= Date.UTC(2025,0,7,22)];
  });
  assert.deepEqual(dayEnd,['2025-01-08',1,true]);
  const compactGauge = await page.evaluate(() => {
    const value = document.querySelector('.gauge.goal .val');
    const style = getComputedStyle(value);
    return { text:value.textContent, title:value.title, overflow:style.overflow, ellipsis:style.textOverflow };
  });
  assert.match(compactGauge.text,/Hedef tamam/);
  assert.equal(compactGauge.title,compactGauge.text);
  assert.deepEqual([compactGauge.overflow,compactGauge.ellipsis],['hidden','ellipsis']);
  for (const width of [1280,1920]) {
    await page.setViewportSize({ width, height:900 });
    for (const count of [1,4,8]) {
      await page.evaluate(count => window.__s2c.getState().setPrefs({ count }),count);
      await page.waitForFunction(n => document.querySelectorAll('.chart-panel').length === n || document.querySelectorAll('.charts.grid > *').length === n,count);
      const metrics = await page.evaluate(async () => {
        const ms = [];
        let t = performance.now();
        for (let i=0;i<32;i++) {
          window.__s2c.getState().stepMinutes(1);
          await new Promise(requestAnimationFrame);
          ms.push(performance.now()-t); t=performance.now();
        }
        return { p95ms: Math.round(ms.sort((a,b)=>a-b)[30]), heapMB: Math.round((performance.memory?.usedJSHeapSize || 0)/1048576) };
      });
      console.log({width,count,...metrics});
    }
  }
  await page.getByRole('button',{name:'İstatistik', exact:true}).click();
  await page.getByRole('heading',{name:'İşlem takvimi'}).waitFor();
  await page.getByRole('combobox', {name:'Hesap', exact:true}).selectOption('arch');
  await page.locator('button.calendar-cell').first().click();
  await page.getByRole('button',{name:/Günlükte aç/}).first().click();
  await page.getByRole('button',{name:'Tekrar izle'}).waitFor();
  assert.equal(await page.locator('textarea').inputValue(), 'Arşiv testi');
  await page.getByRole('button',{name:'Ayarlar',exact:true}).click();
  const oldSetupId = await page.evaluate(() => window.__s2c.getState().activeSetupId);
  await page.getByLabel('Yeni setup adı').fill('Londra açılışı');
  await page.getByLabel('Neden yeni setup açıyorsun?').fill('Günlük kayıplardan sonra farklı planı ayır.');
  await page.getByRole('button',{name:/Mevcut setup'ı arşivle/}).click();
  await page.waitForFunction(() => window.__s2c?.getState().ready && window.__s2c.getState().accounts.length === 0);
  const newSetup = await page.evaluate(() => {
    const s = window.__s2c.getState();
    return [s.setups.find(x => x.id === s.activeSetupId)?.name, s.setups.find(x => x.id === s.activeSetupId)?.note, s.trades.length];
  });
  assert.deepEqual(newSetup,['Londra açılışı','Günlük kayıplardan sonra farklı planı ayır.',0]);
  await page.getByRole('button',{name:'Ayarlar',exact:true}).click();
  await page.getByRole('combobox',{name:'Setup klasörleri'}).selectOption(oldSetupId);
  await page.waitForFunction(() => window.__s2c?.getState().ready && window.__s2c.getState().accounts.length === 2);
  assert.equal(await page.evaluate(() => window.__s2c.getState().trades.length),3);
  assert.deepEqual(errors,[]);
  console.log('Replay cutoff, restore, day-end replay, setup isolation, charts and calendar navigation passed.');
} finally {
  await browser?.close();
  await server.close();
}
