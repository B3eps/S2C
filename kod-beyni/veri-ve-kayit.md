---
tags: [s2c, kod, veri]
---

# Veri ve kayıt

## IndexedDB (`src/lib/db.ts`)
Veritabanı `s2c`, şema sürümü **2**.

| Depo | Anahtar | İçerik |
|---|---|---|
| `accounts` | `id` | `Account`: bakiye, kurallar (açıldığı andaki kopya), aşama, ödemeler, gün P&L'i |
| `sessions` | `id` | `SessionRec`: replay saati, açık emir/pozisyon, çizimler, gün başı özsermaye |
| `trades` | `id` (+ `accountId` indeksi) | Kapanmış `Trade`, ekran görüntüsü anahtarları |
| `shots` | dış anahtar | Ekran görüntüsü, WebP **Blob** (eski kayıtlar dataURL metni; `shot()` ikisini de dataURL döndürür) |
| `kv` | dış anahtar | `prefs`, `activeSetupId`, ayarlar, `lastBackupAt` |
| `setups` | `id` | Setup klasörleri (strateji ayırma) |

- İşlem kapanışı `commitClose` ile hesap + seans + işlem **tek işlemde** yazılır; replay kısıtlaması işlem kaybettirmez.
- Seans durumu her mumda değil, en geç 1 sn'de bir yazılır; duraklatma, sekme gizlenmesi ve sayfa kapanışında `flushSession` hemen yazar.
- Yeni bir depo eklemek → `openDB` sürümünü artır, `upgrade` içine `oldVersion < N` dalı ekle, `STORES` listesine ve yedek doğrulamasına ekle.

## Yedek
- Dışa aktarma: tüm depolar tek JSON (`app: 's2c', version: 2`), ekran görüntüleri dataURL olarak; dosya parça parça (`Blob` parçaları) yazılır, bellekte tek dev metin oluşmaz. `lastBackupAt` kaydedilir; 7 günü geçince panel uyarır. İçe aktarma önce `inspectBackup` ile **tamamen doğrular**, sonra depoları temizleyip yazar.
- Sürüm 1 yedekleri tek bir "İlk kurulum" setup klasörüne taşınır.
- Kayıt şekli değişirse `inspectBackup` doğrulamasını ve `test-core.mjs` yedek testlerini birlikte güncelle.

## Veri nerede yaşar
- Uygulama verisi tarayıcının içinde, `http://localhost:5199` kökenine bağlı. Port veya tarayıcı değişirse uygulama boş görünür.
- Mum önbelleği: `.cache/dukascopy` (git dışı, yüzlerce MB olabilir).
- Araştırma çıktıları: `analysis/` içinde yalnız `.md` raporlar git'te; ham `.json/.jsonl/.log/.csv` scriptlerle yeniden üretilir ve `.gitignore`'dadır.
