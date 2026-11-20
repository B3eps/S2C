---
tags: [s2c, kod, emir, prop]
---

# İşlem motoru ve prop kuralları

## Fiyat ve sözleşme
- Mum = **bid**. Long ask'tan alır (bid + spread), bid'den satar; short tersi. Varsayılan spread `DEFAULT_SPREAD = 0.2` $, Ayarlar'dan değişir (`spreadOf`).
- 1 lot = 100 ons (cTrader XAUUSD), en küçük 0,01 lot. P&L = fiyat farkı × lot × 100.
- FTM programlarında altın kaldıracı sınırı (`goldLeverage`) lotu kısıtlar.

## Dolum kuralları (`execution.ts`)
1dk OHLC, mum içinde yüksek/düşüğün sırasını söylemez; motor **temkinli** davranır:
- Aynı mumda SL ve TP görülürse **stop önce** sayılır.
- Boşlukla (gap) geçilen stop, açılış fiyatından dolar.
- Mum içinde dolan emrin aynı mumdaki stopu işlenir; hedefi ise ertelenir (girişten önce olmuş olabilir). Açılışta dolan giriş her iki uçtan önce sayılır.
- Bekleyen emir: limit/stop türü, fiyatın girişe göre konumundan türetilir (`deriveType`).
- Piyasa emrinde fiyatın öbür tarafında kalan SL/TP konmaz ve kullanıcıya söylenir.

Bu kuralların hepsi `scripts/test-core.mjs`'te test ediliyor; değiştirirsen testi de değiştir.

## Prop hesap kuralları
- **Prop günü** 22:00 UTC'de başlar (`propDay`).
- Günlük zarar tabanı = gün başı özsermaye (veya bakiye, `dailyBase`) − boyut × `dailyLoss`%.
- Toplam zarar: `static` sabit taban; `trailing` en yüksek kapanış bakiyesiyle yükselir, başlangıç bakiyesinde kilitlenir (`maximumLossFloor`).
- Kurallar **her 1dk mumda** en kötü özsermayeyle (mumun uçları) kontrol edilir; ihlalde tüm pozisyonlar kapanır, hesap `violated` olur.
- Aşamalar `targets` dizisinden; kârlı gün şartı `minDayPct`; tutarlılık `consistencyPct` / `payoutConsistencyPct`.
- Ödeme: `payoutAt` eşiği, en az ödeme, tampon, kâr payı merdiveni (`splitLadder`), sağlayıcı kesintisi (`payoutFeePct`).
- Komisyon özsermayeye dahil (`commissionPct`, işlem hacminin %'si, yön başına).

## Programlar (`programs.ts`)
BEM Classic Normal, BEM Classic Swing, BEM One, BEM One Only (kurallar 2026-11-10) ve FTM Infinity / Infinity Plus (2026-11-13). Her yeni hesap kuralların **kopyasını** saklar; programı değiştirmek eski hesapları etkilemez. Kaynak bağlantıları README'de. Modellenmeyenler dosya başındaki yorumda yazılı.
