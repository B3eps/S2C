---
tags: [s2c, kod, harita]
---

# Dosya haritası

Satır sayıları Kasım 2026 çalışma kopyası. Bir dosyayı açmadan önce buradan doğru olanı seç.

## Çekirdek (`src/`)
| Dosya | Görev |
|---|---|
| `store.ts` (~1500) | Tüm uygulama durumu ve eylemleri (Zustand `useApp`). Seans, emir bileti, `processMinute`, kural ihlali, funded/payout, oynatma döngüsü, seans kaydını 1 sn'lik kısıtla yazma (`persistSession`/`flushSession`). |
| `App.tsx` | Kabuk, sol menü, görünüm yönlendirme. |

## `src/lib/` (saf mantık, test edilebilir)
| Dosya | Görev |
|---|---|
| `types.ts` | Tüm tipler (`Bar`, `Order`, `Position`, `Trade`, `Rules`, `Account`, `SessionRec`, `Drawing`), `CONTRACT=100`, `MIN_LOT=0.01`, `uid`. |
| `feed.ts` | `Feed` replay akışı, `/api/candles` çağrısı ve veri doğrulama, `randomStart`. |
| `market.ts` | ABD yaz saati (`usDst`), piyasa kapalı mı (`isClosed`, New York 17:00 Cuma → 18:00 Pazar), günlük mumlar. |
| `execution.ts` | Dolum ve çıkış kuralları, spread, risk lotu, kaldıraç sınırı, mum içi yol simülasyonu. → [[islem-motoru]] |
| `accountRules.ts` | Günlük/toplam zarar tabanı, hedef, ödeme eşiği, sayılan günler. |
| `programs.ts` | BEM ve FTM programları (fiyat, indirim, kurallar), `propDay` (22:00 UTC gün sınırı), `payoutNet`, `splitFor`. |
| `db.ts` | IndexedDB şeması, yedek dışa/içe aktarma ve doğrulama. → [[veri-ve-kayit]] |
| `indicators.ts` (~1200) | 64 indikatör tanımı ve yardımcılar (`sma`, `ema`, `atr`...), `INDICATORS`, `IND_BY_ID`. |
| `parcaSetup.ts`, `parcaSetupGold.ts`, `parcaVariants.ts`, `parcaModel.ts`, `parcaModel1m.ts` | Parça sinyal motorları ve modelleri. → [[parca-sinyalleri]] |
| `liquidityStrategies.ts` | Bağımsız araştırma motoru (sweep/FVG/OB likidite sinyalleri). |
| `chartController.ts` | Lightweight Charts sarmalayıcı: seriler, emir çizgileri, ekran görüntüsü (WebP). |
| `drawings.ts` | Çizim aracı kataloğu (kategoriler, Fibonacci seviyeleri, regresyon). |
| `calendar.ts` | NFP/CPI/FOMC tarihleri, seans (Asya/Londra/NY/çakışma). |
| `stats.ts` | Özet metrikler, ısı haritası ızgarası. |
| `sound.ts` | Web Audio ile sentezlenen sesler (dosya yok). |
| `theme.ts` | Grafik renkleri; `styles/tokens.css` ile **eşit tutulmalı**. |
| `format.ts` | Para, %, R, lot, tarih biçimleri (Türkçe). |

## `src/components/`
`ChartPanel.tsx` (~1150, grafik bölmesi, sürüklenebilir emir/SL/TP etiketleri, çizimler), `ToolRail.tsx` (çizim araç çubuğu), `IndicatorPicker.tsx`, `TradeChart.tsx` (günlükteki işlem grafiği), `bits.tsx` (CertLabel, Gauge, EquityCurve, Heatmap, CountUp), `PerformanceCalendar.tsx`, `Icon.tsx` (elle çizilmiş ikonlar), `Emblem.tsx`.

## `src/views/`
`Trade.tsx` (~730, işlem ekranı), `Dashboard`, `NewAccount`, `Journal`, `Stats`, `Settings` (ayarlar, yedekleme), `Replay` (işlem tekrarı), `Overlays` (büyük anlar ve bildirimler).

## `scripts/`
| Dosya | Görev |
|---|---|
| `launch.mjs` | Kullanıcı başlatıcısı: ilk kurulum, gerekirse yeniden derleme, `:5199` sunucu. |
| `test-core.mjs` | `node:test` + esbuild ile `src/lib` testleri. |
| `test-browser.mjs` | Playwright ile uçtan uca test (geçici profil, sentetik mumlar). |
| `render-brand.cjs` | SVG amblemden PNG üretir. |
| `backtest-parca.mjs`, `fit-gold-model.mjs`, `train-1m-filter.mjs`, `account-*.mjs`, `research-*.mjs`, `research/` | Araştırma ve geri test scriptleri; sonuçları `analysis/` ve `arastirma-hafizasi/` altında. |

## Kök belgeler
`PLAN.md` (onaylı özellik listesi, kural: listede olmayan eklenmez), `PRODUCT.md` (ürün ilkeleri), `DESIGN.md` (tasarım sistemi), `AGENTS.md` (asistan talimatları), `README.md` (kullanıcı kılavuzu).
