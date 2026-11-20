---
tags: [xauusd, piyasa-mekanigi]
---

# XAU/USD piyasa mekaniği

Kaynak ve S2C kodu kontrolü **19 Kasım 2026**. Bu not, şu anki fiyat veya yön tahmini içermez. M1 grafik okuması [[bilgi/m1-grafik-okuma]] içinde.

## Fiyat nereden geliyor?

**XAU/USD, altının troy ons başına dolar fiyatıdır.** Londra'nın toptan spot piyasasında işlemler taraflar arasında OTC yapılır. Loco London, altının teslim ve takas yerini tarif eder. Standart spot valör genellikle iki iş günü sonradır. Tek bir merkezi spot emir defteri bulunmadığından, broker ve veri sağlayıcılarının kotasyonları farklı olabilir. S2C fiyatları Dukascopy'nin XAU/USD akışından gelir. Buradaki likidite etiketi önce fiyat seviyesini tarif eder. O seviyedeki küresel emir miktarı bu veriyle gözlenemez. [LBMA OTC rehberi](https://www.lbma.org.uk/publications/the-otc-guide/introduction) · [LBMA spot fiyat ve valör](https://www.lbma.org.uk/publications/the-otc-guide/the-price)

| Kaynak | Gördüğümüz şey | Araştırmadaki rolü |
|---|---|---|
| **Dukascopy XAU/USD** | Sağlayıcıya ait bid ve ask kotasyonları, M1 mum ve tik geçmişi | Ana simülasyon fiyatı. Ölçülen spread ve işlem sırası bu akışa ait. |
| **COMEX GC / MGC** | Belirli vadeye sahip, borsada işlem gören altın kontratı. GC 100, MGC 10 troy ons | Eşzamanlı fiyat, işlem hacmi veya hareket hızı için aday bağlam. Vade ve rollover kaydedilir. GC ile spot fiyat arasında baz olabilir. |
| **LBMA Gold Price** | Londra teslimli altının 10:30 ve 15:00 Londra saati açık artırma referansı | Belli dakikalarda araştırılabilir olay etiketi. Sürekli spot işlemler kendi kotasyonlarıyla akar. |

[Dukascopy tarihsel tikler](https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/history-ticks/) · [CME altın kontratları](https://www.cmegroup.com/markets/metals/precious/gold-futures.contractSpecs.html) · [LBMA açık artırma fiyatları](https://www.lbma.org.uk/prices-and-data/about-lbma-daily-auction-prices)

Spot ile vadeli piyasalar aynı altın riskini fiyatladığı için hareketleri bağlantılı olabilir. Fiyat farkında vade, finansman, taşıma ve teslim koşulları rol oynayabilir. M1 araştırmasında eşzamanlılık UTC ile doğrulanır. Vadeli fiyat kullanılıyorsa vade değişimi veya sürekli kontratın oluşturduğu fiyat atlaması gerçek spot hareketi gibi etiketlenmez. [CME spot–COMEX bağlantısı ve EFP](https://www.cmegroup.com/education/articles-and-reports/trading-comex-gold-and-silver)

## M1’de para nasıl kazanılır veya kaybedilir?

**Long** ask’tan alır, bid’den satar. **Short** bid’den satar, ask’tan geri alır. S2C grafik mumları bid. Short stopu ve hedefi alış kotasyonundan çalışır. Spread açılırsa bid grafiği az hareket etse bile short kapatma kotasyonu stopa ulaşabilir. Stop tetiklendikten sonra fiyat atlarsa çıkış daha kötü olabilir. Kotasyon geçmişi, broker kuyruğu veya emrin garanti edilen gerçekleşmesi hakkında sınırlı bilgi verir. [[deneyler/00-simulasyon-denetimi|Replay denetimi]] · [Dukascopy bid/ask tik verisi](https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/history-ticks/)

- `Ons = lot × kontrat büyüklüğü`. S2C varsayımı 100 ons/lot ve 0,01 lot adımı. Bu projede 0,10 lot 10 ons, ons başına 1 $ hareket maliyet öncesi 10 $. Marj aynı lotun fiyat hareketinden gelen dolar sonucunu değiştirmez. Açılabilecek pozisyon büyüklüğünü sınırlar.
- `Net PnL = yönlü gerçekleşen giriş–çıkış farkı × ons − komisyon`. Giriş ve çıkışta doğru bid/ask kullanıldıysa spread fiyat farkının içindedir. Bid-bid karşılaştırmada spread ayrıca ayrıştırılabilir.
- S2C FTM Infinity Plus modelinde 0,20 $/ons sabit spread ve taraf başı %0,005 komisyon vardır. Sadece büyüklüğü göstermek için ons fiyatı 4.000 $ varsayılırsa, iki taraf komisyonu yaklaşık 0,40 $/ons, modelde başa baş bid hareketi yaklaşık 0,60 $/ons. Bu hesap kaymayı içermez. S2C varsayımı ile broker kontrat şartları ayrı kaydedilir.
- Altı önceden seçilmiş işlemde giriş spread’i 0,497–0,647 $/ons görüldü. Aynı altı işlemde gerçek bid/ask ile toplam sonuç −59,07 $, sabit modelde −53,43 $. Öğrendiğimiz şey, bu küçük örnekte model maliyetinin iyimser olduğu. Tüm seansların spread dağılımı için daha geniş tik örneği gerekir. [[deneyler/11-parca-kontrol-sonuc|Altı tik karşılaştırması]]

**Hacim ayrımı.** Dukascopy, mum hacmini dönem boyunca en iyi alış veya satış kotasyon hacimlerinin toplamı olarak açıklar. CME hacmi kendi borsasında işlem gören kontrat adedidir. Bir VWAP araştırmasında hacmin hangi veriye ait olduğu açıkça yazılır. [Dukascopy hacim açıklaması](https://www.dukascopy.ch/swiss/english/about/faq/) · [[deneyler/05-vwap-duyarlilik|S2C VWAP çalışması]]

## Neler hareketi değiştirebilir?

| Kanal | M1 araştırmasında bakılacak gözlem |
|---|---|
| **Dolar ve reel faiz** | Altın dolar cinsinden fiyatlanır ve faiz ödemeyen bir varlıktır. Dolar ve reel faiz değişiklikleri fırsat maliyetiyle ilgilidir. Senkron veri varsa yön, büyüklük ve gecikmeyi ölç. Gün sonu serisini gün içi kararın önüne koyma. |
| **ABD verileri ve Fed** | CPI, istihdam ve FOMC çevresinde açıklama saati, ilk kotasyon sıçraması, spread ve sonraki 5–30 dakikanın hareketi ayrı kaydedilir. Haberle alım/satım hipotezi farklı bir deneydir. |
| **Londra, ABD saati ve geçişler** | Açılış ve çakışma burada olay etiketi. Karşılaştırılabilir zamanlarda spread, fiyat aralığı, kotasyon sayısı ve devam/geri dönüş ölçülür. Londra ve ABD yaz saatleri farklı tarihlerde değişir. |
| **Risk ve büyük akışlar** | Piyasa stresi, fiziki talep, ETF akışı, rezerv alımları ve pozisyonlanma bağlam verebilir. Yayın zamanı ve verinin doğal frekansı saklanır. Haftalık veya aylık gözlem bir M1 tetiği olarak değerlendirilmeden önce katkısı ayrı ölçülür. |

World Gold Council'in modeli faiz, döviz, risk, ekonomik gelişme ve momentumun altınla ilişkisinin dönemler arasında değişebileceğini inceliyor. Model haftalık/aylık hareketleri açıklamaya yardımcı olur. M1’de aynı ilişkinin aynı yönde çalışması bir hipotezdir. [World Gold Council GRAM](https://www.gold.org/goldhub/tools/gold-return-attribution-model) · [BLS resmi duyuru saatleri](https://www.bls.gov/about-bls/dissemination.htm) · [Fed FOMC takvimi](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)

**Üç ayrı saat.** S2C fiyat gününü 17:00 New York kesimiyle gruplar, mevcut prop hesabı günü 22:00 UTC'de değişir, deney seansı ise önceden seçilmiş çalışma penceresidir. New York borsa açılışı bir XAU/USD araştırma işareti olabilir. Gold spot piyasasının açılış saati olarak yorumlanmaz. Fiyat zamanı UTC, seans etiketleri `Europe/London` veya `America/New_York`, kullanıcı sunumu `Europe/Istanbul` olarak tutulur. [[guvenilirlik|Veri ve simülasyon]]

## M1’de önce neyi ayırıyoruz?

1. **Konum.** Fiyat günlük/seans aralığının neresinde? Bir sonraki önceden bilinen seviyeye, maliyetle karşılaştırılabilir ne kadar mesafe var?
2. **Geliş şekli.** Fiyat oraya sıkışarak mı, tek hamlede mi, art arda geri test ederek mi geldi? Bu özellikler giriş öncesinde etiketlenir.
3. **Gerçekleşebilir yol.** Beklenen tarafa önce mi gitti, önce hangi ölçüde aleyhe açıldı? M1'dan sınırları, tikten kotasyon sırasını ölç. Stop sonrası görülen hedefi ayrı gözlem olarak sakla.
4. **Kıyas.** Aynı saat ve oynaklıktaki sıradan M1 anlarından daha iyi hareket oluşuyor mu? Yanıt veriyle verilmeden çizgiye sebep atfetme. [[arastirma-isleyisi|Araştırma akışı]]
