---
tags: [s2c, fikir, arastirma]
---

# Genişleme araştırması (20 Kasım 2026)

Kullanıcının istediği üç iş: yeni enstrümanlar, daha kararlı grafik ve çizimler, animasyonlu arayüz. **Durum (20 Kasım 2026):** çizimler tuvale taşındı, beş enstrüman eklendi, gün şeridi eklendi. Animasyon kütüphanesi henüz eklenmedi. Kullanıcı ilkesi: her konuda kökenine kadar araştır, ücretsiz kaynakları dene, özgün özellik yaz ve çiz.

## 1. Yeni enstrümanlar
**Denendi:** `dukascopy-node` ile 10 ve 14 Kasım 2026 için 1dk mum indirildi.

| S2C adı | Dukascopy kimliği | 1dk mum/gün | Hafta sonu |
|---|---|---|---|
| XAU/USD | `xauusd` | ~1380 | kapalı |
| BTC/USD | `btcusd` | 1439 | **açık** |
| ETH/USD | `ethusd` | 1439 | **açık** |
| S&P 500 | `usa500idxusd` | ~1333 | kapalı |
| Nasdaq 100 (NQ yerine) | `usatechidxusd` | ~1334 | kapalı |

Ekleme için değişmesi gerekenler:
- `market.ts` `isClosed` enstrümana bağlı olmalı (kripto 7/24; endekslerin günlük arası var).
- `CONTRACT=100` ve `MIN_LOT` altına özel; her enstrümana sözleşme büyüklüğü, fiyat adımı, varsayılan spread.
- `vite.config.ts` uç noktası `instrument` parametresi almalı; önbellek zaten enstrüman başına ayrı.
- Prop kuralları enstrümana göre kaldıraç: FTM sitesi BTC/ETH 8x, diğer kripto 2x, altın 10x; endeks sınırı doğrulanamadı. Komisyon: kripto %0,03, endeks/emtia %0,005.
- Takvim olayları (NFP/CPI/FOMC) endekslere de uyar; kripto için seans bantları anlamını yitirir.
- Parça motorları altın için ayarlandı; başka enstrümanda varsayılan kapalı olmalı.
- Seans kaydına (`SessionRec`) ve işleme (`Trade`) `instrument` alanı; eski kayıtlar `xauusd` sayılır, yedek doğrulaması güncellenir.

## 2. Grafik ve çizim kararlılığı
**Kök neden bulundu:** çizimler ve emir çizgileri `ChartPanel.tsx`'te grafiğin üstünde ayrı bir React SVG katmanı. Grafik kaydırılınca/yakınlaşınca katman `setVer` ile bir sonraki karede güncelleniyor; kodda bunu yamamak için çift `requestAnimationFrame` ve 120–150 ms `setTimeout` yeniden çizimleri var. Sonuç: kaydırırken çizgiler bir kare geride kalır, titrer.

**Kalıcı çözüm:** Lightweight Charts v5'in resmi eklenti yolu, **series/pane primitive** (`series.attachPrimitive`, `IPrimitivePaneRenderer`). Çizimler grafiğin kendi canvas'ına, aynı karede çizilir; titreme olmaz. Etkileşim (sürükleme, seçim) için `priceToCoordinate` / `coordinateToPrice` / `timeToCoordinate` ile isabet testi. Resmi şablon: `npm create lwc-plugin@latest`.

## 3. Arayüz ve animasyon
Ücretsiz kaynaklar (lisanslar doğrulanmalı):
- **Motion** (eski Framer Motion, MIT): React için jest, düzen geçişi, yay fiziği. S2C'ye en uygun motor.
- **GSAP** (2025'ten beri tüm eklentileri ücretsiz): uzun zaman çizelgeli sahneler (funded, ihlal, perde).
- **Lottie** (MIT), **Rive** (çalıştırıcı açık, editör ticari): önceden çizilmiş animasyon oynatma.
- **React Bits**, Anime.js, React Spring, Theatre.js.

S2C kuralı (`PRODUCT.md`): hareket dili özgün. Kütüphane yalnız motor olarak kullanılır; hazır bileşen görünümü kopyalanmaz.

Özgün fikir — **oynatılabilir zaman çizelgesi:** replay kontrolünü video düzenleyici gibi bir şeride çevirmek. Şeritte seans bantları, takvim olayları, kendi giriş/çıkışların; sürükleyerek ileri sarma (yalnız ileri, gelecek açılmaz), hız tekerleği, "sonraki olaya atla".

Kaynaklar: [ftmperps.com](https://www.ftmperps.com/), [BestProps FTM incelemesi](https://bestprops.com/prop-firms/funded-trader-markets/), [Lightweight Charts eklenti belgeleri](https://github.com/tradingview/lightweight-charts/blob/master/website/docs/plugins/series-primitives.mdx), [xcodx animasyon kütüphaneleri 2026](https://xcodx.io/blog/libraries/best-web-animation-libraries), [SmashingApps 2026](https://www.smashingapps.com/best-free-javascript-animation-libraries-in-2026/), [Awwwards Olymptrade animasyon incelemesi](https://www.awwwards.com/inspiration/cards-animation-olymptrade-trading-platform).
