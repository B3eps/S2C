# 01 · Fibonacci düzeltmesi

**Karar.** %60–70 birincil hipotezi desteklenmedi. Ayrılmış örnekte 37 işlemin 8'i kazandı. Net −445,69 $, işlem başına −12,05 $ ve günlük ortalama −14,86 $. Gün kümeli beklenti aralığı −18,21 $ ile −4,78 $ arasında. %35–45 kontrolü daha az kaybetti. FVG şartı da üç dönemde zarardaydı. Bu kuralları S2C uygulamasına eklemeyi önermiyorum.

M1 teyitli pivot, geri alım ve önceki mumun ucu aşılarak kapanış. Giriş sonraki açılış. Stop geri alımın sınırına, hedef 1,5 brüt R'ye bağlı. Karşılaştırma kuralları geliştirme sonuçlarından önce belirlendi ve test verisi indirilmeden önce [kural kilidi](01-fibonacci-kural-kilidi.json) üretildi. [Sayısal protokol](01-fibonacci-protokol.md) · [Dönem kaydı](donem-kaydi.md)

Birincil varyantta ayrılmış testteki altı 5 günlük ve bir 20 günlük hesap hedefe veya ihlale ulaşmadan kapandı. Pencerelere girmeyen son 10 gün, tam 20 günlük hesap sayısına eklenmedi. 30 günlük kesintisiz işlem defteri bu nedenle hesap pencerelerinin sonucundan daha büyük kümülatif zarar gösterebilir. Mum yolları işlemleri ve hesap statülerini değiştirmedi. Kısa örnekte bu eşitlik, gerçek fiyat yolunu doğrulamaz.

İlk kayıpta, long teyidinin sonrasında stop emri 4.393,17 $ seviyesinden sonraki açılışta 4.393,02 $'a doldu. Bu nedenle zarar 22,97 $ planlanan riskin üzerine çıktı. İlk kazançta short hedefi ask tarafında gerçekleşti. İki kayıt stop boşluğu ve alış/satış tarafı modelini denetlemeye yarar.

Açık pozisyonlar için gerçek değişken spread, kayma, likidite, makro haber sırasındaki dolum ve işlem derinliği ölçülmedi. Test verisinin proje içi kayıtları ve ilk önbellek envanteri ayrık. Proje dışı inceleme geçmişi doğrulanamıyor. Eski geliştirme günlerinden 12'sinin üç varyantında 65 önek karşılaştırması, sonraki mumların daha önceki sinyalleri değiştirmediğini doğruladı.

Veri önbelleğini doldurmak için proje kökünde

```powershell
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-01-05 -To 2026-05-01
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-05-04 -To 2026-08-08
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-09-07 -To 2026-10-19
```

## Veri

| Dönem | UTC, bitiş hariç | Uygun / aday gün | Kapsam dışı | Kabul edilen günlerde eksik M1 |
|---|---|---:|---|---:|
| Geliştirme | 2026-01-05 – 2026-05-01 | 83/84 | 2026-04-03 (720 eksik) | 1 |
| Doğrulama | 2026-05-04 – 2026-08-08 | 68/70 | 2026-06-19 (121 eksik), 2026-07-03 (121 eksik) | 31 |
| Ayrılmış test | 2026-09-07 – 2026-10-19 | 30/30 | — | 31 |

Dukascopy XAU/USD bid M1. Sıfır hacimli dolgu için kullanılan düz mumlar alınmadı. Bütün işlemler M1; kapanış sinyali bir sonraki bitişik M1 açılışında uygulanır. Kaynak önbellek SHA-256 değeri ve tarih kapsamı her JSON dosyasında bulunur. [Dukascopy veri kaynağı](https://www.dukascopy.com/api/data/get/historical-data-export)

## Net işlem istatistikleri

Tablo bar başına ihtiyatlı yolu kullanır. Tüm tutarlar USD. Net istatistiklerin hesabı, FTM’de ilk ihlalde kapanan hesap pencerelerinden ayrı yürütülür. Wilson aralığı işlem bağımsızlığı varsayan betimsel bir aralıktır. Beklenti aralığı 2.000 gün-kümeli bootstrap tekrarına dayanır ve günler arasındaki seri bağımlılığı kapsamaz.

| Dönem | Varyant | n | Kazanma [Wilson %95] | Ort. kazanç / kayıp | Net | Beklenti [%95] | Düşüş, kapanmış / özkaynak | Ort. gün |
|---|---|---:|---|---:|---:|---|---:|---:|
| Geliştirme | fib-60-70 | 107 | %37.4 [%28.8 … %46.8] | 27.08 / -22.39 | -417.02 | -3.90 [-8.36 … 0.59] | 551.84 / 560.74 | -5.02 |
| Geliştirme | control-35-45 | 155 | %43.9 [%36.3 … %51.7] | 27.45 / -21.84 | -33.29 | -0.21 [-3.89 … 3.34] | 316.39 / 328.36 | -0.40 |
| Geliştirme | fib-fvg | 75 | %38.7 [%28.5 … %50.0] | 27.14 / -22.32 | -239.54 | -3.19 [-8.46 … 2.15] | 270.25 / 289.88 | -2.89 |
| Doğrulama | fib-60-70 | 90 | %34.4 [%25.4 … %44.7] | 26.59 / -22.85 | -523.97 | -5.82 [-10.26 … -1.59] | 543.86 / 547.46 | -7.71 |
| Doğrulama | control-35-45 | 159 | %40.9 [%33.5 … %48.6] | 27.11 / -22.89 | -389.77 | -2.45 [-5.52 … 0.63] | 570.64 / 584.90 | -5.73 |
| Doğrulama | fib-fvg | 63 | %30.2 [%20.2 … %42.4] | 25.85 / -22.88 | -515.58 | -8.18 [-13.35 … -2.88] | 515.58 / 515.58 | -7.58 |
| Ayrılmış test | fib-60-70 | 37 | %21.6 [%11.4 … %37.2] | 27.54 / -22.97 | -445.69 | -12.05 [-18.21 … -4.78] | 475.75 / 489.11 | -14.86 |
| Ayrılmış test | control-35-45 | 61 | %42.6 [%31.0 … %55.1] | 27.49 / -22.82 | -83.91 | -1.38 [-8.69 … 5.89] | 326.88 / 339.72 | -2.80 |
| Ayrılmış test | fib-fvg | 22 | %27.3 [%13.2 … %48.2] | 27.96 / -23.18 | -203.19 | -9.24 [-18.63 … 1.69] | 254.53 / 267.88 | -6.77 |

Özkaynak düşüşü, daha önce gözlenen kapanış özkaynağı tepesinden modelin mum içi diplerine ölçülür. Gerçek tik bazlı düşüş farklı olabilir.

## Ayrılmış testte günlük performans ve yol duyarlılığı

| Varyant | Pozitif / negatif / sıfır gün | Alt medyan | En kötü / en iyi gün | En az 100 $ gün | Açık pozisyonda veri boşluğu | Net: yüksek önce / düşük önce / ihtiyatlı |
|---|---:|---:|---:|---:|---:|---:|
| fib-60-70 | 7 / 13 / 10 | 0.00 | -71.91 / 29.24 | 0 | 0 | -445.69 / -445.69 / -445.69 |
| control-35-45 | 11 / 14 / 5 | 0.00 | -93.34 / 111.80 | 1 | 0 | -83.91 / -83.91 / -83.91 |
| fib-fvg | 6 / 11 / 13 | 0.00 | -62.09 / 29.24 | 0 | 0 | -203.19 / -203.19 / -203.19 |

## FTM Infinity Plus, 5.000 $

Aynı dönemdeki tam ve çakışmayan 5 ve 20 uygun gün pencereleri. Hücre sırası geçti / ihlal / açık kaldı. Pencere sonunda açık kalan hesap sağdan sansürlüdür. Bir strateji için 5 ve 20 günlük gruplar aynı tarihlere dayanabilir. Hesap durumu ilk hedefte veya ihlalde kesilir. Son bakiye, tarih ve ihlal türü JSON işlem dosyasındadır.

| Dönem | Varyant | İhtiyatlı 5 gün | İhtiyatlı 20 gün | Yüksek önce 5 / 20 gün | Düşük önce 5 / 20 gün |
|---|---|---:|---:|---|---|
| Geliştirme | fib-60-70 | 0/0/16 | 0/1/3 | 0/0/16 · 0/1/3 | 0/0/16 · 0/1/3 |
| Geliştirme | control-35-45 | 0/0/16 | 0/0/4 | 0/0/16 · 0/0/4 | 0/0/16 · 0/0/4 |
| Geliştirme | fib-fvg | 0/0/16 | 0/0/4 | 0/0/16 · 0/0/4 | 0/0/16 · 0/0/4 |
| Doğrulama | fib-60-70 | 0/0/13 | 0/0/3 | 0/0/13 · 0/0/3 | 0/0/13 · 0/0/3 |
| Doğrulama | control-35-45 | 0/0/13 | 0/1/2 | 0/0/13 · 0/1/2 | 0/0/13 · 0/1/2 |
| Doğrulama | fib-fvg | 0/0/13 | 0/0/3 | 0/0/13 · 0/0/3 | 0/0/13 · 0/0/3 |
| Ayrılmış test | fib-60-70 | 0/0/6 | 0/0/1 | 0/0/6 · 0/0/1 | 0/0/6 · 0/0/1 |
| Ayrılmış test | control-35-45 | 0/0/6 | 0/0/1 | 0/0/6 · 0/0/1 | 0/0/6 · 0/0/1 |
| Ayrılmış test | fib-fvg | 0/0/6 | 0/0/1 | 0/0/6 · 0/0/1 | 0/0/6 · 0/0/1 |

## İşlem denetimi

Birincil varyantta 8 kazanç, 29 kayıp ve 0 başa baş işlem. Aşağıdaki örnekler kronolojik ilk kâr ve ilk zarardır. Giriş kararında kullanılan bağlam ve sinyal zamanı JSON işlem kaydındadır.

| Açılış UTC | Yön ve lot | Giriş / SL / TP | Çıkış, neden | Net |
|---|---|---:|---|---:|
| 2026-09-08 09:26 | long · 0.08 | 4395.60 / 4393.17 / 4399.25 | 4393.02 · sl | -24.24 |
| 2026-09-09 16:06 | short · 0.07 | 4400.49 / 4403.57 / 4395.87 | 4395.87 · tp | 29.24 |

Pozisyon defteri günlük net sonucu, kaldıraç altında atlanan girişleri, açılış ve çıkış fiyatlarını içerir. Grafikte sonradan görülen fiyat yolu girişte bilinen bir koşul veya nedensellik kanıtı sayılmaz.

## Tekrar üretim

Proje kökünde, önbellek hazırken

```powershell
node scripts/research/run.mjs fib development
node scripts/research/run.mjs fib validation
node scripts/research/run.mjs fib test
```

- [Geliştirme işlem ve hesap defteri](../../analysis/research-fib-development.json)
- [Doğrulama işlem ve hesap defteri](../../analysis/research-fib-validation.json)
- [Ayrılmış test işlem ve hesap defteri](../../analysis/research-fib-test.json)
