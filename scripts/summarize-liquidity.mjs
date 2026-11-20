import fs from 'node:fs';
const fmt=n=>Number(n).toFixed(2), time=t=>new Date(t).toISOString().replace('T',' ').slice(0,16)+' UTC';
let report='# Üç likidite stratejisi: FTM ilk aşama deneyi\n\n';
report+='Sanal FTM Infinity Plus, 5.000 $, 10 hesap/strateji; her hesap farklı başlangıçta 30 takvim günü. Aynı 10 başlangıç üç grupta kullanıldı. %0,5 risk, 0,20 $ spread, taraf başına %0,005 komisyon. Sinyal mumu kapanışında piyasa emri; kayma modellenmez. Tek pozisyon, aynı mum SL/TP temasında SL öncelikli. İlk aşama geçilince durur. Süresi dolanlar başarısızlık değil, henüz sonuçlanmamış hesaplar.\n\n';
report+='| Strateji | Hesap | Geçti | İhlal | Açık | İşlem | Kazanan | Net işlem P/L |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
for(let i=1;i<=3;i++){
 const path=`analysis/liquidity-ftm-plus-5000-${i}-three-test.jsonl`;
 const rows=fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse), trades=rows.flatMap(x=>x.trades);
 report+=`| ${i} | ${rows.length} | ${rows.filter(x=>x.phase==='funded').length} | ${rows.filter(x=>x.status!=='active').length} | ${rows.filter(x=>x.phase==='challenge'&&x.status==='active').length} | ${trades.length} | ${trades.filter(x=>x.pnl>0).length} | $${fmt(trades.reduce((n,t)=>n+t.pnl,0))} |\n`;
 let diary=`# Strateji ${i} işlem kayıt defteri\n\n${rows.length} sanal hesap, her biri 30 günlük gözlem. Tutarlar USD, zamanlar UTC. İşlem P/L komisyon dahil.\n\n`;
 for(const a of rows){
  diary+=`## Hesap ${a.index+1} — ${time(a.starts[0])}\n\nDurum: ${a.phase} / ${a.status}; bakiye $${fmt(a.balance)}; ${a.reason}; sinyal ${a.signals}, atlanan ${a.skipped}.\n\n`;
  if(!a.trades.length){diary+='Bu hesapta işlem açılmadı.\n\n';continue;}
  diary+='| Giriş UTC | Çıkış UTC | Yön | Lot | Giriş | Stop | Hedef | Çıkış | Komisyon | Net P/L | Neden |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|\n';
  for(const t of a.trades)diary+=`| ${time(t.openedAt)} | ${time(t.closedAt)} | ${t.side} | ${fmt(t.lots)} | ${fmt(t.entry)} | ${fmt(t.sl)} | ${fmt(t.tp)} | ${fmt(t.exit)} | ${fmt(t.commission)} | ${fmt(t.pnl)} | ${t.reason} |\n`;
  diary+='\n';
 }
 fs.writeFileSync(`analysis/likidite-${i}-islem-defteri.md`,diary);
}
report+='\nHer hesap ve işlem için ayrı kayıt defterlerine ve JSONL dosyalarına bakınız. Örneklem küçük; geçen hesap sayısı tek başına strateji üstünlüğünü kanıtlamaz. Bu deneyde kullanılan kurallar S2C uygulamasının 2026-11-13 tarihli FTM modeli; gerçek şirket kuralları güncel olmayabilir.\n';
fs.writeFileSync('analysis/likidite-ftm-karsilastirma.md',report);
