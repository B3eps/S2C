# S2C hesap motoru: işlem kaybı incelemesi

Gold ve eğitimli sürüm aynı 2026-07-03 03:00 UTC başlangıcında, 39 günlük pencerede, ayrı temiz S2C profillerinde; $5.000 Infinity Plus ve işlem başına %0,5 riskle çalıştı. S2C emir, spread, komisyon ve zarar kuralları kullanıldı. Sonuçlar birer hesaptır; 39 gün sonunda açık kalan hesaplar sansürlüdür.

## Gold

21 kapanmış işlem: 12 işlem, ortalama 18.35 $ net P/L, 1.01 $ komisyon kazanan; 9 işlem, ortalama -24.07 $ net P/L, 1.27 $ komisyon kaybeden. Durum: challenge/active; çekim $0.00.

| Giriş → çıkış UTC | Yön / kaynak | Giriş / stop / hedef / çıkış | Net P/L | Komisyon | Neden | Önündeki kayıtlı seviye | Yerel takvim ±60dk |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| 2026-07-10T16:01:00.000Z → 2026-07-10T16:23:00.000Z | long / iFVG + MSP | 4113.60 / 4107.84 / 4118.95 / 4107.84 | $-24.67 | $1.64 | sl | 0.30R / Londra | yok |
| 2026-07-10T20:00:00.000Z → 2026-07-12T22:01:00.000Z | long / 15dk iFVG | 4112.51 / 4103.81 / 4120.80 / 4094.22 | $-37.38 | $0.82 | sl | 0.33R / Londra | yok |
| 2026-07-15T07:26:00.000Z → 2026-07-15T08:49:00.000Z | short / iFVG + MSP | 4022.66 / 4029.92 / 4015.39 / 4029.92 | $-23.01 | $1.21 | sl | 0.16R / 4sa dip | yok |
| 2026-07-15T12:58:00.000Z → 2026-07-15T13:16:00.000Z | long / 1sa iFVG + MSP | 4071.13 / 4061.08 / 4080.77 / 4061.08 | $-20.90 | $0.81 | sl | 2.13R / 4sa dip | yok |
| 2026-07-22T12:20:00.000Z → 2026-07-22T12:47:00.000Z | long / 5dk iFVG + MSP | 4129.28 / 4123.17 / 4135.00 / 4123.17 | $-26.12 | $1.65 | sl | 1.54R / 4sa tepe | yok |
| 2026-07-27T18:39:00.000Z → 2026-07-27T18:42:00.000Z | short / iFVG + MSP | 4073.18 / 4077.17 / 4069.20 / 4077.17 | $-26.38 | $2.45 | sl | 8.21R / 4sa tepe | yok |
| 2026-08-03T10:50:00.000Z → 2026-08-03T11:06:00.000Z | short / iFVG + MSP | 4047.47 / 4052.46 / 4042.47 / 4052.46 | $-21.60 | $1.62 | sl | 0.08R / Asya | yok |
| 2026-08-05T13:31:00.000Z → 2026-08-05T13:51:00.000Z | long / 5dk iFVG + MSP | 4200.06 / 4190.61 / 4209.12 / 4190.61 | $-19.74 | $0.84 | sl | kayıtlı yakın seviye yok | yok |
| 2026-08-05T15:00:00.000Z → 2026-08-05T16:00:00.000Z | long / iFVG + MSP | 4249.05 / 4232.64 / 4265.07 / 4232.64 | $-16.84 | $0.42 | sl | kayıtlı yakın seviye yok | yok |

## Eğitimli

8 kapanmış işlem: 3 işlem, ortalama 16.15 $ net P/L, 0.69 $ komisyon kazanan; 5 işlem, ortalama -23.12 $ net P/L, 1.50 $ komisyon kaybeden. Durum: challenge/active; çekim $0.00.

| Giriş → çıkış UTC | Yön / kaynak | Giriş / stop / hedef / çıkış | Net P/L | Komisyon | Neden | Önündeki kayıtlı seviye | Yerel takvim ±60dk |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| 2026-07-10T16:01:00.000Z → 2026-07-10T16:23:00.000Z | long / iFVG + MSP | 4113.60 / 4107.84 / 4118.95 / 4107.84 | $-24.67 | $1.64 | sl | 0.30R / Londra | yok |
| 2026-07-15T12:58:00.000Z → 2026-07-15T13:16:00.000Z | long / 1sa iFVG + MSP | 4071.13 / 4061.08 / 4080.77 / 4061.08 | $-20.90 | $0.81 | sl | 2.13R / 4sa dip | yok |
| 2026-07-27T18:39:00.000Z → 2026-07-27T18:42:00.000Z | short / iFVG + MSP | 4073.18 / 4077.17 / 4069.20 / 4077.17 | $-26.38 | $2.45 | sl | 8.21R / 4sa tepe | yok |
| 2026-08-05T15:00:00.000Z → 2026-08-05T16:00:00.000Z | long / iFVG + MSP | 4249.05 / 4232.64 / 4265.07 / 4232.64 | $-16.84 | $0.42 | sl | kayıtlı yakın seviye yok | yok |
| 2026-08-10T17:37:00.000Z → 2026-08-10T17:46:00.000Z | long / iFVG + MSP | 4363.41 / 4358.49 / 4367.94 / 4358.49 | $-26.82 | $2.18 | sl | 1.79R / önceki gün | yok |

## Nasıl yorumlanır?

- Çıkış nedeni işlemin nasıl kapandığını gösterir; fiyatın neden ters döndüğünü kanıtlamaz.
- Önündeki seviye mevcut hesap simülatörünün önceki gün, seans ve 4 saatlik seviyelerinden türettiği yaklaşık bağlamdır. Bu alan, modelin kullandığı bir özellik değildir ve grafikteki son 48 mum seviyesiyle aynı değildir.
- Haber bilgisi uygulamanın sınırlı yerel takviminden alınır; bu takvim eksik olabilir ve haberin kayba neden olduğunu göstermez.
- İşlemden sonra bulunan örüntüyü kurala dönüştürmek önceki veriye uyarlama yaratır. Yeni bir kural, daha önce görülmemiş dönemlerde ve yeniden hesap replay ile doğrulanmalıdır.
