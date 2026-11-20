# 1 dakika kayıp ve filtre incelemesi

Bu rapor dondurulmuş modelin yeni dönem mum replay sonuçlarını inceler. Tek işlemde neden-sonuç kanıtlanamaz; aşağıdaki sayılar gözlem ve yeni veride sınanacak hipotezlerdir. İşlemden sonra bilinen çıkış veya sonuç bilgisi sinyal girdisi olarak kullanılamaz.

Dönem 2026-07-03–2026-08-11 UTC; spread $0,20, taraf başına %0,005 komisyon, bir sonraki mum açılışında giriş, aynı mumda stop öncelikli, tek açık pozisyon ve 240 mum azami bekleme. Bu ayrı mum araştırmasıdır, S2C hesap replay değildir.

### Gold: 9 kayıp

| Sinyal UTC | Yön / kaynak | Giriş | Stop | Hedef | Çıkış / neden | Net R | Komisyon / risk | En fazla lehine / aleyhine | Haber ±60dk | Skor |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: |
| 2026-07-10T16:01:00.000Z | long / iFVG + MSP ★ | 4113.68 | 4107.84 | 4118.95 | 4107.84 / stop | -1.07 | 0.07R | 0.00R / 1.15R | yok | 0.46 |
| 2026-07-10T20:00:00.000Z | long / 15dk iFVG ★ | 4112.88 | 4103.81 | 4120.80 | 4094.22 / stop | -2.10 | 0.05R | 0.87R / 2.17R | yok | 0.44 |
| 2026-07-15T07:26:00.000Z | short / iFVG + MSP ★ | 4022.63 | 4029.92 | 4015.39 | 4029.92 / stop | -1.06 | 0.06R | 0.72R / 1.03R | yok | 0.44 |
| 2026-07-15T12:58:00.000Z | long / 1sa iFVG + MSP ★ | 4071.00 | 4061.08 | 4080.77 | 4061.08 / stop | -1.04 | 0.04R | 0.28R / 1.02R | yok | 0.46 |
| 2026-07-22T12:20:00.000Z | long / 5dk iFVG + MSP ★ | 4129.22 | 4123.17 | 4135.00 | 4123.17 / stop | -1.07 | 0.07R | 0.82R / 1.24R | yok | 0.41 |
| 2026-07-27T18:39:00.000Z | short / iFVG + MSP ★ | 4073.22 | 4077.17 | 4069.20 | 4077.17 / stop | -1.10 | 0.10R | 0.10R / 1.57R | yok | 0.46 |
| 2026-08-03T10:50:00.000Z | short / iFVG + MSP ★ | 4047.66 | 4052.46 | 4042.47 | 4052.46 / stop | -1.08 | 0.08R | 0.38R / 1.10R | yok | 0.44 |
| 2026-08-05T13:31:00.000Z | long / 5dk iFVG + MSP ★ | 4200.06 | 4190.61 | 4209.12 | 4190.61 / stop | -1.04 | 0.04R | 0.43R / 1.14R | yok | 0.41 |
| 2026-08-05T15:00:00.000Z | long / iFVG + MSP ★ | 4249.05 | 4232.64 | 4265.07 | 4232.64 / stop | -1.03 | 0.03R | 0.97R / 1.04R | yok | 0.46 |

### Eğitimli filtre: 5 kayıp

| Sinyal UTC | Yön / kaynak | Giriş | Stop | Hedef | Çıkış / neden | Net R | Komisyon / risk | En fazla lehine / aleyhine | Haber ±60dk | Skor |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: |
| 2026-07-10T16:01:00.000Z | long / iFVG + MSP ★ | 4113.68 | 4107.84 | 4118.95 | 4107.84 / stop | -1.07 | 0.07R | 0.00R / 1.15R | yok | 0.46 |
| 2026-07-15T12:58:00.000Z | long / 1sa iFVG + MSP ★ | 4071.00 | 4061.08 | 4080.77 | 4061.08 / stop | -1.04 | 0.04R | 0.28R / 1.02R | yok | 0.46 |
| 2026-07-27T18:39:00.000Z | short / iFVG + MSP ★ | 4073.22 | 4077.17 | 4069.20 | 4077.17 / stop | -1.10 | 0.10R | 0.10R / 1.57R | yok | 0.46 |
| 2026-08-05T15:00:00.000Z | long / iFVG + MSP ★ | 4249.05 | 4232.64 | 4265.07 | 4232.64 / stop | -1.03 | 0.03R | 0.97R / 1.04R | yok | 0.46 |
| 2026-08-10T17:37:00.000Z | long / iFVG + MSP ★ | 4363.35 | 4358.49 | 4367.94 | 4358.49 / stop | -1.09 | 0.09R | 0.38R / 1.15R | yok | 0.47 |

## Filtre neleri dışarıda bıraktı?

Gold replay'inde alınmış 14 işlem model eşiğinin altındaydı: 9 kârlı, 5 zararlı. Bunlar aynı piyasa dönemindeki gözlemler; filtrelenmiş replay farklı zamanlarda başka işlem alabileceğinden doğrudan hesap P/L farkı olarak toplanamaz.

| Sinyal UTC | Yön / kaynak | Gold sonucu | Net R | Model skoru |
| --- | --- | --- | ---: | ---: |
| 2026-07-07T12:06:00.000Z | long / 15dk iFVG + MSP | target | 0.94 | 0.41 |
| 2026-07-07T20:21:00.000Z | short / 5dk iFVG + MSP | target | 1.34 | 0.43 |
| 2026-07-08T14:15:00.000Z | short / 15dk iFVG + MSP | target | 0.98 | 0.41 |
| 2026-07-10T20:00:00.000Z | long / 15dk iFVG | stop | -2.10 | 0.44 |
| 2026-07-15T07:26:00.000Z | short / iFVG + MSP | stop | -1.06 | 0.44 |
| 2026-07-16T11:00:00.000Z | short / 5dk iFVG + MSP | target | 0.91 | 0.40 |
| 2026-07-22T12:20:00.000Z | long / 5dk iFVG + MSP | stop | -1.07 | 0.41 |
| 2026-08-03T10:50:00.000Z | short / iFVG + MSP | stop | -1.08 | 0.44 |
| 2026-08-05T11:04:00.000Z | long / 5dk iFVG | target | 0.95 | 0.41 |
| 2026-08-05T11:27:00.000Z | long / 5dk iFVG + MSP | target | 0.89 | 0.41 |
| 2026-08-05T13:31:00.000Z | long / 5dk iFVG + MSP | stop | -1.04 | 0.41 |
| 2026-08-05T13:59:00.000Z | long / 5dk iFVG + MSP | target | 1.15 | 0.41 |
| 2026-08-05T17:38:00.000Z | long / 5dk iFVG + MSP | target | 0.96 | 0.43 |
| 2026-08-10T17:29:00.000Z | long / 15dk iFVG + MSP | target | 0.83 | 0.43 |

## İncelenecek noktalar

- Gold zararlarında ortalama komisyon/başlangıç riski 0.06R; filtreli kayıplarda 0.07R. Bu, maliyetin katkısını gösterir; fiyatın neden ters döndüğünü tek başına açıklamaz.
- 2026-07-10T20:00:00.000Z Gold işlemi 2026-07-12T22:00:00.000Z tarihinde -2.10R ile kapandı; stop $4103.81 iken çıkış $4094.22 idi. Sinyal ve çıkış arasında piyasa kapanışı varsa, hafta sonu açık pozisyon kısıtı gelecek veride test edilebilir; bu tek olay kuralın toplam faydasını kanıtlamaz.
- Modelin kaynak özellikleri `5dk` ve `15dk` metinlerini ayrı ayrı arıyor; `15dk`, `5dk` alt metnini de içerdiğinden 15dk sinyalleri iki özelliği birden etkinleştirir. Eğitim ve uygulama aynı tanımı kullandı, ancak ayrık zaman dilimi kovaları isteniyorsa sonraki modelde açıkça ayırıp yalnızca yeni bir eğitim/veri bölmesinde yeniden sınamak gerekir.
- Stopun çok yakın olması, üst zaman dilimi bölgesi, haber, oynaklık ve fiyatın ters dönmesi gibi açıklamalar için işlem anına ait ayrı doğrulanmış özellikler gerekir. Bu rapor bunların her birini gözlenmiş neden olarak iddia etmez.
- Lehine/aleyhine hareket aynı dakikanın tepe/dibinden hesaplanır; o dakikada girişten/çıkıştan önce veya sonra hangi seviyenin görüldüğü bilinmediği için üst sınırdır. Haber sütunu uygulamanın sınırlı yerel takvimidir; kapsamı tam değildir.
- Bu dönem artık incelendi. Buradan seçilen herhangi bir değişiklik, henüz görülmemiş başka bir dönemde ve uygulamanın hesap/işlem motorunda tekrar denenmelidir.
