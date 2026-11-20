# Gold 1m sonuç skoru: düzenlileştirilmiş lojistik model

Yalnızca Gold presetindeki 158 gerçek store işlemi kullanıldı. Hedef, komisyon sonrası pnl'nin pozitif olmasıdır. İlk 116 işlem (7 dönem) ile model eğitildi; son 42 işlem (3 dönem) sadece kronolojik karşılaştırmadır. Bu eski dönemler önceki raporlarda incelendiğinden gerçek untouched holdout değiller.

## Model girdileri ve katsayılar

8 katsayılı L2 lojistik regresyon: intercept, source 5dk/15dk/1sa kovaları (referans diğer kaynak), strong, long yönü, UTC saat sinüs/kosinüsü. L2 lambda=0.15; amaç fonksiyonu ortalama lojistik kayıp + lambda/2 × intercept dışı katsayı kareleri. Kaydedilen Gold prob (5dk model olasılığı) kullanılmadı. liqR logda yok; aheadR farklı olduğundan ikame edilmedi.

| Özellik | Katsayı |
| --- | ---: |
| intercept | -0.176778 |
| source_5m | -0.171709 |
| source_15m | -0.016328 |
| source_1h | 0.032359 |
| strong | -0.031193 |
| long | 0.032226 |
| hour_sin | -0.038752 |
| hour_cos | 0.053403 |

Skor sigmoid(intercept + katsayı × özellikler) ile 0–1 aralığına çevrilen tahmindir; kalibre edilmiş başarı garantisi değildir. Model JSON: [train-1m-corrected-model.json](train-1m-corrected-model.json).

## Eşik seçimi ve karşılaştırma

Eşik adayları sadece TRAIN üzerinde incelendi. En az 20 işlem ve %25 elde tutma, baz win rate'ten yüksek oran ve baz net P/L/işlemden kötü olmayan sonuç şartlarıyla TRAIN win rate en yüksek eşik seçildi; eşitlikte TRAIN P/L/işlem kullanıldı. Seçilen eşik: **0.45** (TRAIN koşullarını karşıladı). VALIDATION eşik seçiminde kullanılmadı.

| Eşik | TRAIN n | TRAIN win | TRAIN net/işlem | VALIDATION n | VALIDATION win | VALIDATION net/işlem | VALIDATION net toplam |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.30 | 116 | 44.0% | $-5.39 | 42 | 40.5% | $-6.74 | $-283.03 |
| 0.35 | 116 | 44.0% | $-5.39 | 42 | 40.5% | $-6.74 | $-283.03 |
| 0.40 | 106 | 44.3% | $-5.26 | 38 | 44.7% | $-4.89 | $-185.85 |
| 0.45 | 35 | 62.9% | $2.22 | 8 | 37.5% | $-8.19 | $-65.55 |
| 0.50 | 0 | 0.0% | $0.00 | 0 | 0.0% | $0.00 | $0.00 |
| 0.55 | 0 | 0.0% | $0.00 | 0 | 0.0% | $0.00 | $0.00 |
| 0.60 | 0 | 0.0% | $0.00 | 0 | 0.0% | $0.00 | $0.00 |
| 0.65 | 0 | 0.0% | $0.00 | 0 | 0.0% | $0.00 | $0.00 |
| 0.70 | 0 | 0.0% | $0.00 | 0 | 0.0% | $0.00 | $0.00 |

Baz çizgisi TRAIN: n=116, win 44.0%, net/işlem $-5.39; validation: n=42, win 40.5%, net/işlem $-6.74. Seçilen eşik TRAIN: win 62.9%, net/işlem $2.22; validation: n=8, win 37.5%, net/işlem $-8.19, toplam $-65.55.

## Sınırlar

- 158 işlem ve 10 ayrı tarih penceresi küçük örneklem; model sadece yedi eski pencerede eğitildi. Validation üç penceredir ve geçmişte görülmüştür. Yeni 2026-07-03–2026-08-11 tarih aralığı modele/eşik seçimine katılmadı.
- Source, strong, side ve UTC hour sinyal anındaki kayıttan gelir; saat sinyal zamanına göre hesaplanmıştır. Haber değişkeni kullanılmadı. Gold prob bilerek dışarıda tutuldu; bu 1m işlem tahmini 5m Gold modeli olasılığı diye sunulmuyor.
- Model skoru Gold sinyallerinin bütün listesini yeniden oynatmaz. Bir işlemi filtrelemek, aynı simülasyonda o sırada açık pozisyon nedeniyle atlanmış başka bir sinyali alınabilir kılar; o alternatif sinyaller JSONL'de saklanmadı. Dolayısıyla validation tablo değerleri koşullu, trade-silme karşılaştırmasıdır.
- Dosyadaki işlem pnl'si model komisyonunu zaten düşmüştür; win=net pnl>0. Filtre sonuçları pozitif net beklenti veya prop hesap geçişi kanıtı değildir. Uygulamaya almadan önce dondurulmuş model ve eşikle yeni tarihlerde tam sinyal üretimi, pozisyon yönetimi ve komisyonlu replay gerekir.

Tekrar üretim: node scripts/train-1m-corrected.mjs.