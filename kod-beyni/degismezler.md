---
tags: [s2c, kod, kurallar]
---

# Değişmezler ve tuzaklar

Kodda görünmeyen ama bozulursa ürünü bozan kurallar. Bir değişiklik bunlardan birine dokunuyorsa önce kullanıcıya sor.

## Ürün kuralları (kullanıcının)
- `PLAN.md`'de olmayan hiçbir özellik ya da arayüz yazısı eklenmez; değişiklikten önce onay alınır.
- Arayüz tamamen **Türkçe**; slogan, dolgu metin, sahte sayı yok.
- Hazır ikon seti ve emoji yok (ikonlar `Icon.tsx`'te elle çizilmiş). Sesler `sound.ts`'te sentezlenir, ses dosyası yok.
- Firma (BEM, FTM) adı kural kaynağı olarak geçer; logoları kullanılmaz.
- Açıkça istenmedikçe yeni strateji uygulamaya eklenmez (`AGENTS.md`).

## Kör replay
- Oyun sırasında **fiyat ve tarih görünmez**: fiyat ekseni, imleç etiketi gizli; seviyeler R, % ve $ olarak okunur. Kullanıcı tek tıkla fiyatı açabilir (`showPrice`).
- Gelecek mum sızamaz: `base0` sonrası her şey 1dk mumlardan kurulur. Yeni bir veri yolu eklerken bu kuralı koru.
- Hafta sonu mumları gizlenir (`market.ts` `isClosed`, New York saatine göre).

## Teknik tuzaklar
- **Port 5199 sabit:** tarayıcı verisi bu kökene bağlı; değiştirmek kullanıcının tüm kayıtlarını "kaybettirir".
- `src/lib/theme.ts` ↔ `src/styles/tokens.css` renkleri elle eş tutulur.
- Altın rengi (`--gold`) yalnız amblem, sertifika etiketi ve ekranın tek ana eylemi için. Pozitif veri `--up` rengindedir.
- Animasyonlar yalnız `transform`/`opacity`; `prefers-reduced-motion` hepsini kapatır.
- `store.ts` seansı yerinde değiştirip `{ ...s }` ile yeni nesne verir; bileşenler sığ karşılaştırma yapar. Yeni eylemde aynı deseni izle.
- Prop günü 22:00 UTC; takvim günüyle karıştırma.
- `tsconfig.json` yalnız `src`'i kapsar; `vite.config.ts` ve `scripts/` tip denetimine girmez.
- Windows'ta çalışılıyor: dosyalar LF/CRLF uyarısı verir, yollar `C:\S2C`.
