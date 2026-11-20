# Parça sinyal denetimi

Üretildi: 2026-11-13T04:29 UTC · veri: Dukascopy XAU/USD bid · spread 0.2 $ · hedef 1R (aksi belirtilmedikçe) · aynı dakikada stop önce sayılır · her sinyal kapanıştan sonraki ilk dakikadan 240 dk izlendi.

**Dönemler.** TRAIN: olasılık modelinin kurulduğu dönemler (1). TEST: ön ayarları seçerken defalarca bakılan dönemler (1); tam temiz değil. **FRESH: hiçbir seçimde kullanılmamış 1 dönem; gerçek sınav bu.** Her hücre: sinyal sayısı · kazanma oranı · ortalama R ± %95 güven aralığı. Güven aralığı 0'ı kapsıyorsa sonuç şans olabilir.

## 1. Veri gerçek mi?

| Kontrol | Sonuç |
|---|---|
| Toplam 1dk mum | 68605 |
| Geçersiz OHLC (high<low vb.) | 0 |
| Tekrarlı / geri giden zaman | 0 / 0 |
| Piyasa açıkken delik (dakika) | 12 delik, 27 dk |
| Bir dakikada %0,5+ fiyat sıçraması | 1: 2025-04-22T22:00 |
| Tek fiyatlı (h=l) mum | 18 |
| 1100 dakikadan kısa işlem günü | yok |
| Önbellek ↔ Dukascopy'den taze indirme (2 gün) | 0 farklı mum, 0 eksik, 0 fazla |
| Dukascopy'nin kendi 5m mumu ↔ 1dk'dan kurulan | 6594 mumdan 0 fark |
| Dukascopy'nin kendi 15m mumu ↔ 1dk'dan kurulan | 2198 mumdan 0 fark |
| Dukascopy'nin kendi 1h mumu ↔ 1dk'dan kurulan | 550 mumdan 0 fark |
| Bağımsız kaynak: COMEX altın vadeli (Yahoo GC=F) günlük değişim ↔ bizim | 141 gün: korelasyon 0.9154, günlük % değişimde ortanca fark %0.24, en büyük %2.05 (vadeli-spot farkı ortanca 11.3 $) |

**Replay ↔ analiz:** Replay 2025-02-11 → 2025-02-12, 1380 dakika adımı: canlıda görülen 2 sinyal, sonradan hesaplanan 0. Sonradan kaybolan: 0, canlıda hiç görülmeyen: 0, mum kapanmadan çıkan: 0, giriş/stop değişen: 0. → AYNI: replayde gördüğün sinyal, analizdeki sinyalin aynısı.

Not: Kaynak Dukascopy'nin kendi verisi; aracına/prop firmaya göre birkaç sent-dolar fark olabilir. Bağımsız kaynak satırı varsa günlük kapanışları ayrı bir sağlayıcıyla karşılaştırır.

## 2. Gold 5dk

| Küme | Sinyal/gün | Sinyal | Kazanma (1R) | Ort. R | %95 aralık | 2R hedefte ort. R |
|---|---|---|---|---|---|---|
| TRAIN | 1,4 | 30 | 63% | 0,28 | -0,03 … 0,58 | 0,42 |
| TEST | 1,0 | 14 | 57% | 0,09 | -0,42 … 0,61 | 0,13 |
| FRESH | 0,8 | 5 | 60% | 0,08 | -0,72 … 0,88 | -0,22 |

**Dönem dönem** (tutarlılık için):

| Küme | Dönem | n | Kazanma | Ort. R |
|---|---|---|---|---|
| train | 2024-05-13:2024-06-14 | 30 | 63% | 0,28 |
| test | 2025-04-07:2025-04-30 | 14 | 57% | 0,09 |
| fresh | 2025-02-10:2025-02-22 | 5 | 60% | 0,08 |

**Kaybedenlerin yapısı** (19 kayıp / 49 sinyal): stop'a nasıl gitti?

| Tür | adet · pay |  |  |  |
|---|---|---|---|---|
| yavaş stop | 10 · 53% |  |  |  |
| döndü (0,5R+ gördü) | 6 · 32% |  |  |  |
| hemen stop (≤30 dk) | 3 · 16% |  |  |  |

- "döndü": fiyat önce en az +0,5R gitti sonra stop oldu (kar alma/kısmi çıkış fırsatı vardı).
- "hemen stop": 30 dakika içinde, hiç lehine gitmeden.

Kaybedenlerin ortalama en iyi anı: +0,37R; kazananların stop'a en yakın anı: −0,55R. Ortalama çözülme süresi: kazanan 98 dk, kaybeden 89 dk.

### Onaylar: kaç şey birden varsa sonuç değişiyor mu?

Onay sayısı = {engulf+MSP birlikte, aynı gün likidite süpürmesi, 15dk EMA50 yönü, 3'ü de aynı bias, ADX≥25, oynaklık≥1,2, 1sa/4sa bölge}.

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 1 | 1 · 0% · -1,00R ±0,00 | – | 1 · 0% · -1,00R ±0,00 | – |
| 2 | 2 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – |
| 3 | 19 · 42% · -0,14R ±0,42 | 7 · 29% · -0,33R ±0,70 | 10 · 50% · -0,07R ±0,60 | 2 · 50% · 0,18R ±1,60 |
| 4 | 17 · 76% · 0,57R ±0,39 | 13 · 77% · 0,59R ±0,43 | 2 · 100% · 1,00R ±0,00 | 2 · 50% · 0,00R ±1,96 |
| 5+ | 10 · 70% · 0,20R ±0,42 | 9 · 67% · 0,22R ±0,47 | – | 1 · 100% · 0,03R ±0,00 |

### Destek / direnç: sinyal önemli bir seviyede miydi?

Seviye listesi: önceki gün tepe/dip, önceki hafta tepe/dip, Asya ve Londra aralığı, son 4sa salınımlar, 100/50'lik yuvarlak sayılar. "Seviyede" = koruyucu tarafta 0,75 ATR içinde seviye var (long için altında destek, short için üstünde direnç). "Önünde" = işlem yönündeki en yakın seviyeye mesafe (R).

**Giriş seviyede mi?**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| seviyede (100'lük) | 2 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – |
| seviyede (4sa dip) | 5 · 40% · 0,19R ±0,65 | 5 · 40% · 0,19R ±0,65 | – | – |
| seviyede (4sa tepe) | 2 · 0% · -0,66R ±0,67 | 2 · 0% · -0,66R ±0,67 | – | – |
| seviyede (Asya) | 3 · 100% · 0,69R ±0,61 | 2 · 100% · 0,53R ±0,91 | 1 · 100% · 1,00R ±0,00 | – |
| seviyede (Londra) | 6 · 67% · 0,33R ±0,83 | 5 · 80% · 0,60R ±0,78 | 1 · 0% · -1,00R ±0,00 | – |
| seviyede (önceki hafta) | 1 · 100% · 0,02R ±0,00 | – | 1 · 100% · 0,02R ±0,00 | – |
| seviyede değil | 30 · 60% · 0,14R ±0,34 | 15 · 67% · 0,24R ±0,48 | 10 · 50% · 0,03R ±0,64 | 5 · 60% · 0,08R ±0,80 |

**Seviye türüne göre (seviyedeyse):**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 100'lük | 2 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – |
| 4sa dip | 5 · 40% · 0,19R ±0,65 | 5 · 40% · 0,19R ±0,65 | – | – |
| 4sa tepe | 2 · 0% · -0,66R ±0,67 | 2 · 0% · -0,66R ±0,67 | – | – |
| Asya | 3 · 100% · 0,69R ±0,61 | 2 · 100% · 0,53R ±0,91 | 1 · 100% · 1,00R ±0,00 | – |
| Londra | 6 · 67% · 0,33R ±0,83 | 5 · 80% · 0,60R ±0,78 | 1 · 0% · -1,00R ±0,00 | – |
| önceki hafta | 1 · 100% · 0,02R ±0,00 | – | 1 · 100% · 0,02R ±0,00 | – |

**Önündeki ilk seviye ne kadar uzakta?**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| <1R | 35 · 51% · 0,03R ±0,29 | 21 · 52% · 0,06R ±0,37 | 9 · 44% · -0,08R ±0,67 | 5 · 60% · 0,08R ±0,80 |
| 1–2R | 5 · 100% · 1,00R ±0,00 | 4 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – |
| 2–4R | 3 · 67% · 0,33R ±1,31 | 3 · 67% · 0,33R ±1,31 | – | – |
| 4R+/yok | 6 · 83% · 0,50R ±0,67 | 2 · 100% · 1,00R ±0,00 | 4 · 75% · 0,26R ±0,94 | – |

### Kaynak, saat, yön

**Engulf edilen bölge:**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 15dk OB | 6 · 50% · -0,16R ±0,79 | 3 · 67% · 0,02R ±1,13 | 2 · 50% · 0,00R ±1,96 | 1 · 0% · -1,00R ±0,00 |
| 15dk iFVG | 10 · 80% · 0,50R ±0,53 | 5 · 80% · 0,60R ±0,78 | 4 · 75% · 0,50R ±0,98 | 1 · 100% · 0,03R ±0,00 |
| 1sa OB | 1 · 0% · -0,33R ±0,00 | 1 · 0% · -0,33R ±0,00 | – | – |
| 1sa iFVG | 3 · 67% · 0,34R ±0,80 | 3 · 67% · 0,34R ±0,80 | – | – |
| 4sa OB | 2 · 100% · 0,51R ±0,96 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 0,02R ±0,00 | – |
| 4sa iFVG | 4 · 100% · 0,80R ±0,40 | 4 · 100% · 0,80R ±0,40 | – | – |
| OB | 9 · 22% · -0,45R ±0,56 | 5 · 20% · -0,46R ±0,76 | 4 · 25% · -0,42R ±0,94 | – |
| iFVG | 14 · 64% · 0,36R ±0,47 | 8 · 63% · 0,34R ±0,65 | 3 · 67% · 0,33R ±1,31 | 3 · 67% · 0,46R ±1,07 |

**New York saati (kaba):**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 03–06 | 15 · 60% · 0,24R ±0,49 | 9 · 67% · 0,33R ±0,65 | 5 · 60% · 0,26R ±0,89 | 1 · 0% · -0,63R ±0,00 |
| 06–09 | 7 · 57% · -0,07R ±0,69 | 5 · 80% · 0,30R ±0,73 | 2 · 0% · -1,00R ±0,00 | – |
| 09–12 | 11 · 73% · 0,41R ±0,44 | 10 · 70% · 0,45R ±0,48 | 1 · 100% · 0,02R ±0,00 | – |
| 12–16 | 13 · 54% · 0,11R ±0,50 | 5 · 40% · 0,07R ±0,78 | 4 · 50% · 0,00R ±1,13 | 4 · 75% · 0,26R ±0,94 |
| 16–24 | 3 · 67% · 0,33R ±1,31 | 1 · 0% · -1,00R ±0,00 | 2 · 100% · 1,00R ±0,00 | – |

**Yön:**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| long | 25 · 68% · 0,29R ±0,33 | 11 · 64% · 0,26R ±0,48 | 9 · 78% · 0,45R ±0,58 | 5 · 60% · 0,08R ±0,80 |
| short | 24 · 54% · 0,11R ±0,38 | 19 · 63% · 0,29R ±0,41 | 5 · 20% · -0,54R ±0,76 | – |

### Tutarlı sinyal-kalitesi göstergeleri

Bir göstergede "yüksek" ile "düşük" yarı arasındaki kazanma farkı üç kümenin üçünde de aynı yönde ve ≥5 puan ise tutarlı sayıldım. Tutarsızlar büyük olasılıkla geçmişe uydurma.

| Gösterge | TRAIN fark | TEST fark | FRESH fark | Tutarlı mı? |
|---|---|---|---|---|
| ifvg | +35 puan | az veri | az veri | hayır |
| adx ≥ ortanca (27,15) | -33 puan | az veri | az veri | hayır |
| htf | +30 puan | az veri | az veri | hayır |
| riskAtr ≥ ortanca (3,10) | +25 puan | az veri | az veri | hayır |
| swept | +21 puan | az veri | az veri | hayır |
| prob ≥ ortanca (0,52) | +20 puan | az veri | az veri | hayır |
| ext21 ≥ ortanca (1,93) | +17 puan | az veri | az veri | hayır |
| rsi ≥ ortanca (66,25) | +17 puan | az veri | az veri | hayır |
| hour ≥ ortanca (9,00) | -15 puan | az veri | az veri | hayır |
| engulfRatio ≥ ortanca (2,47) | +10 puan | az veri | az veri | hayır |
| aheadR ≥ ortanca (0,47) | +7 puan | az veri | az veri | hayır |
| atLevel | -7 puan | az veri | az veri | hayır |
| vol ≥ ortanca (1,09) | +5 puan | az veri | az veri | hayır |
| slope21 ≥ ortanca (0,53) | +3 puan | az veri | az veri | hayır |
| levelDist ≥ ortanca (1,23) | -3 puan | az veri | az veri | hayır |
| long (short karşısında) | +0 puan | az veri | az veri | hayır |
| double | az veri | az veri | az veri | hayır |
| m15 | az veri | az veri | az veri | hayır |
| bias3 | az veri | az veri | az veri | hayır |
| news60 | az veri | az veri | az veri | hayır |
| strong | az veri | az veri | az veri | hayır |


## 2. Gold A+ 5dk

| Küme | Sinyal/gün | Sinyal | Kazanma (1R) | Ort. R | %95 aralık | 2R hedefte ort. R |
|---|---|---|---|---|---|---|
| TRAIN | 0,8 | 16 | 81% | 0,60 | 0,32 … 0,88 | 0,71 |
| TEST | 0,1 | 2 | 50% | -0,18 | -1,79 … 1,43 | -0,18 |
| FRESH | 0,5 | 3 | 33% | -0,33 | -1,64 … 0,97 | -0,56 |

**Dönem dönem** (tutarlılık için):

| Küme | Dönem | n | Kazanma | Ort. R |
|---|---|---|---|---|
| train | 2024-05-13:2024-06-14 | 16 | 81% | 0,60 |
| test | 2025-04-07:2025-04-30 | 2 | 50% | -0,18 |
| fresh | 2025-02-10:2025-02-22 | 3 | 33% | -0,33 |

**Kaybedenlerin yapısı** (6 kayıp / 21 sinyal): stop'a nasıl gitti?

| Tür | adet · pay |  |  |  |
|---|---|---|---|---|
| döndü (0,5R+ gördü) | 2 · 33% |  |  |  |
| yavaş stop | 3 · 50% |  |  |  |
| hemen stop (≤30 dk) | 1 · 17% |  |  |  |

- "döndü": fiyat önce en az +0,5R gitti sonra stop oldu (kar alma/kısmi çıkış fırsatı vardı).
- "hemen stop": 30 dakika içinde, hiç lehine gitmeden.

Kaybedenlerin ortalama en iyi anı: +0,34R; kazananların stop'a en yakın anı: −0,54R. Ortalama çözülme süresi: kazanan 96 dk, kaybeden 42 dk.

### Onaylar: kaç şey birden varsa sonuç değişiyor mu?

Onay sayısı = {engulf+MSP birlikte, aynı gün likidite süpürmesi, 15dk EMA50 yönü, 3'ü de aynı bias, ADX≥25, oynaklık≥1,2, 1sa/4sa bölge}.

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 3 | 3 · 33% · -0,33R ±1,31 | 1 · 100% · 1,00R ±0,00 | 1 · 0% · -1,00R ±0,00 | 1 · 0% · -1,00R ±0,00 |
| 4 | 10 · 80% · 0,67R ±0,44 | 8 · 88% · 0,84R ±0,32 | – | 2 · 50% · 0,00R ±1,96 |
| 5+ | 8 · 75% · 0,32R ±0,38 | 7 · 71% · 0,28R ±0,42 | 1 · 100% · 0,64R ±0,00 | – |

### Destek / direnç: sinyal önemli bir seviyede miydi?

Seviye listesi: önceki gün tepe/dip, önceki hafta tepe/dip, Asya ve Londra aralığı, son 4sa salınımlar, 100/50'lik yuvarlak sayılar. "Seviyede" = koruyucu tarafta 0,75 ATR içinde seviye var (long için altında destek, short için üstünde direnç). "Önünde" = işlem yönündeki en yakın seviyeye mesafe (R).

**Giriş seviyede mi?**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| seviyede (100'lük) | 2 · 100% · 0,82R ±0,35 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 0,64R ±0,00 | – |
| seviyede (4sa dip) | 4 · 50% · 0,32R ±0,77 | 4 · 50% · 0,32R ±0,77 | – | – |
| seviyede (4sa tepe) | 1 · 0% · -0,32R ±0,00 | 1 · 0% · -0,32R ±0,00 | – | – |
| seviyede (Asya) | 2 · 100% · 0,53R ±0,91 | 2 · 100% · 0,53R ±0,91 | – | – |
| seviyede (Londra) | 2 · 100% · 1,00R ±0,00 | 2 · 100% · 1,00R ±0,00 | – | – |
| seviyede (önceki gün) | 1 · 0% · -1,00R ±0,00 | – | – | 1 · 0% · -1,00R ±0,00 |
| seviyede değil | 9 · 78% · 0,40R ±0,55 | 6 · 100% · 0,77R ±0,29 | 1 · 0% · -1,00R ±0,00 | 2 · 50% · 0,00R ±1,96 |

**Seviye türüne göre (seviyedeyse):**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 100'lük | 2 · 100% · 0,82R ±0,35 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 0,64R ±0,00 | – |
| 4sa dip | 4 · 50% · 0,32R ±0,77 | 4 · 50% · 0,32R ±0,77 | – | – |
| 4sa tepe | 1 · 0% · -0,32R ±0,00 | 1 · 0% · -0,32R ±0,00 | – | – |
| Asya | 2 · 100% · 0,53R ±0,91 | 2 · 100% · 0,53R ±0,91 | – | – |
| Londra | 2 · 100% · 1,00R ±0,00 | 2 · 100% · 1,00R ±0,00 | – | – |
| önceki gün | 1 · 0% · -1,00R ±0,00 | – | – | 1 · 0% · -1,00R ±0,00 |

**Önündeki ilk seviye ne kadar uzakta?**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| <1R | 15 · 60% · 0,17R ±0,41 | 11 · 73% · 0,42R ±0,36 | 1 · 0% · -1,00R ±0,00 | 3 · 33% · -0,33R ±1,31 |
| 1–2R | 4 · 100% · 0,91R ±0,18 | 3 · 100% · 1,00R ±0,00 | 1 · 100% · 0,64R ±0,00 | – |
| 2–4R | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – | – |
| 4R+/yok | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – | – |

### Kaynak, saat, yön

**Engulf edilen bölge:**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 15dk OB | 1 · 100% · 0,07R ±0,00 | 1 · 100% · 0,07R ±0,00 | – | – |
| 15dk iFVG | 2 · 100% · 0,82R ±0,35 | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 0,64R ±0,00 | – |
| 1sa OB | 1 · 0% · -0,33R ±0,00 | 1 · 0% · -0,33R ±0,00 | – | – |
| 1sa iFVG | 2 · 50% · 0,01R ±0,80 | 2 · 50% · 0,01R ±0,80 | – | – |
| 4sa OB | 1 · 100% · 1,00R ±0,00 | 1 · 100% · 1,00R ±0,00 | – | – |
| 4sa iFVG | 4 · 100% · 0,80R ±0,40 | 4 · 100% · 0,80R ±0,40 | – | – |
| OB | 2 · 50% · 0,00R ±1,96 | 1 · 100% · 1,00R ±0,00 | 1 · 0% · -1,00R ±0,00 | – |
| iFVG | 8 · 63% · 0,34R ±0,65 | 5 · 80% · 0,74R ±0,52 | – | 3 · 33% · -0,33R ±1,31 |

**New York saati (kaba):**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| 03–06 | 3 · 100% · 0,88R ±0,23 | 2 · 100% · 1,00R ±0,00 | 1 · 100% · 0,64R ±0,00 | – |
| 06–09 | 4 · 75% · 0,12R ±0,82 | 3 · 100% · 0,50R ±0,53 | 1 · 0% · -1,00R ±0,00 | – |
| 09–12 | 11 · 64% · 0,31R ±0,50 | 9 · 78% · 0,61R ±0,40 | – | 2 · 0% · -1,00R ±0,00 |
| 12–16 | 3 · 67% · 0,56R ±0,86 | 2 · 50% · 0,34R ±1,29 | – | 1 · 100% · 1,00R ±0,00 |

**Yön:**

|  | hepsi (n · kazanma · ort. R ±%95) | TRAIN | TEST | FRESH (temiz) |
|---|---|---|---|---|
| long | 11 · 64% · 0,16R ±0,51 | 6 · 83% · 0,53R ±0,45 | 2 · 50% · -0,18R ±1,61 | 3 · 33% · -0,33R ±1,31 |
| short | 10 · 80% · 0,65R ±0,37 | 10 · 80% · 0,65R ±0,37 | – | – |

### Tutarlı sinyal-kalitesi göstergeleri

Bir göstergede "yüksek" ile "düşük" yarı arasındaki kazanma farkı üç kümenin üçünde de aynı yönde ve ≥5 puan ise tutarlı sayıldım. Tutarsızlar büyük olasılıkla geçmişe uydurma.

| Gösterge | TRAIN fark | TEST fark | FRESH fark | Tutarlı mı? |
|---|---|---|---|---|
| adx ≥ ortanca (31,50) | az veri | az veri | az veri | hayır |
| vol ≥ ortanca (1,68) | az veri | az veri | az veri | hayır |
| slope21 ≥ ortanca (0,53) | az veri | az veri | az veri | hayır |
| ext21 ≥ ortanca (2,24) | az veri | az veri | az veri | hayır |
| rsi ≥ ortanca (66,31) | az veri | az veri | az veri | hayır |
| engulfRatio ≥ ortanca (3,27) | az veri | az veri | az veri | hayır |
| riskAtr ≥ ortanca (2,94) | az veri | az veri | az veri | hayır |
| aheadR ≥ ortanca (0,47) | az veri | az veri | az veri | hayır |
| levelDist ≥ ortanca (0,52) | az veri | az veri | az veri | hayır |
| prob ≥ ortanca (0,64) | az veri | az veri | az veri | hayır |
| hour ≥ ortanca (9,00) | az veri | az veri | az veri | hayır |
| double | az veri | az veri | az veri | hayır |
| swept | az veri | az veri | az veri | hayır |
| htf | az veri | az veri | az veri | hayır |
| ifvg | az veri | az veri | az veri | hayır |
| m15 | az veri | az veri | az veri | hayır |
| bias3 | az veri | az veri | az veri | hayır |
| atLevel | az veri | az veri | az veri | hayır |
| news60 | az veri | az veri | az veri | hayır |
| strong | az veri | az veri | az veri | hayır |
| long (short karşısında) | az veri | az veri | az veri | hayır |


## 4. Dürüst uyarılar

- Bu bir geçmiş testi: 3 dönem, yaklaşık 6 haftalık veri. Küçük örneklerde (n<30) yüzdelere güvenme; güven aralığına bak.
- Spread sabit 0.2 $; haber anı ve seans geçişlerinde gerçek spread çok açılır, kayma yok. Gerçekte sonuçlar biraz daha kötü olur.
- Dukascopy fiyatı senin aracının fiyatı değil; kıl payı stop/hedef vuruşları farklı çıkabilir.
- Çok sayıda ayar denendiğinde bir kısmı şans eseri iyi görünür. Bu yüzden yalnızca FRESH'te ve diğer kümelerde birlikte iyi olanı ciddiye al.
- Hiçbir şey uygulamaya otomatik uygulanmadı; bu rapor sadece ölçüm.

