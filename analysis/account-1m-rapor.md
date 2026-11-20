# 1 dakikalık FTM Infinity Plus hesap simülasyonu

Rapor üretimi: 2026-11-13T11:36:39.663Z UTC.

## Sonuç

S2C'nin gerçek store/backtest akışıyla A+, Gold ve Classic presetlerinde **10'ar hesap, toplam 30 ayrı hesap** çalıştırıldı. Her preset kendi temiz uygulama profili/store durumunu kullandı. Her grupta 10 hesabın 10'u farklı başlangıç tarihinden açıldı; fakat üç preset aynı 10 tarih kümesini kullandığından bunlar 30 bağımsız piyasa geçmişi değildir. Her hesap için 30 günlük tarihsel pencere işlendi.

| Preset | Hesap | Benzersiz başlangıç | İşlem | Challenge geçti/funded | İhlal | Süre sonunda açık challenge (sansürlü) | Çekim sayısı | Brüt çekilen | Trader payı | Varsayımsal ücret | Çekim − ücret |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A+ | 10 | 10 | 86 | 0 | 0 | 10 | 0 | $0.00 | $0.00 | $390.00 | $-390.00 |
| Gold | 10 | 10 | 158 | 0 | 0 | 10 | 0 | $0.00 | $0.00 | $390.00 | $-390.00 |
| Classic | 10 | 10 | 464 | 0 | 7 | 3 | 0 | $0.00 | $0.00 | $390.00 | $-390.00 |

**Tüm gruplar:** 30 hesap, 708 işlem, 1159 sinyal, 451 açık pozisyon/emir nedeniyle atlanan sinyal. Model komisyonu $1484.55; işlem P/L toplamı $-3160.37. Hiçbir hesap funded aşamasına geçmedi ve hiçbir çekim olmadı. Ücretler uygulama hesabındaki $1170.00 toplamı baz alan **varsayımsal hesap açma maliyetidir**; dışarıdan ücret tahsil edilmedi.

## Hesaplar ve dosyalar

### A+

Hesap 10; farklı ilk başlangıç 10; işlem 86; sinyal 103; kazanma oranı 44.2%; gerçekleşen işlem P/L $-389.39; komisyon $109.41.

Başlangıçlar UTC: 2024-05-14, 2024-07-02, 2024-09-17, 2024-11-05, 2025-01-02, 2025-03-04, 2025-04-08, 2025-08-05, 2025-11-18, 2026-02-17.

Hesap ve tüm insan tarafından okunabilir işlem alanları (UTC giriş/çıkış saati, 1m, yön, lot, giriş, stop, hedef, çıkış, komisyon, P/L ve TP/SL/ihlal nedeni) JSONL işlem günlüğünde: [analysis/account-1m-ftm-plus-5000-aplus-aplus-10-fixed30d.jsonl](analysis/account-1m-ftm-plus-5000-aplus-aplus-10-fixed30d.jsonl). Canlı ilerleme/hesap kapanış özeti: [analysis/account-1m-ftm-plus-5000-aplus-aplus-10-fixed30d.log](analysis/account-1m-ftm-plus-5000-aplus-aplus-10-fixed30d.log).

| Hesap | Başlangıç UTC | Seans | İşlem | Aşama/durum | Bakiye | İhlal/son neden | Brüt çekim | Trader payı | Pay − ücret |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #0 | 2024-05-14 | 1 | 8 | challenge/active | $4986.74 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #1 | 2024-07-02 | 1 | 10 | challenge/active | $4898.91 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #2 | 2024-09-17 | 1 | 8 | challenge/active | $4975.50 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #3 | 2024-11-05 | 1 | 13 | challenge/active | $5001.89 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #4 | 2025-01-02 | 1 | 7 | challenge/active | $4951.35 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #5 | 2025-03-04 | 1 | 3 | challenge/active | $4970.22 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #6 | 2025-04-08 | 1 | 10 | challenge/active | $4945.53 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #7 | 2025-08-05 | 1 | 8 | challenge/active | $4931.43 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #8 | 2025-11-18 | 1 | 10 | challenge/active | $4978.68 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #9 | 2026-02-17 | 1 | 9 | challenge/active | $4970.36 | süre doldu | $0.00 | $0.00 | $-39.00 |

### Gold

Hesap 10; farklı ilk başlangıç 10; işlem 158; sinyal 196; kazanma oranı 43.0%; gerçekleşen işlem P/L $-907.83; komisyon $253.23.

Başlangıçlar UTC: 2024-05-14, 2024-07-02, 2024-09-17, 2024-11-05, 2025-01-02, 2025-03-04, 2025-04-08, 2025-08-05, 2025-11-18, 2026-02-17.

Hesap ve tüm insan tarafından okunabilir işlem alanları (UTC giriş/çıkış saati, 1m, yön, lot, giriş, stop, hedef, çıkış, komisyon, P/L ve TP/SL/ihlal nedeni) JSONL işlem günlüğünde: [analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.jsonl](analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.jsonl). Canlı ilerleme/hesap kapanış özeti: [analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.log](analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.log).

| Hesap | Başlangıç UTC | Seans | İşlem | Aşama/durum | Bakiye | İhlal/son neden | Brüt çekim | Trader payı | Pay − ücret |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #0 | 2024-05-14 | 1 | 18 | challenge/active | $4841.57 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #1 | 2024-07-02 | 1 | 20 | challenge/active | $4875.97 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #2 | 2024-09-17 | 1 | 14 | challenge/active | $5009.99 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #3 | 2024-11-05 | 1 | 21 | challenge/active | $4928.91 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #4 | 2025-01-02 | 1 | 11 | challenge/active | $4856.15 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #5 | 2025-03-04 | 1 | 13 | challenge/active | $4885.17 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #6 | 2025-04-08 | 1 | 19 | challenge/active | $4977.43 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #7 | 2025-08-05 | 1 | 15 | challenge/active | $4923.78 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #8 | 2025-11-18 | 1 | 15 | challenge/active | $4897.45 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #9 | 2026-02-17 | 1 | 12 | challenge/active | $4895.73 | süre doldu | $0.00 | $0.00 | $-39.00 |

### Classic

Hesap 10; farklı ilk başlangıç 10; işlem 464; sinyal 860; kazanma oranı 48.5%; gerçekleşen işlem P/L $-1863.15; komisyon $1121.91.

Başlangıçlar UTC: 2024-05-14, 2024-07-02, 2024-09-17, 2024-11-05, 2025-01-02, 2025-03-04, 2025-04-08, 2025-08-05, 2025-11-18, 2026-02-17.

Hesap ve tüm insan tarafından okunabilir işlem alanları (UTC giriş/çıkış saati, 1m, yön, lot, giriş, stop, hedef, çıkış, komisyon, P/L ve TP/SL/ihlal nedeni) JSONL işlem günlüğünde: [analysis/account-1m-ftm-plus-5000-classic-classic-10-fixed30d.jsonl](analysis/account-1m-ftm-plus-5000-classic-classic-10-fixed30d.jsonl). Canlı ilerleme/hesap kapanış özeti: [analysis/account-1m-ftm-plus-5000-classic-classic-10-fixed30d.log](analysis/account-1m-ftm-plus-5000-classic-classic-10-fixed30d.log).

| Hesap | Başlangıç UTC | Seans | İşlem | Aşama/durum | Bakiye | İhlal/son neden | Brüt çekim | Trader payı | Pay − ücret |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #0 | 2024-05-14 | 1 | 52 | challenge/active | $5114.81 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #1 | 2024-07-02 | 1 | 51 | challenge/violated | $4737.63 | Toplam zarar limiti $12 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #2 | 2024-09-17 | 1 | 56 | challenge/violated | $4740.40 | Toplam zarar limiti $9 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #3 | 2024-11-05 | 1 | 63 | challenge/active | $4902.12 | süre doldu | $0.00 | $0.00 | $-39.00 |
| #4 | 2025-01-02 | 1 | 29 | challenge/violated | $4741.64 | Toplam zarar limiti $11 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #5 | 2025-03-04 | 1 | 56 | challenge/violated | $4740.38 | Toplam zarar limiti $10 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #6 | 2025-04-08 | 1 | 42 | challenge/violated | $4749.92 | Toplam zarar limiti $1 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #7 | 2025-08-05 | 1 | 35 | challenge/violated | $4742.72 | Toplam zarar limiti $8 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #8 | 2025-11-18 | 1 | 16 | challenge/violated | $4740.18 | Toplam zarar limiti $10 aşıldı (%5). | $0.00 | $0.00 | $-39.00 |
| #9 | 2026-02-17 | 1 | 64 | challenge/active | $4927.03 | süre doldu | $0.00 | $0.00 | $-39.00 |

## Yöntem ve sınırlar

- Başlangıç bakiye $5.000, trade başına risk %0,50. S2C'de kodlu FTM Infinity Plus şartları: hedef %10, günlük zarar %3, statik toplam zarar %5, ilk dört ödeme için trader split %80, hesap ücreti $39, komisyon taraf başına %0,005. Bunlar uygulamanın yerel kurallarıdır; resmi program şartları değişebilir. [FTM Perps resmi sitesi](https://www.ftmperps.com/).
- Sinyaller Parça presetlerinin S2C setup motorundan çıkarıldı; işlemler gerçek S2C store üzerinden açıldı ve kapandı. Store fiyat akışı, pozisyon boyutu, SL/TP, komisyon, challenge geçiş/ihlal ve bakiye muhasebesi kullanıldı. Açık pozisyon/emir varsa yeni sinyal atlandı.
- Geçmiş veri Dukascopy XAU/USD BID 1m mumlarıdır. Bu, FTM'nin canlı Hyperliquid XAU perpetual fiyatı değildir; sözleşme/lot, spread, slippage, funding, piyasa mikro yapısı ve veri sağlayıcı farkları sonuçları değiştirebilir. Uygulama varsayılan spread ve komisyon modelini kullandı; gerçek borsa yürütmesi veya ileriye dönük işlem değildir.
- Her preset aynı 10 farklı başlangıç gününü kullandı: 2024-05-14–2026-02-17 arasındaki listelenen tarihler. Challenge 30 günlük örnek pencerede hedefe/ihlal durumuna ulaşmadıysa aktif olarak sona erdi; bunlar başarısız değil, sağdan sansürlüdür. Pencereler arası boş günler geriye sarılmadan geçilir ama piyasa o boşlukta replay edilmez. Aynı tarih farklı presetlerde aynı piyasa yolunu paylaşır.
- Uygulamanın payout işlemi mevcut kullanılabilir bakiyenin tamamını çeker; tam $200 kısmi çekim desteklenmiyor. $200 kontrolü trader split sonrası ödenebilir paya uygulanır; $39 hesap maliyeti raporda ayrıca düşülür. Çekim için funded aşama, pozisyon/emir olmaması ve payout blocker koşullarının temiz olması gerekir. Bu 30 hesapta funded aşamaya geçen olmadığından payout API çağrılmadı, payout sürüm farkı sonuçlara etki etmedi. Bu üç Node süreci daha sık (her dakika/yeni emir öncesi) kontrolü ekleyen düzeltmeden önce başlamıştı; eski periyodik ön kontrol kullandılar. Çekim olsaydı yeni düzeltilmiş sürümle tekrar koşmak gerekirdi.
- Bu ana uygulama hesabı testi Mass Index + EMA9/21 + 4h araştırma adayını içermiyor. Araştırma raporundaki 1.212 sinyal/parametre denemesi bağımsız sinyal araştırmasıdır, S2C account/store sonucu değildir. Dört günlük A+ kısa taramasındaki 47 kısmi hesap da ana 30g gruplarına katılmadı.

## Doğrulama

- A+ kısa S2C smoke: 2 precomputed sinyal / 2 canlı motor sinyali, 0 fark; Gold kısa smoke: 1 / 1, 0 fark.
- Classic 30 günlük S2C eşitlik kontrolü: 92 karşılaştırılan sinyal, 0 fark, 52 store işlemi; 607 sn. Doğrulama kaydı: [analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.jsonl](analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.jsonl), [log](analysis/account-1m-ftm-plus-5000-classic-classic-verify-20240514.log).
- Feed cache denetiminde 1m/5m/15m/1h/4h bar dizileri ve nesne referansları günlük karşılaştırmada eşleşti; tüm ana run loglarında “feed cache OK”.
- Ayrı araştırma çıktısı: [analysis/research-1m-expanded-report.md](analysis/research-1m-expanded-report.md). Araştırma denemeleri bu hesap sonuçlarına eklenmedi.
