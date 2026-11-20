---
tags: [s2c, kod, sinyal, parca]
---

# Parça sinyal motorları

Grafikte indikatör olarak eklenen, otomatik AL/SAT işaretleri üreten kurallar. Strateji kararları ve deney sonuçları `../arastirma-hafizasi/` kasasında; burada yalnız kodun yapısı var. Bu kuralları değiştirmeden önce `parca-research` skill'ini yükle.

| Sürüm | Kimlik (`parcaVariants.ts`) | Ne yapar |
|---|---|---|
| Klasik | `parca-setup` | Video kurallarının mekanik yorumu: günlük yön (1s/4s/gün), FVG/OB'yi kapanışla yutan mum (engulf → iFVG), mini yapı kırılımı (MSP). |
| Gold | `parca-setup-gold` | Aynı motor, XAU/USD ayarları (`GOLD_SETUP_DEFAULTS`), likidite filtresi, 1R hedef. |
| Gold A+ | `parca-setup-gold-a` | Gold sinyalleri, `parcaModel.ts` olasılığı ≥ %55 olanlar. |
| 1dk Deneysel | `parca-trained-1m` | Gold sinyallerini 1dk grafikte `parcaModel1m.ts` skoruyla süzer. Küçük örneklem, güvenilir değil. |

## Kod kuralları
- **Nedensellik:** yalnız kapanmış mum okunur; üst zaman dilimi mumu/bölgesi kendi kapanış zamanı geçmeden kullanılmaz. Aynı replay anı her çalıştırmada aynı işaretleri verir. `scripts/research/check-causality.mjs` bunu denetler.
- Motor `createSetupEngine(tf, params)` ile artımlı çalışır; `analyzeParcaSetup` tek seferlik analiz.
- Model katsayıları **elle düzenlenmez**: `parcaModel.ts` → `scripts/fit-gold-model.mjs`, `parcaModel1m.ts` → `scripts/train-1m-filter.mjs` ile yeniden üretilir.
- Oynatma sinyal mumunun kapanışında durur; işlemi kullanıcı açar (otomatik işlem yok).

## Düzeltilen kusur (20 Kasım 2026)
`parcaModel1m.ts` eskiden `source.includes('5dk')` kullanıyordu; `'15dk'` metninde de doğru döndüğü için 15dk sinyalleri 5dk ağırlığını alıyordu. Artık eğitimdeki gibi `startsWith('5dk ')` ve düzeltilmiş eğitimin katsayıları (`train-1m-corrected.mjs`) kullanılıyor; eşik 0,45. Model hâlâ deneysel, küçük örneklem.
