---
tags: [s2c, kod, yapilacaklar]
---

# İyileştirmeler

20 Kasım 2026 incelemesinden kalan açık maddeler. Önem sırasıyla. Çözülen maddeyi sil.

## Kodla çözülemeyenler
- **Kalıcı depolama tarayıcıya bağlı.** Uygulama her açılışta `navigator.storage.persist()` ister; Chrome izni siteyle etkileşime göre kendisi verir, reddedebilir. Asıl güvence yedek: 7 günden eski yedekte panel uyarır (`BackupNudge`, kv `lastBackupAt`).
- **Kaldıraçlar üçüncü taraf kaynaktan.** FTM endeks 20:1 (thegodfunded.com), BEM kripto/endeks (PropFirmMatch). Firmalar resmî tablo yayımlarsa `programs.ts`'yi güncelle.
- **BEM kripto komisyonu bilinmiyor.** Kaynaklar %0,025 ile %0,05 arasında çelişiyor; uygulama metal oranını (%0,001) kullanıyor.
- **Eski hesaplar yeni kaldıraçları almaz.** Hesap kuralları açıldığı anda kopyalanır; o tarihten önceki BEM hesaplarında kripto/endeks kaldıracı uygulama varsayılanıdır (kripto 2x, endeks 20x).

## Kod sağlığı
- **`indicators.ts` (~1070) hâlâ uzun.** Ortak hesaplar `indicatorMath.ts`'e ayrıldı; kalan kısım 64 indikatörün tanım tablosu. Gerekirse kategori başına dosyaya bölünebilir.
- **`store.ts` (~1420) ve `ChartPanel.tsx` (~815)** büyük ölçüde tek parça eylemler; daha fazla bölmek davranış riski taşır, gerekmedikçe dokunma.
- Araştırma scriptlerinde (`scripts/*.mjs`) mum birleştirme kendi kopyalarıyla duruyor; uygulama `lib/candles.ts`'i kullanıyor.
