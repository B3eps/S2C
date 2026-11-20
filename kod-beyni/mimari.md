---
tags: [s2c, kod, mimari]
---

# Mimari

Yığın: Vite 7 + React 18 + TypeScript, durum için Zustand, grafik için Lightweight Charts v5, kayıt için IndexedDB (`idb`). Sunucu yok; tek arka uç parçası Vite'ın içindeki mum uç noktası.

## Veri akışı

```
Dukascopy (internet)
  └─ dukascopy-node  ── vite.config.ts eklentisi `s2c-xau-api`
       GET /api/candles?tf=&from=&to=  → [[t,o,h,l,c,v],...]   (.cache/dukascopy diske önbellek)
            └─ src/lib/feed.ts  Feed  (geçmiş + 1dk adım adım açılan mumlar)
                 └─ src/store.ts  useApp (Zustand)  processMinute(): dolum, SL/TP, kural kontrolü
                      ├─ src/lib/db.ts  IndexedDB (hesap, seans, işlem, ekran görüntüsü)
                      └─ src/views/*  ekranlar  ← src/components/ChartPanel.tsx + lib/chartController.ts
```

- Uç nokta hem `vite dev` hem `vite preview` içinde çalışır; launcher `preview` kullanır.
- Mumlar **bid** fiyatıdır. Ask = bid + spread ([[islem-motoru]]).

## Replay saati
- `Feed` her zaman diliminin geçmişini `base0` (başlangıçtan önceki 4s sınırı) öncesine kadar doğal çeker; `base0` sonrası her şey **1dk mumlardan yeniden kurulur**. Böylece gelecek hiçbir mum sızamaz.
- `step()` bir 1dk mumu açar; ileri veri arka planda `ensureAhead()` ile 2 günlük parçalarla indirilir.
- Store'daki `setPlaying` bir `requestAnimationFrame` döngüsüyle hıza göre `stepBar()` çağırır; `advanceToDayEnd()` prop gününün sonuna kadar 64'lü gruplarla ilerler.

## Olay kanalları (store.ts)
- `marketBus`: yeni mum/güncelleme → grafikler yeniden çizer.
- `fxBus`: dolum, TP, SL, yeni mum efektleri.
- `shooter`: grafiğin ekran görüntüsü fonksiyonu (işlem açılış/kapanışında).

## Ekranlar
`App.tsx` görünümleri tembel yükler: Panel (Dashboard), Yeni Hesap, İşlem (Trade), Günlük (Journal), İstatistik (Stats), Ayarlar, İşlem Tekrarı (Replay). Büyük anlar `views/Overlays.tsx`'te (funded, ihlal, seans sonu perdesi).
