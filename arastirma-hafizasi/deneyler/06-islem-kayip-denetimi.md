# 06 · İşlem işlem kayıp denetimi

VWAP bazında 202 kaybın tamamı stopla kapandı. 125 stop ilk üç mumda oluştu. 96 stopun ardından fiyat, çıkış mumundan sonraki 30 dakika içinde eski hedefe ulaştı. Stopu iki kat uzağa taşıyıp lotu düşürmek 53 eski kaybı kazanca çevirdi. Buna rağmen 328 karşılaştırılabilir işlemde sonuç −1.058,49 $. Bir ve üç dakika giriş gecikmesi, kendi karşılaştırılabilir işlem kümelerinde sonucu daha da düşürdü.

## Kapsam ve kayıtlar

- Dört orijinal stratejinin tüm varyant ve dönemleri 3.010 işlem kaydı ve 1.877 kayıp.
- VWAP ek döneminin ayrı bakiyeyle yürütülen baz koşusu 63 kayıt ve 35 kayıp.
- VWAP bazının tek bakiyeyle birleşik koşusu 330 kayıt ve 202 kayıp. Önceki gruplardaki bazı sinyaller burada farklı lotlarla tekrar yer alır.
- Takip çalışmasındaki 20 alternatif VWAP ayarının dönem ve birleşik koşuları 14.178 kayıt ve 8.604 kayıp.

Toplam **17.581 işlem kaydı ve 10.718 zarar kaydı**. Aynı sinyal farklı açık ayarlarda ve dönemlerin birleşik koşusunda tekrar edebilir. Analiz arşivli işlem defterlerini kapsar. FTM hesap pencereleri ayrı olarak, ilk geçiş veya ihlal anında duran simülasyonlardır.

[İşlem işlem CSV](../../analysis/research-loss-audit.csv) · [Özet ve dağılımlar](../../analysis/research-loss-audit-summary.json)

CSV'de `strategy`, `variant`, `split` ve `pnlUsd` ile filtrelenebilir. Tarihler UTC. `diagnosis` gözlenen çıkış biçimini gösterir. `highFirstExit` ve `lowFirstExit` iki mum yolunu, `priceMoveUsd`, `spreadUsd` ve `commissionUsd` net sonucun kalemlerini gösterir. `beforeTargetProgress` çıkış mumunun açılışına kadar görülen en iyi kotasyonun hedef mesafesine oranıdır. `targetAfterMinutes` çıkış mumundan sonraki tam dakikalarda eski hedefe ilk teması gösterir. `context` sinyalde bilinen fiyat seviyelerini içerir. `widenedStop` ve `delayedEntry` birleşik VWAP bazında aynı işleme uygulanan senaryoları taşır.

## Dört stratejide ayrılmış testin kayıp biçimi

Birincil varyantlar. İlk üç mum ve sonraki hedef sütunları stopla kapanan kayıpları sayar. Bid hareketi ve işlem maliyeti kazanan ve kaybeden tüm gerçekleşmiş işlemler için hesaplanır. Bid-bid sütunu mevcut açılış ve kapanış anlarının, lotların ve tetiklerin korunduğu maliyet ayrıştırmasıdır.

| Strateji | İşlem | Stop kaybı | İlk 3 mumda | Stop sonrası 30 dk’da hedef | Bid-bid sonuç | Spread + komisyon | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fibonacci %60–70 | 37 | 29 | 10 | 5 | −287,55 $ | 158,14 $ | −445,69 $ |
| Açılış aralığı | 11 | 7 | 1 | 3 | −37,00 $ | 36,79 $ | −73,79 $ |
| Başarısız kırılım | 29 | 16 | 10 | 8 | +126,08 $ | 155,26 $ | −29,18 $ |
| VWAP, eski test | 10 | 4 | 3 | 4 | +84,29 $ | 54,11 $ | +30,18 $ |

Fibonacci ve açılış aralığında işlem defterinin kendi fiyat hareketi de eksiydi. Başarısız kırılımda bid-bid toplamı pozitifti ve spread ile komisyon bu toplamı aştı. Başarısız kırılımın 16 zararlı işleminin her birinde bid hareketi işlem aleyhineydi.

Orijinal dört stratejinin tüm varyant defterlerindeki 1.877 kaybın 1.869'u stop, 8'i süre çıkışıydı. 833 stop ilk üç mumda gerçekleşti. 11 stop açılış fiyatı stopun ötesinde olduğu için daha kötü doldu. Toplam fark 13,71 $. İki OHLC yolu 3 kayıpta çıkışı değiştirdi. 689 stopun ardından eski hedef 30 dakika içinde görüldü, 1.179'unda görülmedi, birinde pencerenin tamamı gözlenemedi. Bu toplamlar ortak fiyat yollarına bakan farklı varyantları içerir.

## VWAP’ta ne kaybettirdi?

- **Fiyat hareketi ve maliyet.** Birleşik 330 işlemin gerçekleşmelerinde bid-bid sonucu −346,71 $. Spread ve komisyon toplam 1.460,64 $. Net −1.807,35 $.
- **Stop sırası.** 202 kaybın tamamı stop. Bunların 125'i ilk üç mumda, 46'sı ise çıkış mumundan önce hedef mesafesinin en az yarısını gördükten sonra gerçekleşti. Kazanan 128 işlemin de 64'ü ilk üç mumda kapandı. Hızlı kapanışın kendisi kârlı bir filtreyi tanımlamıyor.
- **Stop sonrası dönüş.** 96 kayıp 30 dakika içinde eski hedefe ulaştı. 106 kayıp o süre içinde ulaşmadı. İki kayıpta stopun ötesinde açılış vardı ve toplam fark 4,90 $ oldu. Yüksek-önce ve düşük-önce yolları baz VWAP defterinde aynı çıkış türlerini verdi.
- **Yön ve önceki hareket.** Long ve short ayrı ayrı zararlıydı. Girişten önceki 15 M1 fiyat değişimi en az 1 ATR aynı yönde, en az 1 ATR karşı yönde ve aradaki nötr hareket olarak ayrıldığında kazanma sırasıyla %39,4, %37,7 ve %39,2 oldu. Üç grubun neti de negatif.

Eski sekiz günlük VWAP testindeki dört kaybın tamamı aşağıda. Hedefe dönüş saati stop mumundan sonraki tam dakikalara dayanıyor.

| Açılış UTC | Yön | Stop mumu | Net | Bid hareketi / maliyet | Eski hedefe stop sonrası |
|---|---|---:|---:|---:|---:|
| 9 Kasım 09:22 | Long | 2. mum | −24,22 $ | −18,12 $ / 6,09 $ | 10 dk |
| 13 Kasım 09:57 | Short | 3. mum | −23,61 $ | −16,53 $ / 7,08 $ | 19 dk |
| 16 Kasım 13:43 | Short | Giriş mumu | −23,08 $ | −17,80 $ / 5,28 $ | 14 dk |
| 18 Kasım 09:05 | Short | 5. mum | −22,86 $ | −18,24 $ / 4,62 $ | 4 dk |

Bu dört örnekte fiyat önce stop tarafına gitti. Daha sonraki hedef teması, giriş anında bilinmeyen bir sonuç.

## Stop ve zamanlama karşılaştırması

VWAP bazında her senaryo aynı arşivli sinyalle başlar, eski hedefi ve azami çıkış saatini korur. Lot, komisyon dahil o işlemin özgün planlı riskini aşmayacak şekilde aşağı yuvarlanır. Bekleme sırasında stop veya TP görülürse, 1 $ stop mesafesi kalmazsa veya lot alt sınırın altına inerse gecikmeli giriş atlanır. Tablo eşleşen işlemleri kıyaslar. Geniş stop koşularında 1–2 işlem zaman bakımından çakıştı. Bu işlem bazlı keşif karşılaştırması portföy ve FTM performansı üretmez.

| Değişiklik | Eşleşen kayıt | Orijinal $/işlem | Alternatif $/işlem | Eski zarar → kâr | Atlanan |
|---|---:|---:|---:|---:|---:|
| Stop mesafesi × 1,25 | 328 | −5,42 | −4,59 | 15 | 2 |
| Stop mesafesi × 1,50 | 328 | −5,42 | −4,41 | 25 | 2 |
| Stop mesafesi × 2,00 | 328 | −5,42 | −3,23 | 53 | 2 |
| Giriş 1 dakika sonra | 258 | −3,96 | −5,86 | 0 | 72 |
| Giriş 3 dakika sonra | 128 | −1,33 | −4,68 | 0 | 202 |

Genişletilmiş stop bu kayıtlarda zararı azalttı. Sabit süre beklemek elde kalan girişleri iyileştirmedi. Mumlar fiyatın izlediği aralıkları ve modelde hangi seviyenin önce işlediğini sınamaya yarıyor. Gerçek emir akışı, haber ve katılımcı niyeti bu veriyle nedensel olarak belirlenemez. Sonuçlar daha önce açılmış fiyatlara dayanır. Yeni strateji ayarı seçilmedi.

## Tekrar üretim

Kaynak mum dosyalarının SHA-256 değerleri ile işlem bazında açılış kotasyonu, kapanış fiyatı, zaman, çıkış nedeni ve net PnL arşivle doğrulanır. Fiyat hareketi − spread − komisyon eşitliği her işlemde kontrol edilir.

```powershell
node scripts/research/vwap-sensitivity.mjs --audit-ledger
node scripts/research/audit-losses.mjs
```
