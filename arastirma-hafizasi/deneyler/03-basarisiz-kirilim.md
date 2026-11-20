# 03 · Başarısız kırılım ve geri dönüş

**Karar.** Son 60 dakikanın aralığına aynı mumda geri dönen birincil varyant, dört test gününde 29 işlemde −29,18 $ verdi. Üç mum içinde ek teyit arayan varyant 14 işlemde +32,77 $ verdi. Teyitli varyant geliştirme ve doğrulamada zarardaydı. Ayrılmış örnekteki +2,34 $/işlemin gün kümeli aralığı −12,73 $ ile +9,02 $ arasında ve dört günle hesaplandı. Uygulamaya ekleme için kanıt yetersiz.

İki varyant aynı geriye dönük 60 M1 fiyat kanalını ve taranan fiyatın ötesindeki stopu kullanır. Birincil varyantın 108,97 $ kazandığı tek gün, diğer üç negatif günü telafi etmedi. Teyitli varyantın işlem sayısı ve giriş saati farklıdır. Sonuç, teyidin tek başına avantaj sağladığını göstermez. [Sayısal protokol](03-basarisiz-kirilim-protokol.md) · [Kural kilidi](03-basarisiz-kirilim-kural-kilidi.json)

3 Kasım, test başlangıcından önce yerel önbellekte bulunduğu için çıkarıldı. Dört günle tam bir 5 veya 20 günlük FTM test penceresi oluşmadı. Bu sürelerdeki hesap değerlendirmeleri eski dönemlere aittir. Küçük örnekte mum yolları aynı parasal sonuca ulaştı. Değişken spread ve ek kayma ölçülmedi.

```powershell
& ./scripts/research/fetch-dukascopy.ps1 -From 2026-11-02 -To 2026-11-09 -Exclude 2026-11-03
```

Geliştirme ve doğrulama verisini [[01-fibonacci]] dosyasındaki komutlar getirir.

## Veri

| Dönem | UTC, bitiş hariç | Uygun / aday gün | Kapsam dışı | Kabul edilen günlerde eksik M1 |
|---|---|---:|---|---:|
| Geliştirme | 2026-01-05 – 2026-05-01 | 83/84 | 2026-04-03 (720 eksik) | 1 |
| Doğrulama | 2026-05-04 – 2026-08-08 | 68/70 | 2026-06-19 (121 eksik), 2026-07-03 (121 eksik) | 31 |
| Ayrılmış test | 2026-11-02 – 2026-11-09 | 4/4 | 2026-11-03 | 0 |

Dukascopy XAU/USD bid M1. Sıfır hacimli dolgu için kullanılan düz mumlar alınmadı. Bütün işlemler M1; kapanış sinyali bir sonraki bitişik M1 açılışında uygulanır. Kaynak önbellek SHA-256 değeri ve tarih kapsamı her JSON dosyasında bulunur. [Dukascopy veri kaynağı](https://www.dukascopy.com/api/data/get/historical-data-export)

## Net işlem istatistikleri

Tablo bar başına ihtiyatlı yolu kullanır. Tüm tutarlar USD. Net istatistiklerin hesabı, FTM’de ilk ihlalde kapanan hesap pencerelerinden ayrı yürütülür. Wilson aralığı işlem bağımsızlığı varsayan betimsel bir aralıktır. Beklenti aralığı 2.000 gün-kümeli bootstrap tekrarına dayanır ve günler arasındaki seri bağımlılığı kapsamaz.

| Dönem | Varyant | n | Kazanma [Wilson %95] | Ort. kazanç / kayıp | Net | Beklenti [%95] | Düşüş, kapanmış / özkaynak | Ort. gün |
|---|---|---:|---|---:|---:|---|---:|---:|
| Geliştirme | reentry | 533 | %36.4 [%32.4 … %40.6] | 22.91 / -19.97 | -2326.85 | -4.37 [-6.19 … -2.66] | 2329.47 / 2333.79 | -28.03 |
| Geliştirme | reentry-confirm | 239 | %40.2 [%34.2 … %46.5] | 26.94 / -21.11 | -432.13 | -1.81 [-5.15 … 1.62] | 930.61 / 956.85 | -5.21 |
| Doğrulama | reentry | 447 | %38.3 [%33.9 … %42.8] | 24.69 / -21.34 | -1667.05 | -3.73 [-5.98 … -1.59] | 1798.57 / 1810.13 | -24.52 |
| Doğrulama | reentry-confirm | 190 | %34.2 [%27.8 … %41.2] | 28.15 / -21.85 | -901.46 | -4.74 [-7.72 … -1.57] | 938.70 / 967.17 | -13.26 |
| Ayrılmış test | reentry | 29 | %44.8 [%28.4 … %62.5] | 24.77 / -21.95 | -29.18 | -1.01 [-10.76 … 7.78] | 108.38 / 123.46 | -7.29 |
| Ayrılmış test | reentry-confirm | 14 | %50.0 [%26.8 … %73.2] | 27.57 / -22.89 | 32.77 | 2.34 [-12.73 … 9.02] | 58.90 / 79.33 | 8.19 |

Özkaynak düşüşü, daha önce gözlenen kapanış özkaynağı tepesinden modelin mum içi diplerine ölçülür. Gerçek tik bazlı düşüş farklı olabilir.

## Ayrılmış testte günlük performans ve yol duyarlılığı

| Varyant | Pozitif / negatif / sıfır gün | Alt medyan | En kötü / en iyi gün | En az 100 $ gün | Açık pozisyonda veri boşluğu | Net: yüksek önce / düşük önce / ihtiyatlı |
|---|---:|---:|---:|---:|---:|---:|
| reentry | 1 / 3 / 0 | -54.71 | -83.25 / 108.97 | 1 | 0 | -29.18 / -29.18 / -29.18 |
| reentry-confirm | 2 / 2 / 0 | -12.00 | -21.97 / 64.46 | 0 | 0 | 32.77 / 32.77 / 32.77 |

## FTM Infinity Plus, 5.000 $

Aynı dönemdeki tam ve çakışmayan 5 ve 20 uygun gün pencereleri. Hücre sırası geçti / ihlal / açık kaldı. Pencere sonunda açık kalan hesap sağdan sansürlüdür. Bir strateji için 5 ve 20 günlük gruplar aynı tarihlere dayanabilir. Hesap durumu ilk hedefte veya ihlalde kesilir. Son bakiye, tarih ve ihlal türü JSON işlem dosyasındadır.

| Dönem | Varyant | İhtiyatlı 5 gün | İhtiyatlı 20 gün | Yüksek önce 5 / 20 gün | Düşük önce 5 / 20 gün |
|---|---|---:|---:|---|---|
| Geliştirme | reentry | 0/4/12 | 0/4/0 | 0/4/12 · 0/4/0 | 0/4/12 · 0/4/0 |
| Geliştirme | reentry-confirm | 0/0/16 | 0/2/2 | 0/0/16 · 0/2/2 | 0/0/16 · 0/2/2 |
| Doğrulama | reentry | 0/4/9 | 0/3/0 | 0/3/10 · 0/3/0 | 0/4/9 · 0/3/0 |
| Doğrulama | reentry-confirm | 0/0/13 | 0/0/3 | 0/0/13 · 0/0/3 | 0/0/13 · 0/0/3 |
| Ayrılmış test | reentry | 0/0/0 | 0/0/0 | 0/0/0 · 0/0/0 | 0/0/0 · 0/0/0 |
| Ayrılmış test | reentry-confirm | 0/0/0 | 0/0/0 | 0/0/0 · 0/0/0 | 0/0/0 · 0/0/0 |

## İşlem denetimi

Birincil varyantta 13 kazanç, 16 kayıp ve 0 başa baş işlem. Aşağıdaki örnekler kronolojik ilk kâr ve ilk zarardır. Giriş kararında kullanılan bağlam ve sinyal zamanı JSON işlem kaydındadır.

| Açılış UTC | Yön ve lot | Giriş / SL / TP | Çıkış, neden | Net |
|---|---|---:|---|---:|
| 2026-11-02 08:12 | long · 0.12 | 3897.34 / 3896.04 / 3899.28 | 3896.04 · sl | -20.24 |
| 2026-11-02 08:51 | short · 0.10 | 3904.22 / 3906.15 / 3901.31 | 3901.31 · tp | 25.19 |

Pozisyon defteri günlük net sonucu, kaldıraç altında atlanan girişleri, açılış ve çıkış fiyatlarını içerir. Grafikte sonradan görülen fiyat yolu girişte bilinen bir koşul veya nedensellik kanıtı sayılmaz.

## Tekrar üretim

Proje kökünde, önbellek hazırken

```powershell
node scripts/research/run.mjs failed development
node scripts/research/run.mjs failed validation
node scripts/research/run.mjs failed test
```

- [Geliştirme işlem ve hesap defteri](../../analysis/research-failed-development.json)
- [Doğrulama işlem ve hesap defteri](../../analysis/research-failed-validation.json)
- [Ayrılmış test işlem ve hesap defteri](../../analysis/research-failed-test.json)

Teyitli kurulum daha uzun bir ileri örnekte pozitif beklenti ve kabul edilebilir düşüş gösterirse, S2C'de kapanmış M1 sinyalini üreten isteğe bağlı bir araştırma işareti olarak eklenebilir. Kabul ölçütü, sıradaki açılışta oluşan giriş ve stop seviyelerinin kilitli deneyle aynı olmasıdır.
