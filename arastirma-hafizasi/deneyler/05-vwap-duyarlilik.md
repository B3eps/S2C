# 05 · VWAP nasıl çalışıyor ve hangi ayara duyarlı?

**Sonuç.** 201 uygun günde baz kural 330 işlemde %38,8 kazandı. Net −1.807,35 $, işlem başına −5,48 $. Gün kümeli %95 beklenti aralığı −7,52 $ ile −3,33 $. Bazın 9–18 Kasım 2026'daki +30,18 $ sonucu tek bir güne duyarlı. 17 Kasım'ın +38,68 $ katkısı çıkarıldığında kalan yedi gün −8,50 $. Bileşik sonuçları pozitif olan bir ayar çıkmadı.

## Gösterge ve strateji

VWAP, hacim ağırlıklı ortalama fiyat. M1 araştırmasında her mum için (yüksek + düşük + kapanış)/3 hesaplanıp Dukascopy bid hacim alanıyla çarpılır. Seans içindeki bu toplam, hacim toplamına bölünür. Aynı ölçekte 4.000 $ fiyata 1 birim, 4.010 $ fiyata 3 birim ağırlık verilirse ortalama 4.007,50 $ olur. VWAP'ın yerleşik kullanımı gerçekleşen işlemlerin fiyatını bir referansla kıyaslamaktır. Burada sınanan geri dönüş hipotezi ayrı bir işlem kuralıdır. Dukascopy, hacmi ilgili dönemin en iyi alış veya satış kotasyon hacimlerinin toplamı olarak açıklar. Bu değer spot altının küresel işlem hacmini temsil etmez. [VWAP’ın işlem maliyeti ölçümündeki kullanımı](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1988.tb02591.x) · [Dukascopy hacim tanımı](https://www.dukascopy.ch/swiss/english/about/faq/#faqJForexTradingPlatform)

S2C'nin hazır günlük VWAP göstergesi 17:00 New York işlem günü sınırını kullanır. Araştırma çizgisi 07:00 UTC'de sıfırlanır ve 08:00–16:00 UTC kapanışlarında sinyal arar. Bu saatler çalışmanın karşılaştırılabilir bir seans tanımıdır. 08:00 UTC alternatifi test edildi. S2C'nin günlük 17:00 New York çizgisiyle ayrı işlem deneyi yapılmadı. [S2C gösterge tanımı](../../src/lib/indicators.ts)

| Çizgi veya kural | Girişteki görevi ve sınanan varsayım |
|---|---|
| Dinamik VWAP | Birikimli fiyat referansı. Tek mumun uçlarına göre daha yavaş değişir. Eşit ağırlıklı kontrol, hacim girdisinin sonuçlara etkisini sınar. |
| Kesik VWAP | Sinyal mumu başlamadan önceki referans. Mumun kendisi ortalamayı kaydırsa bile sınama çizgisi sabit kalır. |
| 2 ATR dış çizgisi | Long fitili bu çizginin altına, short fitili üstüne geçer. Son 20 tamamlanmış gerçek aralık, o andaki fiyat hareketi ölçeğini verir. 2 katsayısı bir oynaklık eşiğidir. |
| 1–1,5 ATR kapanış bandı | Dışarı taşmadan sonra kapanış merkeze yaklaşmalı ve hedef için alan bırakmalı. Aynı mumda iki dış çizgiye temas edildiğinde sinyal atlanır. |
| Sinyal gövdesi | Long'da kapanış açılış üstünde, short'ta altında. Kapanış bandının üstüne ek bir yön teyidi olarak düşünüldü. Filtresiz koşu bu varsayımı sınar. |
| Kırmızı stop | Long'da sinyal dibinin, short'ta tepesinin 0,25 ATR ötesinde. Fikri geçersiz kılan uç fiyatın ötesinde küçük bir tampon bırakır. 0,10 ve 0,40 ATR karşılaştırıldı. |
| Yeşil hedef | Sonraki açılıştaki brüt stop mesafesinin 1,25 katı. Sabit oran, çıkış yapısını karşılaştırılabilir kılar. Fiyat açılışta değiştiğinde bu hedef VWAP'ın ötesinde kalabilir. Sabit VWAP çıkışı ayrıca sınandı. |
| Dikey gri çizgi | Giriş için sonraki M1 açılışı kullanılır. Grafik sinyal mumundaki bilginin emir fiyatıyla karıştırılmasını önler. Üçgen giriş fiyatını, X çıkış mumunu gösterir. X işareti mum içi sıralamayı belirlemez. |
| Eğim ve bekleme | Yatay varyant, 15 dakikada en çok 0,50 ATR değişen merkezi arar. 30 dakikalık bekleme aynı rejimde art arda sinyalleri azaltmaya çalışır. İkisi de ayrı ayrı değiştirildi. |
| Seans sonu ve lot | Tek pozisyon, en çok 120 dakika taşıma. Saat 19:00 UTC civarında ilk gözlenen açılışta kapanış. Stop ve komisyon dahil en çok 25 $ planlanan risk, 10× kaldıraç ve 0,01 lot adımı. Boşlukta gerçekleşen risk planı aşabilir. |

Geometri kuralı nominal bandın bir bölümünü eliyor. VWAP'a kapanış mesafesi d, dış fitilin uzaklığı w ve stop tamponu p, ATR cinsinden olsun. Kapanıştan stopa mesafe w + p − d. Baz kural d ≥ 1,25 × (w + p − d) istediği için w ≥ 2 ve p = 0,25 iken **d en az 1,25 ATR**. Bu nedenle 1 ATR alt sınırını 0,75'e indirmek tam olarak aynı sinyalleri ve işlemleri verdi. 2,2 ATR taşma şartı etkin alt sınırı yaklaşık 1,36 ATR'ye yükseltiyor. Bu değişiklik hem taşmayı büyütüyor hem de 1,5 ATR'ye kadar kalan kapanış alanını daraltıyor.

![İki M1 simülasyon işlemi ve VWAP çizgileri](../../analysis/research-vwap-cizgiler.png)

İlk zararda 9 Kasım 09:22 UTC açılışından sonra stop, ilk kârda 13 Kasım 08:12 UTC açılışından sonra hedef gerçekleşti. İkisi de aynı kurallardan geçti. İlk örneğin hedefi sabit VWAP'ın üstündeydi, ikincisininki hemen altındaydı. Çizgiler bu farkı görünür kılıyor.

## Mekanizma testi

| Bazın dönemi | İşlem | 30 dk içinde ilk referansa temas | 5 / 15 / 30 dk ortalama yönlü bid değişimi, giriş ATR'si |
|---|---:|---:|---:|
| 5 Ocak–1 Mayıs | 159 | 105/159 | −0,05 / −0,14 / +0,24 |
| 4 Mayıs–8 Ağustos | 98 | 64/98 | −0,06 / −0,88 / −0,74 |
| 7 Eylül–9 Kasım | 63 | 39/63 | −0,01 / −0,35 / −0,74 |
| 9–19 Kasım | 10 | 9/10 | +0,23 / +1,10 / +1,59 |
| Birleşik | 330 | 217/330 | −0,04 / −0,36 / −0,20 |

Tarihler UTC ve sağ uç hariç. 30 dakikalık temas, bir mum ucunun sabit referansı görmesidir. Stop çıktıktan sonra da olabilir. 330 işlemin 167'sinde 1,25 R hedefi çizginin ötesindeydi. Birleşik defterde 128 hedef ve 202 stop oluştu. Dolayısıyla sık temas, işlemin önce hedefe ulaşacağını göstermez. 9–18 Kasım'da altı hedef toplam +123,94 $, dört stop −93,76 $ üretti. Net kârın tamamı long işlemlerden geldi (+40,81 $), short işlemler toplam −10,63 $ verdi. Bu dönemin yönlü getirileri diğer bölümlerden daha güçlüydü. Fiyatın neden geri döndüğünü veya hareketi VWAP'ın tetiklediğini bu gözlemlerden çıkaramayız.

Aynı saatlerde yön ve stop tarafı ters çevrilince birleşik işlem başına sonuç −3,30 $, bazda −5,48 $. Son sekiz günde ise ters yön −14,30 $/işlem. Kontrolün de net zararı var. Bu yön değişiminin faydası döneme bağlıydı ve ters stratejinin kârlılığına kanıt vermedi.

## Ayar duyarlılığı

Aşağıdaki hücreler **işlem sayısı / maliyet sonrası işlem başına USD** biçiminde. Tek seferde bir değişiklik yapıldı. Geometri koşulunu kaldırınca daha çok sinyal geldi ve birleşik dolar zararı −3.658,74 $'a çıktı. 2,2 ATR'nin son dönemdeki +22,67 $ ortalaması yalnız üç işleme dayanıyor. Hedefi doğrudan sabit VWAP'a koymak da birleşik sonucu pozitife çevirmedi.

| Ayar | Geliştirme | Doğrulama | Önceki strateji dönemleri | Eski VWAP testi | Birleşik |
|---|---:|---:|---:|---:|---:|
| original | 159 / −6,26 | 98 / −7,74 | 63 / −3,51 | 10 / 3,02 | 330 / −5,48 |
| equal-weight | 134 / −6,37 | 90 / −7,10 | 62 / −4,26 | 10 / −19,63 | 296 / −6,02 |
| anchor-0800 | 151 / −5,95 | 95 / −5,22 | 74 / −5,81 | 13 / 2,53 | 333 / −5,02 |
| atr-10 | 143 / −6,46 | 99 / −6,99 | 64 / −1,57 | 11 / 1,59 | 317 / −5,04 |
| atr-40 | 134 / −6,34 | 98 / −8,97 | 65 / −3,17 | 6 / −7,87 | 303 / −6,09 |
| outer-1.8 | 266 / −6,50 | 176 / −6,90 | 111 / −3,94 | 20 / −1,09 | 573 / −4,95 |
| outer-2.2 | 52 / −6,09 | 31 / −3,28 | 25 / −1,70 | 3 / 22,67 | 111 / −3,45 |
| inner-0.75 | 159 / −6,26 | 98 / −7,74 | 63 / −3,51 | 10 / 3,02 | 330 / −5,48 |
| no-body-filter | 182 / −6,07 | 110 / −7,00 | 75 / −3,59 | 11 / 4,11 | 378 / −5,10 |
| slope-0.50 | 148 / −5,73 | 95 / −7,31 | 61 / −3,69 | 10 / 3,02 | 314 / −5,19 |
| slope-0.25 | 118 / −6,56 | 82 / −8,10 | 53 / −3,93 | 9 / 1,14 | 262 / −5,80 |
| stop-0.10 | 212 / −3,75 | 146 / −7,37 | 91 / −2,69 | 13 / 0,68 | 462 / −4,04 |
| stop-0.40 | 81 / −5,47 | 51 / −10,38 | 33 / −1,62 | 6 / 5,87 | 171 / −5,69 |
| cooldown-0 | 188 / −4,88 | 111 / −7,52 | 72 / −3,13 | 10 / 3,02 | 381 / −4,71 |
| target-1.00R | 159 / −6,39 | 98 / −6,72 | 63 / −3,11 | 10 / 0,13 | 330 / −5,18 |
| target-1.50R | 159 / −6,44 | 98 / −7,60 | 63 / −2,74 | 10 / 5,91 | 330 / −5,31 |
| fixed-vwap-target | 159 / −7,00 | 98 / −6,77 | 63 / −1,57 | 10 / 3,88 | 330 / −5,14 |
| no-geometry-gate | 399 / −4,87 | 281 / −6,40 | 170 / −4,28 | 28 / −4,24 | 878 / −4,17 |
| spread-0.40 | 159 / −7,14 | 98 / −8,25 | 63 / −4,88 | 10 / 3,45 | 330 / −6,16 |
| spread-0.60 | 159 / −8,18 | 98 / −9,37 | 63 / −5,38 | 10 / 3,94 | 330 / −6,95 |
| reverse-direction | 159 / −1,18 | 98 / −3,93 | 63 / −6,13 | 10 / −14,30 | 330 / −3,30 |

Daha geniş sabit spread ile tam yeniden oynatmada birleşik beklenti −6,16 $ ve −6,95 $/işlem oldu. Tekrar oynatma lotu ve hedef seviyesini yeniden hesapladığı için kısa bölümde daha geniş spread bazen daha yüksek net sonuç verdi. **Aynı işlemlerin lot ve bid çıkış zamanını dondurunca**, o kısa bölüm 0,40 $ spread ile +11,78 $, 0,60 $ ile −6,62 $. Bu, fiyat yolunun değişmediği mekanik maliyet karşılaştırması.

## Doğrulama ve tekrar üretim

- Arşivli üç VWAP döneminin işlem ve hesap sonuçları, üç OHLC yolunda yeniden üretildi. 319 önek kontrolünde sonraki mumlar çıkarılınca daha önce bilinen sinyaller aynı kaldı. Sabit VWAP hedefi, her gerçekleşen işlemde long bid ve short ask kotasyonuna çevrilerek ayrıca doğrulandı.
- Dönemler 83 + 68 + 42 + 8 uygun gün. 20–21 Ekim ve 3 Kasım önceki dönem kaydından devralınan kapsam dışı günler. Tüm tarih grupları bu takip çalışmasında keşif verisi. Aynı sonuç tablosundan bir ayar seçip bu tabloyu seçim sonrası kanıt olarak kullanamayız.
- Eski test sonucunu açıklayan en güçlü gözlem sekiz gündeki daha sık ve daha hızlı fiyat dönüşü. Tek bir bileşenin nedensel katkısını ayırmak için bağımsız ileri veri gerekir. 20 Kasım 2026–1 Şubat 2027 UTC aralığı aday olarak ayrıldı. Bu ileri bölüm çalıştırılmadı. Uygulama değişiklikleri bu araştırmanın kapsamı dışında.

```powershell
node scripts/research/vwap-sensitivity.mjs --chart-data
# Matplotlib mevcutsa
python scripts/research/plot-vwap.py
```

[Deney protokolü](05-vwap-duyarlilik-protokol.md) · [Ayrıntılı JSON sonuçları](../../analysis/research-vwap-sensitivity.json) · [Çizgi grafiği](../../analysis/research-vwap-cizgiler.png)
