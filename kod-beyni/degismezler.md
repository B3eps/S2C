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
- Hafta sonu mumları altın ve endekslerde gizlenir (`market.ts` `isClosed`, New York saatine göre); kripto 7/24 açıktır.
- Gün şeridi yalnız ileri gider (`advanceTo`); geri sarma eklemek kör replay'i bozar.

## Teknik tuzaklar
- **Port 5199 sabit:** tarayıcı verisi bu kökene bağlı; değiştirmek kullanıcının tüm kayıtlarını "kaybettirir".
- **Çizimler tuvalde:** grafiğe yeni bir görsel katman eklenecekse SVG/HTML değil `drawingScene.ts` şekli olarak ekle; React üstü katman grafiğin bir kare gerisinde kalır. Tıklama tespiti aynı şekillerden yapılır.
- **Enstrüman seansa bağlı:** sözleşme, spread, kaldıraç ve komisyon `store.ts`teki `inst` üzerinden gelir; yeni hesaplamada `CONTRACT` sabitini doğrudan kullanma. `instrument` alanı olmayan eski kayıt altındır.
- `src/lib/theme.ts` ↔ `src/styles/tokens.css` renkleri elle eş tutulur.
- Altın rengi (`--gold`) yalnız amblem, sertifika etiketi ve ekranın tek ana eylemi için. Pozitif veri `--up` rengindedir.
- Animasyonlar yalnız `transform`/`opacity`; `prefers-reduced-motion` hepsini kapatır. Motion (`motion/react`, `LazyMotion strict`) yalnız menü/flyout açılıp kapanması, bildirim ve düzen değişimi için; `motion.div` değil `m.div` kullan. Grafik içindeki efektler CSS ve tuvalde kalır.
- **Genişlik:** sayfa en az 960 px. Izgara kaplarına (`.trade`, `.dock`) `minmax(0, 1fr)` sütun ver; vermezsen içerik ekranı genişletir. Dar ekranda kısalan düğmeler `aria-label` ile tam adını korur (tarayıcı testi bu adlarla arar).
- `store.ts` seansı yerinde değiştirip `{ ...s }` ile yeni nesne verir; bileşenler sığ karşılaştırma yapar. Yeni eylemde aynı deseni izle.
- Prop günü 22:00 UTC; takvim günüyle karıştırma.
- `tsconfig.json` yalnız `src`'i kapsar; `vite.config.ts` ve `scripts/` tip denetimine girmez.
- Windows'ta çalışılıyor: dosyalar LF/CRLF uyarısı verir, yollar `C:\S2C`.
