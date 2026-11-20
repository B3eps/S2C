# Güvenilirlik ve başlangıç noktası

- `src/lib/feed.ts`: Dukascopy bid mumları; replay 1 dakika ilerler. Daha yüksek zaman dilimlerinde tamamlanmış ve oluşmakta olan mumları ayırt et; geleceği gösteren pivot veya veri sızıntısı kullanma.
- `src/lib/execution.ts`: sabit spread, emir dolumu ve SL/TP kuralları. Aktif replay iki olası OHLC sırasını çalıştırır. Önceki araştırma betikleri kendi dolum varsayımlarını taşıyabilir. Spread genişlemesi ve gerçek kayma ölçülmedi.
- 19 Kasım 2026 · Hesap ihlali dolum/SL/TP ile fiyat yolundaki sırasına göre işleniyor. İki tutarlı OHLC yolu, mevcut S2C maliyetleri ve bilinen sınırlamalar [[deneyler/00-simulasyon-denetimi]] dosyasında.
- S2C açılış boşluğuna ara fiyat eklemez. M1 kapsamı ve sinyalin bitişik sonraki muma taşınması araştırma motorunda ayrıca denetlenir. Tarihsel testler [[deneyler/donem-kaydi]] dosyasına göre ayrıldı.
- Önceki araştırmalarda Gold 1dk filtresi ayrı dönemde 8 işlemde %37,5, Gold 21 işlemde %57,1 kazanma göstermiş; örneklem küçük. Bkz. `analysis/gold-1m-holdout-2026-07-03_2026-08-11.md`. Eski incelenmiş dönemleri dokunulmamış test dönemi diye etiketleme.
- Önceki doğrulama: 18 Kasım 2026 tarihinde 35 çekirdek test ve build geçti; tarayıcı testi ortamda localhost erişimi engellendiğinden çalışmadı. Güncel durumu tekrar kontrol et.
