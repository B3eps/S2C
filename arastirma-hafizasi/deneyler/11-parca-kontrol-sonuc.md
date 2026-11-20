# 11 · Parça M1 tetikleyici, hedef ve simülatör denetimi

**Sonuç.** İki kodlanmış giriş, benzer ve tetiği olmayan M1 açılışlarından daha kötü sonuç verdi. Altı işlem bid/ask tiklerine taşındığında altısının da stop veya hedef sırası korundu, ancak gerçek kotasyon daha geniş spread gösterdi. H1 hedefi ve İngilizce kaynakta anlatılan sweep → güçlü kırılım → aynı kırılımın FVG'sine geri dönüş ayrı ayrı denendi. Mevcut kurallardan tutarlı kârlı bir XAU/USD M1 sürümü doğrulanmadı.

## Parça ile model arasındaki kaynak farkı

Parça'nın MSP dersinin 04:20–04:53, 12:10–12:46 ve 15:09–15:46 bölümlerinde kırılacak seviye, FVG'yi oluşturan mumun veya bölgenin uç fitiliyle ilişkili. Eski model, en son 2+2 teyitli yerel swing'i kullanıyordu. İkisi aynı mum olmak zorunda değil. Aynı derste, hedefe göre stopu sıkıştırmak yerine bazı işlemlerde süpürülen likiditenin ötesine yerleştiriyor. [Parça MSP dersi](https://www.youtube.com/watch?v=I74zsmAstWQ&t=260s)

Daily Bias dersindeki altın örneği, açık bir yön yokken günlük FVG karşısında iki koşullu senaryo oluşturuyor. Bölge düşüşü tutarsa short yönü, yukarı invert olursa geri testten sonra long yönü inceliyor. İlk modelin yönü ise son M15 swing kapanışından geliyordu. Kapanmış UTC günleri ve gözlenen M1 tepkisiyle bunun bir araştırma yorumu ayrıca sınandı. [Parça Daily Bias altın örneği](https://www.youtube.com/watch?v=em2YkjggJUU&t=181s)

Canlı altın özetinde H1 likiditesi hedef, hedef önündeki M3 FVG potansiyel engel. Kâr serisini anlatan diğer videoda 200.000 $ hesap ve çoğu NQ olan seçilmiş yedi işlem bildiriliyor. Tam altın işlem ve pas defteri elde edilmedi. Açılan canlı zarar videosu için döküm yoktu. Parça'nın getirisini bizim 5.000 $ XAU/USD simülasyonuyla nicel olarak eşitlemek mümkün değil. [Canlı altın short](https://www.youtube.com/watch?v=m8GLmRxPlWI&t=122s) · [Hesap ve işlem özeti](https://www.youtube.com/watch?v=Mdxv5SV2qHY&t=100s)

İngilizce ICT dersinde kısa örnekte likidite geçişi, kısa vadeli yapının güçlü kırılımı ve o hareketin içinde oluşan üç mumluk FVG ayrı adımlar. Bu sıralamayı yeni bir M1 araştırma hipotezine çevirdim. Video yöntemi tanımlar. Kârlılık kanıtı, ayrı bir piyasada yaptığımız deneye bağlıdır. [ICT 2022, Bölüm 6](https://www.youtube.com/watch?v=Bkt8B3kLATQ&t=1130s)

## Kazanç tetikten mi geldi?

Gerçek işlem başına aynı gün ±45 dakika içinde M1/M15 yönü aynı, oynaklığı benzer, tetiği olmayan en yakın üç açılışı seçtim. Lot ve stop/hedef mesafeleri eşleştirildi, fiyat seviyeleri kontrol girişine ötelendi. Aynı sabit spread, komisyon, zaman sınırı ve ihtiyatlı OHLC yolu kullanıldı. Fiili işlem yeniden oynatıldığında kapanış nedeni, zamanı ve PnL arşivle eşleşti.

| Tetik | Eşleşen işlem | Tetik net $/işlem | Tetiksiz kontrol net $/işlem | Fark ve %95 gün bloklu aralık |
|---|---:|---:|---:|---:|
| FVG geri teması | 935/938 | −3,16 | −1,42 | −1,75 [−2,40 … −1,10] |
| Aynı mumda iFVG + swing | 725/725 | −1,99 | −0,43 | −1,56 [−2,52 … −0,71] |

FVG farkı üç dönem boyunca sırasıyla −1,72, −1,78 ve −1,76 $/işlem. Aynı mum iFVG farkı −1,58, −0,84 ve −2,52 $. Kontroller aynı gün ve benzer fiyat yollarını paylaşabilir. Aynı fiyat mutlak seviyelerini değil, aynı girişe göre SL/TP mesafelerini kullanırlar. Karşılaştırma ilişkiyi ölçer, tek tek kazançları şansa atamaz ve kendi başına kullanılabilir bir tetiksiz strateji üretmez.

FVG'nin 407 kazancı ortalama +19,37 $ (+0,93 R), 531 kaybı −20,49 $ (−0,98 R). 513 kayıp stopla kapandı, 40 stop sonrasında 30 dk içinde eski hedef görüldü. Çift teyidin 313 kazancı +22,60 $ (+1,08 R), 412 kaybı −20,68 $ (−0,98 R). Kazanç büyüklüğü çift teyitte daha iyi olsa da kayıp sıklığı, birleşik sonucu negatife taşıdı. [Kayıp bağlamı ve ilk işlem kayıtları](10-parca-m1-sonuc.md)

## Gözlenen yönteme yakınlaştırmalar

M1 karar ve dolum, M15 yön şartı, aynı risk motoru. Tabloda net USD/işlem. Tüm bölümlerin fiyatları önceki çalışmalardan görülmüş. Daha sonra elde edilen MSP dökümüne dayalı uç fitil şartı ile H1 ve ICT sırası ayrıca protokollendi.

| Değişiklik | Geliştirme | Doğrulama | Görülmüş çapraz |
|---|---:|---:|---:|
| FVG, önce ters M1 yönünden dönsün | −0,96 | −5,65 | −1,48 |
| iFVG, önce ters M1 yönünden dönsün | −1,13 | −3,52 | −0,97 |
| FVG ile hedef arasında karşı M5 FVG olmasın | −1,39 | −5,52 | −4,62 |
| iFVG ile hedef arasında karşı M5 FVG olmasın | −3,56 | −3,65 | −0,70 |
| iFVG sonrası FVG oluşumunun uç fitili aşılsın | −1,39 | −2,99 | −0,75 |
| FVG, M15 hedefi yerine açık H1 swing izlensin | −3,21 | −1,40 | −1,81 |
| iFVG, M15 hedefi yerine açık H1 swing izlensin | −2,39 | −5,65 | +4,43 |
| iFVG, H1 hedefine giderken karşı M5 FVG önünde çıkılsın | −2,95 | −3,60 | −1,88 |
| Sweep → güçlü M1 kırılım → o FVG'ye geri temas | −4,58 | −5,06 | +0,22 |
| Önceden bilinen günlük FVG reaksiyonu + FVG geri temas girişi | −2,34 (41) | +4,96 (14) | −7,01 (38) |
| Önceden bilinen günlük FVG reaksiyonu + çift teyit | −0,10 (28) | +4,72 (11) | −1,07 (30) |

Uç fitil teyidinde 524 işlem, 257'si gecikmeli. H1 çift teyidin çapraz +4,43 $ örneği 74 işlem, beklenti aralığı −3,46 ile +15,14 $. Aynı giriş/stop/lota sahip 67 eşleşmede eski hedef +377,43 $, H1 hedefi +391,49 $ verdi. Pozitif dönemde toplam iyileşmenin büyük kısmını sadece hedef değişikliğine atfedemeyiz. Doğrulamada aynı tür 65 eşleşmede −337,17 $ → −360,65 $. ICT sırası çapraz 71 işlemde +15,78 $ verdi ve o dönemin beklenti aralığı −7,27 ile +8,48 $ arasında. Günlük senaryo testinde her bölümün başında önceki uygun UTC günleri sıfırdan birikir. Yeterli veri olmayan günlerde açık bölge çıkarılmaz. Günlük senaryodaki kısa doğrulama kazancı diğer iki dönemde tekrar etmedi. Yeni kurallar ileri döneme seçilmedi.

## S2C model ve veri denetimi

Önceden seçilen altı işlem, üç dönemin FVG defterindeki kronolojik ilk kazanç ve ilk kayıp. Aynı karar saati, lot, SL ve TP ile önce tik bid + 0,20 $ model spread, sonra gerçek bid/ask replay. 183.297 kotasyon incelendi. Altı işlemin üç stop ve üç hedef sonucu her iki tik replay'inde aynı kaldı. Tikler arasındaki ilk gözlenen kotasyonla dolum ve komisyon uygulandı. [Dukascopy tik veri tanımı](https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/history-ticks/)

| Altı vaka | Net |
|---|---:|
| Orijinal M1 OHLC | −53,43 $ |
| Gerçek tik BID + 0,20 $ varsayımı | −53,95 $ |
| Gerçek BID/ASK tikleri | −59,07 $ |

Açılışta gözlenen spread vakaya göre 0,497–0,647 $/ons. Bu küçük örnekte stop-hedef sırasını bozan bir hata yakalanmadı. 0,20 $ sabit spread, altı açılışın tamamında iyimserdi. Broker gerçekleşmesi, derinlik ve mümkün kayma ayrı belirsizlikler.

Dört yeni senaryo testi H1 pivotunu, eksik mumu, M1 FVG kapanışını, günlük inversion sonrası yeniden teması ve geçersiz açılış kotasyonunu kontrol eder. 12 gün önek karşılaştırması, sonradan eklenen mumların önceki kararları değiştirmediğini doğruladı. Eski kilitli kodun parmak izleri ve eski işlem defterleri kontrol edildi. İleri dönem okunmadı. [Kontrol protokolü](11-parca-kontrol-protokol.md) · [Hedef ve sıra protokolü](12-parca-hedef-sira-protokol.md) · [İşlem ve eşleşme JSON](../../analysis/research-parca-m1-controls.json) · [Altı tik karşılaştırması](../../analysis/research-parca-m1-tick-check.json)

```powershell
node scripts/research/parca-m1-controls.mjs
node --test scripts/research/test-parca-m1-sequence.mjs
& ./scripts/research/fetch-parca-audit-ticks.ps1
node scripts/research/audit-parca-ticks.mjs
```
