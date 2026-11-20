---
tags: [s2c, kod, yapilacaklar]
---

# İyileştirmeler

20 Kasım 2026 incelemesi. Önem sırasıyla. Çözülen maddeyi sil.

## 1. Acil: kaybolma riski
- **Dal GitHub'da yok.** `parca-setup-ve-veri-duzeltmeleri` dalındaki iş 20 Kasım 2026'da commit'lendi (`f6c5a16`), ama dal hiç `origin`'e gönderilmedi; yalnız bu diskte duruyor. `git push -u origin parca-setup-ve-veri-duzeltmeleri`.
- **`main` geride.** Asıl kod Parça dalında; `main` iki adım eski. İş oturunca birleştir.
- **`analysis/` ham verisi (`.json`, `.jsonl`, `.log`, `.csv`, ~35 MB) git dışında ama `.gitignore`'da da değil.** Yalnız `.md` raporlar commit'lendi. Ham dosyalar için `.gitignore` satırı ekle; bunların yedeği yalnız bu disk.
- `arastirma-hafizasi/.obsidian/workspace.json` her Obsidian açılışında değişir; `.gitignore`'a ekle.

## 2. Kullanıcı verisinin güvenliği
- **Kalıcı depolama istenmiyor.** `navigator.storage.persist()` çağrısı yok; disk dolunca tarayıcı IndexedDB'yi silebilir. Açılışta bir kez iste.
- **Otomatik yedek yok.** Yedek tamamen elle. Son yedekten bu yana N gün geçince panelde hatırlatma ya da launcher'ın her açılışta `dist` dışına yedek alması düşünülebilir (PLAN'a ekleme onayı gerekir).
- **Ekran görüntüleri dataURL metni.** Her işlemde iki WebP metin olarak saklanıyor ve yedekte tek `JSON.stringify` ile birleşiyor; yüzlerce işlemden sonra yedek yavaşlar, bellek taşabilir. `Blob` olarak sakla, yedekte parça parça yaz.

## 3. Doğruluk
- **`parcaModel1m.ts` etiket hatası:** `source.includes('5dk')` 15dk sinyallerinde de 1 olur. Tam eşleşmeyle düzelt, modeli yeniden eğit (README bunu zaten söylüyor).
- **`/api/candles` aralık sınırı yok.** Hatalı bir `from` yıllarca 1dk veri indirmeye çalışır. Zaman dilimine göre en çok aralık (ör. 1dk için 7 gün) koy.
- **`Feed.minutes` sınırsız büyür.** Çok uzun seansta (haftalar) bellek artar. Gerekmeyen eski dakikaları kırp ya da sınırla.

## 4. Kod sağlığı
- **Dev dosyalar:** `store.ts` ~1500, `indicators.ts` ~1200, `ChartPanel.tsx` ~1150 satır. Bir asistan her değişiklikte hepsini okumak zorunda kalıyor (token maliyeti). Önerilen bölme: `store.ts` → replay döngüsü, emir bileti, hesap/ödeme eylemleri; `indicators.ts` → kategori başına dosya; `ChartPanel.tsx` → emir çizgisi etiketleri ve çizim katmanı ayrı bileşen.
- **Tekrarlanan kod:** mum birleştirme (`aggregate`) hem `feed.ts` hem `liquidityStrategies.ts` hem scriptlerde ayrı yazılmış. Tek yardımcıya topla.
- **Tip denetimi dışı:** `vite.config.ts` ve `scripts/` `tsconfig` kapsamında değil. Uç nokta kodu sessizce bozulabilir.
- `uid()` `Math.random` kullanıyor; `crypto.randomUUID()` daha güvenli.
- `inspectBackup` her işlem için seansları baştan tarıyor (`sessions.find`); büyük yedekte yavaş. Haritadan oku.

## 5. Test ve CI
- Çekirdek testler iyi (46 test, hepsi geçiyor). Eksik: `store.ts` akışları (ihlal anı, funded geçişi, ödeme engelleri, gün değişimi). Bunları saf fonksiyonlara çıkarıp `test-core.mjs`'e ekle.
- CI tarayıcı testini (`test:browser`) çalıştırmıyor; GitHub Actions'ta Chrome var, eklenebilir.
- CI her itmede çalışır ama dal gönderilmediği için Parça işi CI'ya hiç ulaşmadı (madde 1).
