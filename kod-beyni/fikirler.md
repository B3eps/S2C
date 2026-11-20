---
tags: [s2c, fikir]
---

# Özellik fikirleri

20 Kasım 2026 araştırması: FX Replay, Forex Tester, TradeZella, Edgewonk ile karşılaştırma. Hiçbiri onaylı değil; `PLAN.md` kuralı gereği kullanıcı seçmeden eklenmez. Seçilen fikir PLAN'a girince buradan sil.

Rakiplerde olup S2C'de olmayanlar: işlem etiketleri ve hata etiketleri, setup başına istatistik (playbook), tilt/intikam işlemi uyarısı, MAE/MFE analizi. S2C'de olup rakiplerde olmayan: kör replay ve prop kural simülasyonu.

## Kendi işlemlerinden öğrenme
1. **Etiket ve hata etiketi** — her işleme setup ve hata (erken giriş, SL kaydırma, intikam, plansız) etiketi; İstatistik'te etiket başına sonuç. Günlükte şu an yalnız not var.
2. **MAE/MFE** — işlem açıkken fiyatın en çok ne kadar ters/lehte gittiği (R cinsinden). "Stopum dar mı, TP'yi erken mi alıyorum" sorusunu cevaplar. Veri zaten 1dk mumlarda var.
3. **İşlem öncesi kontrol listesi** — emir biletinde setup kurallarını işaretleme; listeye uymayan işlemlerin sonucu ayrı gösterilir.
4. **Disiplin uyarısı** — art arda kayıp, lotu büyütme, kayıptan hemen sonra işlem gibi kalıplarda uyarı (tilt).

## Prop tarafı
5. **Geçme olasılığı** — kullanıcının kendi işlem istatistikleriyle her programı (BEM, FTM) binlerce kez simüle edip "bu programı geçme şansın %X, ortalama süre Y gün" göstermek. Hangi paketi alacağına gerçek veriyle karar.
6. **Hesap maliyet tablosu** — harcanan ücret, alınan ödeme, net; program başına geri dönüş.

## Pratik modları
7. **Senaryo başlangıcı** — kör seansı rastgele değil, seçilen bir an tipinde başlat: NFP/CPI/FOMC öncesi, Londra açılışı, NY açılışı. Takvim verisi var.
8. **Kör tahmin egzersizi** — seans sonunda perde açılmadan önce trend, seans ve volatilite tahmini; tahmin isabeti zamanla izlenir.

## Yapay zekâ (PLAN'daki "Gelecek" maddesi)
9. **Günlük değerlendirmesi** — haftalık işlem özetini (etiketler, MAE/MFE, kurallara uyum) bir dosyaya döküp Claude/ChatGPT'ye yorumlatmak. İnternet bağlantısı ve hesap gerekir, veriler yerelden çıkar.
