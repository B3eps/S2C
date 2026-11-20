# 04 · Seans VWAP'ına doğru geri dönüş

**Karar.** İki varyant 8 test gününde aynı 10 işlemi yaptı. Altı kazanç, net +30,18 $, işlem başına +3,02 $ ve günlük ortalama +3,77 $. İki eski dönemde her iki varyant da belirgin zarar etti. Test beklentisinin aralığı −9,04 $ ile +12,41 $ arasında. Yatay VWAP koşulu bu örnekte hiçbir işlemi değiştirmedi. Uygulamaya ekleme için kanıt yetersiz.

Sinyal, M1 fiyatının günlük UTC 07:00'dan hesaplanan, önceden gözlenen hacim ağırlıklı referanstan uzaklaşması ve geri kapanmasıyla oluşur. Önceden bilinen referans giriş koşuluna girer. Emir hedefi sonraki açılış fiyatından 1,25 brüt R ile hesaplanır. Ortalama net kazanç 20,66 $, ortalama net kayıp 23,44 $. En iyi gün 38,68 $. [Sayısal protokol](04-vwap-donusu-protokol.md) · [Kural kilidi](04-vwap-donusu-kural-kilidi.json)

Bir 5 günlük hesap açık kaldı. 20 günlük pencere için veri yok. Dukascopy hacmi, akışın kendi ölçümüdür. Başka sağlayıcılardaki VWAP, yayılım ve dolum bu sonuçlardan çıkarılamaz.

```powershell
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-11-09 -To 2026-11-19
```

Geliştirme ve doğrulama verisini [[01-fibonacci]] dosyasındaki komutlar getirir.

## Veri

| Dönem | UTC, bitiş hariç | Uygun / aday gün | Kapsam dışı | Kabul edilen günlerde eksik M1 |
|---|---|---:|---|---:|
| Geliştirme | 2026-01-05 – 2026-05-01 | 83/84 | 2026-04-03 (720 eksik) | 1 |
| Doğrulama | 2026-05-04 – 2026-08-08 | 68/70 | 2026-06-19 (121 eksik), 2026-07-03 (121 eksik) | 31 |
| Ayrılmış test | 2026-11-09 – 2026-11-19 | 8/8 | — | 0 |

Dukascopy XAU/USD bid M1. Sıfır hacimli dolgu için kullanılan düz mumlar alınmadı. Bütün işlemler M1; kapanış sinyali bir sonraki bitişik M1 açılışında uygulanır. Kaynak önbellek SHA-256 değeri ve tarih kapsamı her JSON dosyasında bulunur. [Dukascopy veri kaynağı](https://www.dukascopy.com/api/data/get/historical-data-export)

## Net işlem istatistikleri

Tablo bar başına ihtiyatlı yolu kullanır. Tüm tutarlar USD. Net istatistiklerin hesabı, FTM’de ilk ihlalde kapanan hesap pencerelerinden ayrı yürütülür. Wilson aralığı işlem bağımsızlığı varsayan betimsel bir aralıktır. Beklenti aralığı 2.000 gün-kümeli bootstrap tekrarına dayanır ve günler arasındaki seri bağımlılığı kapsamaz.

| Dönem | Varyant | n | Kazanma [Wilson %95] | Ort. kazanç / kayıp | Net | Beklenti [%95] | Düşüş, kapanmış / özkaynak | Ort. gün |
|---|---|---:|---|---:|---:|---|---:|---:|
| Geliştirme | vwap-reversion | 159 | %37.7 [%30.6 … %45.5] | 20.35 / -22.39 | -995.80 | -6.26 [-9.08 … -3.46] | 997.78 / 998.04 | -12.00 |
| Geliştirme | vwap-flat | 148 | %39.2 [%31.7 … %47.2] | 20.38 / -22.56 | -848.31 | -5.73 [-8.71 … -2.83] | 874.00 / 874.00 | -10.22 |
| Doğrulama | vwap-reversion | 98 | %34.7 [%26.0 … %44.5] | 19.81 / -22.37 | -758.17 | -7.74 [-12.04 … -3.38] | 798.16 / 808.39 | -11.15 |
| Doğrulama | vwap-flat | 95 | %35.8 [%26.9 … %45.8] | 19.81 / -22.42 | -694.26 | -7.31 [-11.79 … -2.66] | 734.25 / 744.48 | -10.21 |
| Ayrılmış test | vwap-reversion | 10 | %60.0 [%31.3 … %83.2] | 20.66 / -23.44 | 30.18 | 3.02 [-9.04 … 12.41] | 27.32 / 42.68 | 3.77 |
| Ayrılmış test | vwap-flat | 10 | %60.0 [%31.3 … %83.2] | 20.66 / -23.44 | 30.18 | 3.02 [-9.04 … 12.41] | 27.32 / 42.68 | 3.77 |

Özkaynak düşüşü, daha önce gözlenen kapanış özkaynağı tepesinden modelin mum içi diplerine ölçülür. Gerçek tik bazlı düşüş farklı olabilir.

## Ayrılmış testte günlük performans ve yol duyarlılığı

| Varyant | Pozitif / negatif / sıfır gün | Alt medyan | En kötü / en iyi gün | En az 100 $ gün | Açık pozisyonda veri boşluğu | Net: yüksek önce / düşük önce / ihtiyatlı |
|---|---:|---:|---:|---:|---:|---:|
| vwap-reversion | 2 / 3 / 3 | 0.00 | -24.22 / 38.68 | 0 | 0 | 30.18 / 30.18 / 30.18 |
| vwap-flat | 2 / 3 / 3 | 0.00 | -24.22 / 38.68 | 0 | 0 | 30.18 / 30.18 / 30.18 |

## FTM Infinity Plus, 5.000 $

Aynı dönemdeki tam ve çakışmayan 5 ve 20 uygun gün pencereleri. Hücre sırası geçti / ihlal / açık kaldı. Pencere sonunda açık kalan hesap sağdan sansürlüdür. Bir strateji için 5 ve 20 günlük gruplar aynı tarihlere dayanabilir. Hesap durumu ilk hedefte veya ihlalde kesilir. Son bakiye, tarih ve ihlal türü JSON işlem dosyasındadır.

| Dönem | Varyant | İhtiyatlı 5 gün | İhtiyatlı 20 gün | Yüksek önce 5 / 20 gün | Düşük önce 5 / 20 gün |
|---|---|---:|---:|---|---|
| Geliştirme | vwap-reversion | 0/0/16 | 0/2/2 | 0/0/16 · 0/2/2 | 0/0/16 · 0/2/2 |
| Geliştirme | vwap-flat | 0/0/16 | 0/1/3 | 0/0/16 · 0/1/3 | 0/0/16 · 0/1/3 |
| Doğrulama | vwap-reversion | 0/0/13 | 0/2/1 | 0/0/13 · 0/2/1 | 0/0/13 · 0/2/1 |
| Doğrulama | vwap-flat | 0/0/13 | 0/2/1 | 0/0/13 · 0/2/1 | 0/0/13 · 0/2/1 |
| Ayrılmış test | vwap-reversion | 0/0/1 | 0/0/0 | 0/0/1 · 0/0/0 | 0/0/1 · 0/0/0 |
| Ayrılmış test | vwap-flat | 0/0/1 | 0/0/0 | 0/0/1 · 0/0/0 | 0/0/1 · 0/0/0 |

## İşlem denetimi

Birincil varyantta 6 kazanç, 4 kayıp ve 0 başa baş işlem. Aşağıdaki örnekler kronolojik ilk kâr ve ilk zarardır. Giriş kararında kullanılan bağlam ve sinyal zamanı JSON işlem kaydındadır.

| Açılış UTC | Yön ve lot | Giriş / SL / TP | Çıkış, neden | Net |
|---|---|---:|---|---:|
| 2026-11-09 09:22 | long · 0.10 | 4093.92 / 4091.91 / 4096.44 | 4091.91 · sl | -24.22 |
| 2026-11-13 08:12 | long · 0.10 | 3895.23 / 3893.28 / 3897.68 | 3897.68 · tp | 20.51 |

Pozisyon defteri günlük net sonucu, kaldıraç altında atlanan girişleri, açılış ve çıkış fiyatlarını içerir. Grafikte sonradan görülen fiyat yolu girişte bilinen bir koşul veya nedensellik kanıtı sayılmaz.

## Tekrar üretim

Proje kökünde, önbellek hazırken

```powershell
node scripts/research/run.mjs vwap development
node scripts/research/run.mjs vwap validation
node scripts/research/run.mjs vwap test
```

- [Geliştirme işlem ve hesap defteri](../../analysis/research-vwap-development.json)
- [Doğrulama işlem ve hesap defteri](../../analysis/research-vwap-validation.json)
- [Ayrılmış test işlem ve hesap defteri](../../analysis/research-vwap-test.json)

İleri doğrulama desteklerse VWAP sinyali, S2C'ye isteğe bağlı ve seans başında sıfırlanan M1 araştırma işareti olarak eklenebilir. Aynı Dukascopy hacim alanı, UTC başlangıcı ve kapanmış mum şartı korunursa tarayıcı sinyalleri deney defteriyle karşılaştırılabilir.
