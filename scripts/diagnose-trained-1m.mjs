// Post-test loss audit. Describes observations and testable hypotheses, not causes.
import fs from 'node:fs';
import { getHistoricalRates } from 'dukascopy-node';
import { build } from 'esbuild';

const file = 'analysis/gold-1m-holdout-2026-07-03_2026-08-11.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const bundle = await build({ entryPoints: ['src/lib/calendar.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const calendar = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const candles = await getHistoricalRates({ instrument: 'xauusd', dates: { from: new Date('2026-07-03T00:00:00Z'), to: new Date('2026-08-15T00:00:00Z') }, timeframe: 'm1', priceType: 'bid', format: 'json', volumes: true, ignoreFlats: true, useCache: true, cacheFolderPath: '.cache/dukascopy' });
const fmt = n => Number.isFinite(n) ? n.toFixed(2) : '—';
const rows = data.signals;
const context = (signal, trade) => {
  const path = candles.filter(b => b.timestamp >= trade.fillT && b.timestamp <= trade.exitT);
  const long = signal.side === 'long';
  const favorable = path.length ? Math.max(0, ...path.map(b => long ? b.high - trade.fill : trade.fill - (b.low + 0.2))) / trade.risk : NaN;
  const adverse = path.length ? Math.max(0, ...path.map(b => long ? trade.fill - b.low : b.high + 0.2 - trade.fill)) / trade.risk : NaN;
  const events = calendar.eventsBetween(signal.t - 60 * 60_000, signal.t + 60 * 60_000);
  return { favorable, adverse, news: events.map(e => e.label).join(', ') || 'yok' };
};
const lossRows = (key) => rows.filter(s => s[key]?.status === 'traded' && s[key].netPnlUsd <= 0);
const table = (key) => {
  const losses = lossRows(key);
  return [
    `### ${key === 'baseline' ? 'Gold' : 'Eğitimli filtre'}: ${losses.length} kayıp`,
    '',
    '| Sinyal UTC | Yön / kaynak | Giriş | Stop | Hedef | Çıkış / neden | Net R | Komisyon / risk | En fazla lehine / aleyhine | Haber ±60dk | Skor |',
    '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: |',
    ...losses.map(s => {
      const t = s[key];
      const c = context(s, t);
      return `| ${s.time} | ${s.side} / ${s.source}${s.strong ? ' ★' : ''} | ${fmt(t.fill)} | ${fmt(t.stop)} | ${fmt(t.target)} | ${fmt(t.exit)} / ${t.reason} | ${fmt(t.netR)} | ${fmt(t.commissionUsd / t.riskUsd)}R | ${fmt(c.favorable)}R / ${fmt(c.adverse)}R | ${c.news} | ${fmt(s.modelScore)} |`;
    }),
    '',
  ].join('\n');
};
const rejected = rows.filter(s => s.baseline?.status === 'traded' && s.modelFiltered?.status === 'filtered-below-threshold');
const rejectedWinners = rejected.filter(s => s.baseline.netPnlUsd > 0);
const rejectedLosers = rejected.filter(s => s.baseline.netPnlUsd <= 0);
const gapLosses = lossRows('baseline').filter(s => s.baseline.grossR < -1.1);
const avg = (a, fn) => a.length ? a.reduce((sum, x) => sum + fn(x), 0) / a.length : NaN;
const out = [
  '# 1 dakika kayıp ve filtre incelemesi', '',
  'Bu rapor dondurulmuş modelin yeni dönem mum replay sonuçlarını inceler. Tek işlemde neden-sonuç kanıtlanamaz; aşağıdaki sayılar gözlem ve yeni veride sınanacak hipotezlerdir. İşlemden sonra bilinen çıkış veya sonuç bilgisi sinyal girdisi olarak kullanılamaz.', '',
  'Dönem 2026-07-03–2026-08-11 UTC; spread $0,20, taraf başına %0,005 komisyon, bir sonraki mum açılışında giriş, aynı mumda stop öncelikli, tek açık pozisyon ve 240 mum azami bekleme. Bu ayrı mum araştırmasıdır, S2C hesap replay değildir.', '',
  table('baseline'), table('modelFiltered'),
  '## Filtre neleri dışarıda bıraktı?', '',
  `Gold replay'inde alınmış ${rejected.length} işlem model eşiğinin altındaydı: ${rejectedWinners.length} kârlı, ${rejectedLosers.length} zararlı. Bunlar aynı piyasa dönemindeki gözlemler; filtrelenmiş replay farklı zamanlarda başka işlem alabileceğinden doğrudan hesap P/L farkı olarak toplanamaz.`, '',
  '| Sinyal UTC | Yön / kaynak | Gold sonucu | Net R | Model skoru |', '| --- | --- | --- | ---: | ---: |',
  ...rejected.map(s => `| ${s.time} | ${s.side} / ${s.source} | ${s.baseline.reason} | ${fmt(s.baseline.netR)} | ${fmt(s.modelScore)} |`), '',
  '## İncelenecek noktalar', '',
  `- Gold zararlarında ortalama komisyon/başlangıç riski ${fmt(avg(lossRows('baseline'), s => s.baseline.commissionUsd / s.baseline.riskUsd))}R; filtreli kayıplarda ${fmt(avg(lossRows('modelFiltered'), s => s.modelFiltered.commissionUsd / s.modelFiltered.riskUsd))}R. Bu, maliyetin katkısını gösterir; fiyatın neden ters döndüğünü tek başına açıklamaz.`,
  ...gapLosses.map(s => `- ${s.time} Gold işlemi ${new Date(s.baseline.exitT).toISOString()} tarihinde ${fmt(s.baseline.netR)}R ile kapandı; stop $${fmt(s.baseline.stop)} iken çıkış $${fmt(s.baseline.exit)} idi. Sinyal ve çıkış arasında piyasa kapanışı varsa, hafta sonu açık pozisyon kısıtı gelecek veride test edilebilir; bu tek olay kuralın toplam faydasını kanıtlamaz.`),
  '- Modelin kaynak özellikleri `5dk` ve `15dk` metinlerini ayrı ayrı arıyor; `15dk`, `5dk` alt metnini de içerdiğinden 15dk sinyalleri iki özelliği birden etkinleştirir. Eğitim ve uygulama aynı tanımı kullandı, ancak ayrık zaman dilimi kovaları isteniyorsa sonraki modelde açıkça ayırıp yalnızca yeni bir eğitim/veri bölmesinde yeniden sınamak gerekir.',
  '- Stopun çok yakın olması, üst zaman dilimi bölgesi, haber, oynaklık ve fiyatın ters dönmesi gibi açıklamalar için işlem anına ait ayrı doğrulanmış özellikler gerekir. Bu rapor bunların her birini gözlenmiş neden olarak iddia etmez.',
  '- Lehine/aleyhine hareket aynı dakikanın tepe/dibinden hesaplanır; o dakikada girişten/çıkıştan önce veya sonra hangi seviyenin görüldüğü bilinmediği için üst sınırdır. Haber sütunu uygulamanın sınırlı yerel takvimidir; kapsamı tam değildir.',
  '- Bu dönem artık incelendi. Buradan seçilen herhangi bir değişiklik, henüz görülmemiş başka bir dönemde ve uygulamanın hesap/işlem motorunda tekrar denenmelidir.', '',
].join('\n');
fs.writeFileSync('analysis/diagnose-trained-1m.md', out);
console.log(`Rapor yazıldı: Gold ${lossRows('baseline').length} kayıp, model ${lossRows('modelFiltered').length} kayıp, filtrelenen ${rejected.length} Gold işlemi.`);

const appFiles = {
  Gold: 'analysis/account-trained-1m-ftm-plus-5000-gold-holdout-replay-gold.jsonl',
  'Eğitimli': 'analysis/account-trained-1m-ftm-plus-5000-trained-holdout-replay-trained.jsonl',
};
if (Object.values(appFiles).every(f => fs.existsSync(f) && fs.statSync(f).size)) {
  const accountSections = [];
  for (const [name, filename] of Object.entries(appFiles)) {
    const account = JSON.parse(fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/)[0]);
    const trades = account.trades ?? [], losses = trades.filter(t => t.pnl <= 0), wins = trades.filter(t => t.pnl > 0);
    const tstats = (arr) => arr.length ? `${arr.length} işlem, ortalama ${fmt(avg(arr, t => t.pnl))} $ net P/L, ${fmt(avg(arr, t => t.commission))} $ komisyon` : '0 işlem';
    accountSections.push(`## ${name}\n\n${trades.length} kapanmış işlem: ${tstats(wins)} kazanan; ${tstats(losses)} kaybeden. Durum: ${account.phase}/${account.status}; çekim $${fmt(account.payoutsTotal)}.\n`);
    accountSections.push('| Giriş → çıkış UTC | Yön / kaynak | Giriş / stop / hedef / çıkış | Net P/L | Komisyon | Neden | Önündeki kayıtlı seviye | Yerel takvim ±60dk |\n| --- | --- | --- | ---: | ---: | --- | --- | --- |');
    for (const t of losses) {
      const c = t.ctx ?? {}, t0 = c.signalT ?? t.openedAt;
      const news = calendar.eventsBetween(t0 - 60 * 60_000, t0 + 60 * 60_000).map(e => e.label).join(', ') || 'yok';
      const level = Number.isFinite(c.aheadR) && c.aheadR < 9 ? `${fmt(c.aheadR)}R / ${c.aheadKind ?? '?'}` : 'kayıtlı yakın seviye yok';
      accountSections.push(`| ${new Date(t.openedAt).toISOString()} → ${new Date(t.closedAt).toISOString()} | ${t.side} / ${c.source ?? '?'} | ${fmt(t.entry)} / ${fmt(t.sl)} / ${fmt(t.tp)} / ${fmt(t.exit)} | $${fmt(t.pnl)} | $${fmt(t.commission)} | ${t.reason} | ${level} | ${news} |`);
    }
    accountSections.push('');
  }
  fs.writeFileSync('analysis/diagnose-trained-1m-store.md', [
    '# S2C hesap motoru: işlem kaybı incelemesi', '',
    'Gold ve eğitimli sürüm aynı 2026-07-03 03:00 UTC başlangıcında, 39 günlük pencerede, ayrı temiz S2C profillerinde; $5.000 Infinity Plus ve işlem başına %0,5 riskle çalıştı. S2C emir, spread, komisyon ve zarar kuralları kullanıldı. Sonuçlar birer hesaptır; 39 gün sonunda açık kalan hesaplar sansürlüdür.', '',
    ...accountSections,
    '## Nasıl yorumlanır?', '',
    '- Çıkış nedeni işlemin nasıl kapandığını gösterir; fiyatın neden ters döndüğünü kanıtlamaz.',
    '- Önündeki seviye mevcut hesap simülatörünün önceki gün, seans ve 4 saatlik seviyelerinden türettiği yaklaşık bağlamdır. Bu alan, modelin kullandığı bir özellik değildir ve grafikteki son 48 mum seviyesiyle aynı değildir.',
    '- Haber bilgisi uygulamanın sınırlı yerel takviminden alınır; bu takvim eksik olabilir ve haberin kayba neden olduğunu göstermez.',
    '- İşlemden sonra bulunan örüntüyü kurala dönüştürmek önceki veriye uyarlama yaratır. Yeni bir kural, daha önce görülmemiş dönemlerde ve yeniden hesap replay ile doğrulanmalıdır.', '',
  ].join('\n'));
  console.log('S2C hesap işlemleri kayıp raporu yazıldı.');
}
