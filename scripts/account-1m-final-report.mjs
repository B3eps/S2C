import fs from 'node:fs';

const files = [
  ['A+', 'analysis/account-1m-ftm-plus-5000-aplus-aplus-10-fixed30d.jsonl'],
  ['Gold', 'analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.jsonl'],
  ['Classic', 'analysis/account-1m-ftm-plus-5000-classic-classic-10-fixed30d.jsonl'],
];
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const day = (t) => t ? new Date(t).toISOString().slice(0, 10) : '—';
const rows = (header, data) => `| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n${data.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
const groups = files.map(([preset, file]) => {
  if (!fs.existsSync(file)) throw new Error(`Eksik JSONL: ${file}`);
  return { preset, file, log: file.replace(/\.jsonl$/, '.log'), accounts: fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((x) => JSON.parse(x)) };
});
const all = groups.flatMap((g) => g.accounts);
const allTrades = all.flatMap((a) => a.trades ?? []);
const totalFees = all.reduce((s, a) => s + (a.fee ?? 39), 0);
let md = `# 1 dakikalık FTM Infinity Plus hesap simülasyonu\n\nRapor üretimi: ${new Date().toISOString()} UTC.\n\n`;
md += `## Sonuç\n\n`;
md += `S2C'nin gerçek store/backtest akışıyla A+, Gold ve Classic presetlerinde **10'ar hesap, toplam 30 ayrı hesap** çalıştırıldı. Her preset kendi temiz uygulama profili/store durumunu kullandı. Her grupta 10 hesabın 10'u farklı başlangıç tarihinden açıldı; fakat üç preset aynı 10 tarih kümesini kullandığından bunlar 30 bağımsız piyasa geçmişi değildir. Her hesap için 30 günlük tarihsel pencere işlendi.\n\n`;
md += `| Preset | Hesap | Benzersiz başlangıç | İşlem | Challenge geçti/funded | İhlal | Süre sonunda açık challenge (sansürlü) | Çekim sayısı | Brüt çekilen | Trader payı | Varsayımsal ücret | Çekim − ücret |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
for (const g of groups) {
  const A = g.accounts, trades = A.flatMap((a) => a.trades ?? []);
  const funded = A.filter((a) => a.phase === 'funded' || a.nPayouts > 0).length;
  const violated = A.filter((a) => a.status === 'violated').length;
  const censored = A.filter((a) => a.status === 'active' && a.phase === 'challenge').length;
  const gross = A.reduce((s, a) => s + (a.payoutsGross ?? 0), 0);
  const payout = A.reduce((s, a) => s + (a.payoutsTotal ?? 0), 0);
  const fees = A.reduce((s, a) => s + (a.fee ?? 39), 0);
  const uniq = new Set(A.map((a) => day(a.starts?.[0]))).size;
  md += `| ${g.preset} | ${A.length} | ${uniq} | ${trades.length} | ${funded} | ${violated} | ${censored} | ${A.reduce((s, a) => s + (a.nPayouts ?? 0), 0)} | ${money(gross)} | ${money(payout)} | ${money(fees)} | ${money(payout - fees)} |\n`;
}
md += `\n**Tüm gruplar:** ${all.length} hesap, ${allTrades.length} işlem, ${all.reduce((s, a) => s + (a.signals ?? 0), 0)} sinyal, ${all.reduce((s, a) => s + (a.skipped ?? 0), 0)} açık pozisyon/emir nedeniyle atlanan sinyal. Model komisyonu ${money(allTrades.reduce((s, t) => s + (t.commission ?? 0), 0))}; işlem P/L toplamı ${money(allTrades.reduce((s, t) => s + t.pnl, 0))}. Hiçbir hesap funded aşamasına geçmedi ve hiçbir çekim olmadı. Ücretler uygulama hesabındaki ${money(totalFees)} toplamı baz alan **varsayımsal hesap açma maliyetidir**; dışarıdan ücret tahsil edilmedi.\n\n`;
md += `## Hesaplar ve dosyalar\n\n`;
for (const g of groups) {
  const A = g.accounts, T = A.flatMap((a) => a.trades ?? []);
  const dates = [...new Set(A.map((a) => day(a.starts?.[0])))].sort();
  md += `### ${g.preset}\n\n`;
  md += `Hesap ${A.length}; farklı ilk başlangıç ${dates.length}; işlem ${T.length}; sinyal ${A.reduce((s, a) => s + (a.signals ?? 0), 0)}; kazanma oranı ${T.length ? (100 * T.filter((t) => t.pnl > 0).length / T.length).toFixed(1) : '0.0'}%; gerçekleşen işlem P/L ${money(T.reduce((s, t) => s + t.pnl, 0))}; komisyon ${money(T.reduce((s, t) => s + (t.commission ?? 0), 0))}.\n\n`;
  md += `Başlangıçlar UTC: ${dates.join(', ')}.\n\n`;
  md += `Hesap ve tüm insan tarafından okunabilir işlem alanları (UTC giriş/çıkış saati, 1m, yön, lot, giriş, stop, hedef, çıkış, komisyon, P/L ve TP/SL/ihlal nedeni) JSONL işlem günlüğünde: [${g.file}](${g.file}). Canlı ilerleme/hesap kapanış özeti: [${g.log}](${g.log}).\n\n`;
  md += rows(['Hesap', 'Başlangıç UTC', 'Seans', 'İşlem', 'Aşama/durum', 'Bakiye', 'İhlal/son neden', 'Brüt çekim', 'Trader payı', 'Pay − ücret'], A.map((a) => [
    `#${a.index}`, day(a.starts?.[0]), a.starts?.length ?? 0, a.trades?.length ?? 0, `${a.phase}/${a.status}`,
    money(a.balance), String(a.violation ?? a.reason ?? '').replaceAll('|', '/'), money(a.payoutsGross), money(a.payoutsTotal), money((a.payoutsTotal ?? 0) - (a.fee ?? 39)),
  ]));
  md += '\n';
}
md += `## Yöntem ve sınırlar\n\n`;
md += `- Başlangıç bakiye $5.000, trade başına risk %0,50. S2C'de kodlu FTM Infinity Plus şartları: hedef %10, günlük zarar %3, statik toplam zarar %5, ilk dört ödeme için trader split %80, hesap ücreti $39, komisyon taraf başına %0,005. Bunlar uygulamanın yerel kurallarıdır; resmi program şartları değişebilir. [FTM Perps resmi sitesi](https://www.ftmperps.com/).\n`;
md += `- Sinyaller Parça presetlerinin S2C setup motorundan çıkarıldı; işlemler gerçek S2C store üzerinden açıldı ve kapandı. Store fiyat akışı, pozisyon boyutu, SL/TP, komisyon, challenge geçiş/ihlal ve bakiye muhasebesi kullanıldı. Açık pozisyon/emir varsa yeni sinyal atlandı.\n`;
md += `- Geçmiş veri Dukascopy XAU/USD BID 1m mumlarıdır. Bu, FTM'nin canlı Hyperliquid XAU perpetual fiyatı değildir; sözleşme/lot, spread, slippage, funding, piyasa mikro yapısı ve veri sağlayıcı farkları sonuçları değiştirebilir. Uygulama varsayılan spread ve komisyon modelini kullandı; gerçek borsa yürütmesi veya ileriye dönük işlem değildir.\n`;
md += `- Her preset aynı 10 farklı başlangıç gününü kullandı: 2024-05-14–2026-02-17 arasındaki listelenen tarihler. Challenge 30 günlük örnek pencerede hedefe/ihlal durumuna ulaşmadıysa aktif olarak sona erdi; bunlar başarısız değil, sağdan sansürlüdür. Pencereler arası boş günler geriye sarılmadan geçilir ama piyasa o boşlukta replay edilmez. Aynı tarih farklı presetlerde aynı piyasa yolunu paylaşır.\n`;
md += `- Uygulamanın payout işlemi mevcut kullanılabilir bakiyenin tamamını çeker; tam $200 kısmi çekim desteklenmiyor. $200 kontrolü trader split sonrası ödenebilir paya uygulanır; $39 hesap maliyeti raporda ayrıca düşülür. Çekim için funded aşama, pozisyon/emir olmaması ve payout blocker koşullarının temiz olması gerekir. Bu 30 hesapta funded aşamaya geçen olmadığından payout API çağrılmadı, payout sürüm farkı sonuçlara etki etmedi. Bu üç Node süreci daha sık (her dakika/yeni emir öncesi) kontrolü ekleyen düzeltmeden önce başlamıştı; eski periyodik ön kontrol kullandılar. Çekim olsaydı yeni düzeltilmiş sürümle tekrar koşmak gerekirdi.\n`;
md += `- Bu ana uygulama hesabı testi Mass Index + EMA9/21 + 4h araştırma adayını içermiyor. Araştırma raporundaki 1.212 sinyal/parametre denemesi bağımsız sinyal araştırmasıdır, S2C account/store sonucu değildir. Dört günlük A+ kısa taramasındaki 47 kısmi hesap da ana 30g gruplarına katılmadı.\n`;
md += `\n## Doğrulama\n\n`;
md += `- A+ kısa S2C smoke: 2 precomputed sinyal / 2 canlı motor sinyali, 0 fark; Gold kısa smoke: 1 / 1, 0 fark.\n`;
md += `- Classic 30 günlük S2C eşitlik kontrolü: 92 karşılaştırılan sinyal, 0 fark, 52 store işlemi; 607 sn. Doğrulama kaydı: [analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.jsonl](analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.jsonl), [log](analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.log).\n`;
md += `- Feed cache denetiminde 1m/5m/15m/1h/4h bar dizileri ve nesne referansları günlük karşılaştırmada eşleşti; tüm ana run loglarında “feed cache OK”.\n`;
md += `- Ayrı araştırma çıktısı: [analysis/research-1m-expanded-report.md](analysis/research-1m-expanded-report.md). Araştırma denemeleri bu hesap sonuçlarına eklenmedi.\n`;

fs.writeFileSync('analysis/account-1m-rapor.md', md);
console.log('analysis/account-1m-rapor.md');
