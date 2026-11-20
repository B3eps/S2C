# 02 · Açılış aralığı kırılımı

**Karar.** 07:00–07:29 UTC aralığından ilk teyitli kırılım 8 uygun test gününde 11 işlem üretti. Dördü kazandı. Net −73,79 $, işlem başına −6,71 $. Yeniden temas varyantı doğrulamada +3,29 $/işlem gösterdi, ayrılmış testte iki işlemin ikisi de kaybetti. Bu iki işlemden yeniden temasın etkisi ölçülemez. Uygulamaya ekleme için kanıt yetersiz.

Giriş bir yönde ilk aralık dışı kapanışı izler. Yeniden temas varyantı aynı kırılımdan sonra en çok 10 dakika bekler. M1 stopu, 1,5 brüt R hedefi, seans sonu çıkışı ve sabit 25 $ planlı risk kullanılır. [Sayısal protokol](02-acilis-araligi-protokol.md) · [Kural kilidi](02-acilis-araligi-kural-kilidi.json)

Her varyantta bir tam 5 günlük hesap açık kaldı. Test penceresi 20 günden kısa. 20–21 Ekim, test başlangıcından önce yerel önbellekte bulunduğu için çalışma dışı. Örnekler teyit ve gerçekleşen çıkış arasındaki farkı denetlemek için işlem defterinden kronolojik seçimle alındı.

```powershell
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-10-19 -To 2026-11-02 -Exclude 2026-10-20,2026-10-21
```

Geliştirme ve doğrulama verisini [[01-fibonacci]] dosyasındaki komutlar getirir. Spread ve komisyon değerleri S2C'nin FTM modelindendir. Değişken spread ve kayma senaryoları ölçülmedi.

## Veri

| Dönem | UTC, bitiş hariç | Uygun / aday gün | Kapsam dışı | Kabul edilen günlerde eksik M1 |
|---|---|---:|---|---:|
| Geliştirme | 2026-01-05 – 2026-05-01 | 83/84 | 2026-04-03 (720 eksik) | 1 |
| Doğrulama | 2026-05-04 – 2026-08-08 | 68/70 | 2026-06-19 (121 eksik), 2026-07-03 (121 eksik) | 31 |
| Ayrılmış test | 2026-10-19 – 2026-11-02 | 8/8 | 2026-10-20, 2026-10-21 | 0 |

Dukascopy XAU/USD bid M1. Sıfır hacimli dolgu için kullanılan düz mumlar alınmadı. Bütün işlemler M1; kapanış sinyali bir sonraki bitişik M1 açılışında uygulanır. Kaynak önbellek SHA-256 değeri ve tarih kapsamı her JSON dosyasında bulunur. [Dukascopy veri kaynağı](https://www.dukascopy.com/api/data/get/historical-data-export)

## Net işlem istatistikleri

Tablo bar başına ihtiyatlı yolu kullanır. Tüm tutarlar USD. Net istatistiklerin hesabı, FTM’de ilk ihlalde kapanan hesap pencerelerinden ayrı yürütülür. Wilson aralığı işlem bağımsızlığı varsayan betimsel bir aralıktır. Beklenti aralığı 2.000 gün-kümeli bootstrap tekrarına dayanır ve günler arasındaki seri bağımlılığı kapsamaz.

| Dönem | Varyant | n | Kazanma [Wilson %95] | Ort. kazanç / kayıp | Net | Beklenti [%95] | Düşüş, kapanmış / özkaynak | Ort. gün |
|---|---|---:|---|---:|---:|---|---:|---:|
| Geliştirme | opening-breakout | 109 | %34.9 [%26.6 … %44.2] | 26.49 / -21.40 | -512.90 | -4.71 [-8.96 … -0.22] | 693.54 / 712.56 | -6.18 |
| Geliştirme | opening-retest | 32 | %37.5 [%22.9 … %54.7] | 27.24 / -22.31 | -119.27 | -3.73 [-11.99 … 4.94] | 243.16 / 265.53 | -1.44 |
| Doğrulama | opening-breakout | 92 | %33.7 [%24.9 … %43.8] | 27.04 / -21.02 | -443.88 | -4.82 [-9.23 … -0.04] | 523.10 / 554.20 | -6.53 |
| Doğrulama | opening-retest | 23 | %52.2 [%33.0 … %70.8] | 27.01 / -22.60 | 75.56 | 3.29 [-7.28 … 14.09] | 99.73 / 132.51 | 1.11 |
| Ayrılmış test | opening-breakout | 11 | %36.4 [%15.2 … %64.6] | 22.87 / -23.61 | -73.79 | -6.71 [-18.85 … 7.77] | 116.04 / 127.71 | -9.22 |
| Ayrılmış test | opening-retest | 2 | %0.0 [%0.0 … %65.8] | — / -19.36 | -38.72 | -19.36 [-21.00 … -17.72] | 38.72 / 38.72 | -4.84 |

Özkaynak düşüşü, daha önce gözlenen kapanış özkaynağı tepesinden modelin mum içi diplerine ölçülür. Gerçek tik bazlı düşüş farklı olabilir.

## Ayrılmış testte günlük performans ve yol duyarlılığı

| Varyant | Pozitif / negatif / sıfır gün | Alt medyan | En kötü / en iyi gün | En az 100 $ gün | Açık pozisyonda veri boşluğu | Net: yüksek önce / düşük önce / ihtiyatlı |
|---|---:|---:|---:|---:|---:|---:|
| opening-breakout | 3 / 5 / 0 | -22.26 | -48.42 / 30.90 | 0 | 0 | -73.79 / -73.79 / -73.79 |
| opening-retest | 0 / 2 / 6 | 0.00 | -21.00 / 0.00 | 0 | 0 | -38.72 / -38.72 / -38.72 |

## FTM Infinity Plus, 5.000 $

Aynı dönemdeki tam ve çakışmayan 5 ve 20 uygun gün pencereleri. Hücre sırası geçti / ihlal / açık kaldı. Pencere sonunda açık kalan hesap sağdan sansürlüdür. Bir strateji için 5 ve 20 günlük gruplar aynı tarihlere dayanabilir. Hesap durumu ilk hedefte veya ihlalde kesilir. Son bakiye, tarih ve ihlal türü JSON işlem dosyasındadır.

| Dönem | Varyant | İhtiyatlı 5 gün | İhtiyatlı 20 gün | Yüksek önce 5 / 20 gün | Düşük önce 5 / 20 gün |
|---|---|---:|---:|---|---|
| Geliştirme | opening-breakout | 0/0/16 | 0/1/3 | 0/0/16 · 0/1/3 | 0/0/16 · 0/1/3 |
| Geliştirme | opening-retest | 0/0/16 | 0/0/4 | 0/0/16 · 0/0/4 | 0/0/16 · 0/0/4 |
| Doğrulama | opening-breakout | 0/0/13 | 0/1/2 | 0/0/13 · 0/1/2 | 0/0/13 · 0/1/2 |
| Doğrulama | opening-retest | 0/0/13 | 0/0/3 | 0/0/13 · 0/0/3 | 0/0/13 · 0/0/3 |
| Ayrılmış test | opening-breakout | 0/0/1 | 0/0/0 | 0/0/1 · 0/0/0 | 0/0/1 · 0/0/0 |
| Ayrılmış test | opening-retest | 0/0/1 | 0/0/0 | 0/0/1 · 0/0/0 | 0/0/1 · 0/0/0 |

## İşlem denetimi

Birincil varyantta 4 kazanç, 7 kayıp ve 0 başa baş işlem. Aşağıdaki örnekler kronolojik ilk kâr ve ilk zarardır. Giriş kararında kullanılan bağlam ve sinyal zamanı JSON işlem kaydındadır.

| Açılış UTC | Yön ve lot | Giriş / SL / TP | Çıkış, neden | Net |
|---|---|---:|---|---:|
| 2026-10-19 07:42 | short · 0.05 | 4181.70 / 4185.72 / 4175.69 | 4175.69 · tp | 27.99 |
| 2026-10-22 07:37 | short · 0.06 | 4088.57 / 4091.87 / 4083.61 | 4091.87 · sl | -22.26 |

Pozisyon defteri günlük net sonucu, kaldıraç altında atlanan girişleri, açılış ve çıkış fiyatlarını içerir. Grafikte sonradan görülen fiyat yolu girişte bilinen bir koşul veya nedensellik kanıtı sayılmaz.

## Tekrar üretim

Proje kökünde, önbellek hazırken

```powershell
node scripts/research/run.mjs opening development
node scripts/research/run.mjs opening validation
node scripts/research/run.mjs opening test
```

- [Geliştirme işlem ve hesap defteri](../../analysis/research-opening-development.json)
- [Doğrulama işlem ve hesap defteri](../../analysis/research-opening-validation.json)
- [Ayrılmış test işlem ve hesap defteri](../../analysis/research-opening-test.json)
