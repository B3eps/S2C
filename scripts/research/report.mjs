import { readFileSync } from 'node:fs';

const [strategy] = process.argv.slice(2);
const parts = ['development', 'validation', 'test'];
const names = { development: 'Geliştirme', validation: 'Doğrulama', test: 'Ayrılmış test' };
const file = part => `analysis/research-${strategy}-${part}.json`;
const stages = Object.fromEntries(parts.map(p => [p, JSON.parse(readFileSync(file(p), 'utf8'))]));
const money = n => n == null ? '—' : n.toFixed(2);
const rate = n => n == null ? '—' : `%${(100 * n).toFixed(1)}`;
const interval = (ci, format) => ci ? ci.map(format).join(' … ') : '—';
const statuses = w => ['passed', 'violated', 'active'].map(s => w.accounts.filter(a => a.status === s).length).join('/');
const dateTime = t => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
const test = stages.test;
const primary = Object.keys(test.results)[0];
const summary = test.results[primary].conservative.summary;
const rows = [];

rows.push('## Veri', '', '| Dönem | UTC, bitiş hariç | Uygun / aday gün | Kapsam dışı | Kabul edilen günlerde eksik M1 |', '|---|---|---:|---|---:|');
for (const p of parts) {
  const { source, coverage } = stages[p];
  const eligible = coverage.filter(d => d.eligible);
  const excluded = [...source.excluded, ...coverage.filter(d => !d.eligible).map(d => `${d.date} (${d.missing} eksik)`)];
  rows.push(`| ${names[p]} | ${source.start} – ${source.end} | ${eligible.length}/${coverage.length} | ${excluded.join(', ') || '—'} | ${eligible.reduce((s,d) => s + d.missing, 0)} |`);
}
rows.push('', 'Dukascopy XAU/USD bid M1. Sıfır hacimli dolgu için kullanılan düz mumlar alınmadı. Bütün işlemler M1; kapanış sinyali bir sonraki bitişik M1 açılışında uygulanır. Kaynak önbellek SHA-256 değeri ve tarih kapsamı her JSON dosyasında bulunur. [Dukascopy veri kaynağı](https://www.dukascopy.com/api/data/get/historical-data-export)', '',
  '## Net işlem istatistikleri', '',
  'Tablo bar başına ihtiyatlı yolu kullanır. Tüm tutarlar USD. Net istatistiklerin hesabı, FTM’de ilk ihlalde kapanan hesap pencerelerinden ayrı yürütülür. Wilson aralığı işlem bağımsızlığı varsayan betimsel bir aralıktır. Beklenti aralığı 2.000 gün-kümeli bootstrap tekrarına dayanır ve günler arasındaki seri bağımlılığı kapsamaz.', '',
  '| Dönem | Varyant | n | Kazanma [Wilson %95] | Ort. kazanç / kayıp | Net | Beklenti [%95] | Düşüş, kapanmış / özkaynak | Ort. gün |',
  '|---|---|---:|---|---:|---:|---|---:|---:|');
for (const p of parts) {
  for (const [id, r] of Object.entries(stages[p].results)) {
    const s = r.conservative.summary;
    rows.push(`| ${names[p]} | ${id} | ${s.n} | ${rate(s.winRate)} [${interval(s.winCI, rate)}] | ${money(s.averageWin)} / ${money(s.averageLoss)} | ${money(s.net)} | ${money(s.expectancy)} [${interval(s.expectationCI, money)}] | ${money(s.closedDD)} / ${money(s.worstBelowPeak)} | ${money(s.avgDay)} |`);
  }
}
rows.push('', 'Özkaynak düşüşü, daha önce gözlenen kapanış özkaynağı tepesinden modelin mum içi diplerine ölçülür. Gerçek tik bazlı düşüş farklı olabilir.', '',
  '## Ayrılmış testte günlük performans ve yol duyarlılığı', '',
  '| Varyant | Pozitif / negatif / sıfır gün | Alt medyan | En kötü / en iyi gün | En az 100 $ gün | Açık pozisyonda veri boşluğu | Net: yüksek önce / düşük önce / ihtiyatlı |',
  '|---|---:|---:|---:|---:|---:|---:|');
for (const [id, paths] of Object.entries(test.results)) {
  const s = paths.conservative.summary;
  rows.push(`| ${id} | ${s.upDays} / ${s.downDays} / ${s.flatDays} | ${money(s.medianDay)} | ${money(s.worstDay)} / ${money(s.bestDay)} | ${s.hundredDays} | ${s.gapsExposed} | ${money(paths['high-first'].summary.net)} / ${money(paths['low-first'].summary.net)} / ${money(s.net)} |`);
}
rows.push('', '## FTM Infinity Plus, 5.000 $', '',
  'Aynı dönemdeki tam ve çakışmayan 5 ve 20 uygun gün pencereleri. Hücre sırası geçti / ihlal / açık kaldı. Pencere sonunda açık kalan hesap sağdan sansürlüdür. Bir strateji için 5 ve 20 günlük gruplar aynı tarihlere dayanabilir. Hesap durumu ilk hedefte veya ihlalde kesilir. Son bakiye, tarih ve ihlal türü JSON işlem dosyasındadır.', '',
  '| Dönem | Varyant | İhtiyatlı 5 gün | İhtiyatlı 20 gün | Yüksek önce 5 / 20 gün | Düşük önce 5 / 20 gün |',
  '|---|---|---:|---:|---|---|');
for (const p of parts) {
  for (const [id, paths] of Object.entries(stages[p].results)) {
    const [five, twenty] = paths.conservative.windows;
    const [h5, h20] = paths['high-first'].windows;
    const [l5, l20] = paths['low-first'].windows;
    rows.push(`| ${names[p]} | ${id} | ${statuses(five)} | ${statuses(twenty)} | ${statuses(h5)} · ${statuses(h20)} | ${statuses(l5)} · ${statuses(l20)} |`);
  }
}
rows.push('', '## İşlem denetimi', '',
  `Birincil varyantta ${summary.wins} kazanç, ${summary.losses} kayıp ve ${summary.flat} başa baş işlem. Aşağıdaki örnekler kronolojik ilk kâr ve ilk zarardır. Giriş kararında kullanılan bağlam ve sinyal zamanı JSON işlem kaydındadır.`, '',
  '| Açılış UTC | Yön ve lot | Giriş / SL / TP | Çıkış, neden | Net |', '|---|---|---:|---|---:|');
const trades = test.results[primary].conservative.trades;
for (const t of [trades.find(t => t.pnl > 0), trades.find(t => t.pnl < 0)].filter(Boolean).sort((a, b) => a.openedAt - b.openedAt)) {
  rows.push(`| ${dateTime(t.openedAt)} | ${t.side} · ${money(t.lots)} | ${money(t.entry)} / ${money(t.sl)} / ${money(t.tp)} | ${money(t.exit)} · ${t.reason} | ${money(t.pnl)} |`);
}
rows.push('', 'Pozisyon defteri günlük net sonucu, kaldıraç altında atlanan girişleri, açılış ve çıkış fiyatlarını içerir. Grafikte sonradan görülen fiyat yolu girişte bilinen bir koşul veya nedensellik kanıtı sayılmaz.', '',
  '## Tekrar üretim', '', 'Proje kökünde, önbellek hazırken', '', '```powershell',
  `node scripts/research/run.mjs ${strategy} development`, `node scripts/research/run.mjs ${strategy} validation`,
  `node scripts/research/run.mjs ${strategy} test`, '```', '');
for (const p of parts) rows.push(`- [${names[p]} işlem ve hesap defteri](../../${file(p)})`);
console.log(rows.join('\n'));
