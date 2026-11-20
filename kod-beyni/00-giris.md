---
tags: [s2c, kod, pano]
---

# S2C · Kod Beyni

S2C: bilgisayarda çalışan kişisel **XAU/USD kör replay** ve **sanal prop hesap** simülatörü. Gerçek Dukascopy mumları geçmişten rastgele bir anda oynatılır; fiyat ve tarih oyun boyunca gizlidir. Tek kullanıcı, Türkçe arayüz, sadece masaüstü tarayıcı.

Bu kasa kodun **haritasıdır**, kopyası değil. Bir göreve başlarken bu notu oku, sonra yalnız ilgili tek notu aç. Kodda zaten tek komutla bulunabilen şeyler (script listesi `package.json`'da, renkler `src/styles/tokens.css`'te) burada tekrarlanmaz.

| Görev | Açılacak not |
|---|---|
| Veri nereden gelir, ekrana nasıl akar | [[mimari]] |
| Hangi dosya ne yapar | [[dosya-haritasi]] |
| IndexedDB, yedek, kayıt biçimi | [[veri-ve-kayit]] |
| Emir dolumu, SL/TP, spread, prop kuralları | [[islem-motoru]] |
| Parça Setup / Gold sinyal motorları | [[parca-sinyalleri]] |
| Bozulmaması gereken kurallar ve tuzaklar | [[degismezler]] |
| Bilinen sorunlar ve yapılacaklar | [[iyilestirmeler]] |

Piyasa, strateji ve deney araştırması bu kasada değil: `../arastirma-hafizasi/pano.md` ile başla (ayrı Obsidian kasası).

Kapsam: notlar 20 Kasım 2026'daki `parca-setup-ve-veri-duzeltmeleri` dalı ve üzerindeki kaydedilmemiş değişikliklere göre yazıldı (Parça, FTM, spread, `market.ts` dahil).

## Çalıştırma
- Kullanıcı: `S2C.bat` → `scripts/launch.mjs` → `http://localhost:5199` (sabit port, veriler bu adrese bağlı).
- Geliştirme: `npm run dev` → `:5198` (ayrı veri). Testler: `npm test` (çekirdek, `scripts/test-core.mjs`), `npm run typecheck`, `npm run build`, `npm run test:browser` (Chrome gerekir).

## Kasayı güncel tutma
İş sonunda yalnız değişen gerçeği yaz: yeni modül → [[dosya-haritasi]]; yeni kural/tuzak → [[degismezler]]; çözülen madde → [[iyilestirmeler]]'den sil. Eskiyen satırı bırakma, sil.
