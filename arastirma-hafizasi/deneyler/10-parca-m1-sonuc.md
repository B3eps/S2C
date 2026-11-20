# 10 · Parça M1 araştırması

**Karar.** İncelenen M1 uygulaması, üç tarih bölümünün hiçbirinde pozitif net beklenti vermedi. Birincil M1 FVG geri temasında 938 işlem, 407 kazanç ve 531 kayıp var. Üç dönemin ayrı işlem defterleri toplamı −2.998,65 $. M15 bölge temasıyla yapılan ek deneme, iki ayrı kuralda farklı bölgelerde kısa pozitif sonuç verdi. Doğrulamanın ikisi de negatif. Uygulama için kârlı aday doğrulanmadı.

## Uygulanan karar zinciri

Kapanmış M15 son swing yönü → önceden teyit edilmiş M1 swing'in aynı yönde kapanışla aşılması → birincil varyantta önceden oluşmuş M1 FVG'ye yakın zamanda geri temas → sonraki M1 açılışında geçerli kotasyon → yapısal stop, önceden bilinen M15 likiditesi hedef.

H4 yönü yalnız etikettir. M5 yalnız bir karşılaştırmada inversion bağlamıdır. Her fırsatta giriş, stop ve hedef farklı etiketler için aynı hesaplanır. Gecikmeli emir varyantı breakout seviyesinin kapanışla yeniden tutulmasını arar ve hedef/stopu korur. M5 inversion ve M1 FVG oluşumu aynı dakikada kapanırsa ikisi de birlikte bilinebildiğinden bağlam koşulu sağlanır. Sayısal eşikler ve ileri dönem önceden kaydedildi. [Protokol](10-parca-m1-protokol.md) · [Kural kilidi](10-parca-m1-kural-kilidi.json) · [Video notları](09-parca-video-kural-okumasi.md)

## Üç tarihi bölüm

Geliştirme 5 Ocak–1 Mayıs 2026, 83 uygun gün. Doğrulama 4 Mayıs–8 Ağustos, 68. Görülmüş çapraz bölüm 7 Eylül–19 Kasım, 50. Tarihler UTC ve sağ uç hariç. Önceki dönem kayıtlarından 20–21 Ekim ve 3 Kasım çıkarıldı. Üç bölüm de daha önce incelenmiş fiyatlardan oluşuyor. İleri dönem [20 Kasım 2026, 1 Şubat 2027) için kilit var. Pencere kapanmadan ileri çalışma komutu sonuç üretmez.

| Varyant | Geliştirme n / $ işlem | Doğrulama n / $ işlem | Görülmüş çapraz n / $ işlem |
|---|---:|---:|---:|
| Yalnız M1 swing kırılımı | 604 / −2,86 | 442 / −2,93 | 359 / −1,07 |
| M1 FVG geri teması | 398 / −2,06 | 291 / −4,51 | 249 / −3,48 |
| Aynı M1 mumunda iFVG + swing | 310 / −1,63 | 241 / −3,67 | 174 / −0,32 |
| Önce M5 inversion, sonra M1 FVG geri teması | 170 / −3,11 | 124 / −5,23 | 103 / −2,91 |
| M1 FVG sonrası geri test emri | 259 / −1,29 | 209 / −6,10 | 183 / −3,82 |

| Birincil M1 FVG | n | Maliyet sonrası kazanma | Ort. kazanç / kayıp | Net | Net beklenti %95 gün bloklu aralık | Özkaynak düşüşü | Ort. gün |
|---|---:|---:|---:|---:|---|---:|---:|
| Geliştirme | 398 | %46,0 | 19,01 / −19,99 $ | −820,38 $ | −4,28 … +0,34 $ | 1.054,69 $ | −9,88 $ |
| Doğrulama | 291 | %41,9 | 18,00 / −20,76 $ | −1.311,92 $ | −6,52 … −2,34 $ | 1.391,83 $ | −19,29 $ |
| Görülmüş çapraz | 249 | %41,0 | 21,65 / −20,92 $ | −866,35 $ | −6,34 … −0,32 $ | 1.155,72 $ | −17,33 $ |

Uygun günler bazında pozitif/negatif/sıfır sırasıyla 33/49/1, 16/52/0 ve 16/34/0. En az 100 $ gün sayısı 2/0/1. Düşüş, önceki kapanış özkaynağı zirvesi ile modelin mum içi özkaynağı arasında ölçülür. Bootstrap gün kümelidir ve günler arası seri bağımlılığı kapsamaz.

Birincilde 5 günlük FTM pencereleri toplam 39 hesap: 0 geçti, 4 ihlal, 35 açık. 20 günlük toplam 9 hesap: 0 geçti, 7 ihlal, 2 açık. Aynı dönemin 5 ve 20 günlük pencereleri birbiriyle örtüşebilir. Pencere sonunda açık hesaplar sansürlüdür. İşlem istatistiği ayrı, hesap ihlalinde duran tekrar ayrı. 0,50 $ spread ile birincil beklenti geliştirme/doğrulama/çaprazda sırasıyla −2,66 / −5,00 / −4,29 $/işlem.

## Kayıp teşhisi ve giriş değişikliği

- 531 kaybın 513'ü stop. Stoplardan yalnız 40'ında fiyat sonraki 30 dakika içinde eski hedefi gördü. 473'ü o süre içinde görmedi. Üç bölümde de birincil kural, gerçekleşen işlem saatleri ve lotları sabitken **bid hareketiyle dahi eksideydi**. Sırasıyla −136,00 $, −741,73 $, −334,22 $. Spread ve komisyon zararı artırdı.
- Sabit stop ve hedefle breakout geri testini beklemek geliştirmede kaybı azalttı. Doğrulamada −4,51 $/işlemden −6,10 $/işleme indi. Doğrulamada 212 fırsat bekleme koşulunu tamamlamadı. Gecikme, hangi işlemlerin açıldığını da değiştirdi.
- 938 kurulumun 355'inin hedefi 1R altında kaldı. Brüt planlı R medyanı 1,33. 1R'yi zorlamak için stop yeri değiştirilmedi. H4 aynı, karşıt ve nötr etiketlerinde net ortalamalar sırasıyla −3,38 $, −2,88 $, −3,37 $. Bu betimleme H4'ü yön filtresine dönüştürmek için temel vermiyor.
- Yüksek-önce, düşük-önce ve ihtiyatlı yollar bu örneklemde aynı toplam net sonuçlara ulaştı. Gerçek mum içi sırayı veya gerçek dolumu bu eşitlik doğrulamaz.

İlk kayıp 5 Ocak 08:01 UTC long. Kırılan swing seviyesi 08:00'de biliniyordu, M1 FVG teması 08:00'de kapanmıştı. Giriş 4.423,00 $, stop 4.419,39 $, hedef 4.426,00 $. İlk mum stopla −24,31 $. Aynı gün ilk kazanç 10:35 UTC long. Swing daha önce 10:30'da biliniyordu, temas 10:35'te kapanmıştı. Giriş 4.436,64 $, hedef 4.437,93 $. Kısa hedef maliyet sonrası +4,18 $ bıraktı. Her iki örnekte giriş öncesi koşullar kaydedildi. Sonuç, olayın neden gerçekleştiğini açıklamaz.

## M15 bölgesi ek karşılaştırması

İlk sonuçtan sonra tek bir bağlam hipotezi eklendi. Önceden kapanmış üç M15 mumundan en az 0,20 $ genişlikli aynı yönlü FVG, en fazla üç saat yaşar. Son 15 M1 içinde bölgeye girip orta seviyenin yön tarafında kapanan ve tetik anında geçerli kalan bölge aranır. H4, M1 giriş, stop, hedef ve hesap kuralları sabit. Bu karşılaştırma keşiftir.

| M15 bölgesine tepkiyle | Geliştirme n / $ işlem | Doğrulama n / $ işlem | Görülmüş çapraz n / $ işlem |
|---|---:|---:|---:|
| M1 FVG geri teması | 67 / +0,89 | 52 / −6,40 | 52 / −4,17 |
| Aynı M1 iFVG + swing | 64 / −0,92 | 47 / −4,27 | 39 / +1,86 |

Çapraz dönemdeki +1,86 $/işlem aralığı −5,29 ile +8,51 $. Bölge koşulu bazı günlerde seçimi değiştiriyor ancak sürekli katkı gözlenmedi. Seçilen videolardaki el ile seviyeler, kârlılık iddiası ve gerçek broker dolumu bağımsız olarak doğrulanmadı. Birincil ileri protokol değişmedi. Uygulama göstergeleri ve eski araştırmalar arşivde.

## Tekrar üretim

```powershell
node scripts/research/run-parca-m1.mjs historical
node scripts/research/parca-m1-poi.mjs
# Pencere kapandıktan ve arşiv dosyaları hazır olduktan sonra
node scripts/research/run-parca-m1.mjs forward
```

135 temel önek karşılaştırması ve 36 M15 bölgesi önek karşılaştırması geçti. Aynı girdiye ilerideki mumları eklemek, önceki sinyalleri değiştirmedi. Ham işlemlerde kaynak veri özeti, teyit zamanı, stop/hedef seviyesi ve açık pozisyon sonrası hedef denetimi var. [Ana işlem defteri](../../analysis/research-parca-m1-historical.json) · [M15 bölgesi defteri](../../analysis/research-parca-m1-poi.json)
