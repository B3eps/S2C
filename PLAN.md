# S2C — Plan

## Kararlar
- **Ad:** S2C. Amblem radikal olacak.
- **Dil:** Türkçe.
- **Ekran:** Sadece bilgisayar.
- **İndikatörler:** TradingView'deki yerleşik indikatörlerin hepsi hedefleniyor. Aşamalı eklenecek: önce en çok kullanılanlar, sonra kalanlar. Ayarları açılıp kapatılabilir ve değiştirilebilir olacak.
- **Hafta sonu:** Hafta sonu mumları gizlenir.
- **Lot:** cTrader XAUUSD standardı. 1 lot = 100 ons, en küçük 0,01 lot.
- **Yedekleme:** Bilgisayara yedek dosyası olarak dışa ve içe aktarma.
- **Klasör:** C:\S2C

Kişisel gelişim için, sadece bu bilgisayarda çalışan sanal gold işlem ve prop firm simülasyonu.
Kural: Listede olmayan hiçbir özellik ya da yazı eklenmez. Değişiklikten önce onay alınır.

---

## 1. Ekranlar ve akış

```
Dashboard ──► Yeni Hesap (paket seç) ──► İşlem Ekranı ──► Seans Sonu
    ▲                                         │
    └──── İstatistik · Günlük · İşlem Tekrarı ◄┘
```

### 1.1 Dashboard (açılış ekranı)
- Hesap kartları: tip (Challenge / Funded), boyut, bakiye, durum (Aktif / Başarısız / Funded), kurallara göre ilerleme çubukları.
- Özet: toplam sanal çekim, aktif hesap sayısı, genel kazanma oranı.
- Isı haritası: tüm hesaplarda saat × gün başarısı.
- "Yeni hesap" butonu.
- Ödeme geçmişi listesi.

### 1.2 Yeni Hesap
- Paketler: 5k · 10k · 25k · 50k · 100k.
- Her kartta o paketin kuralları.
- Seçince hesap açılır ve işlem ekranına gidilir.

### 1.3 İşlem Ekranı
```
┌──────────────────────────────────────────────────────────────┐
│ Üst bar: hesap adı · bakiye · kural çubukları · seans saati  │
├──┬────────────────────────────────────────────┬──────────────┤
│Ç │                                            │ Emir paneli  │
│i │   Grafik (tek veya çoklu zaman dilimi)     │ Market/Limit │
│z │   indikatörler · çizimler · takvim işareti │ /Stop        │
│i │   emir/SL/TP çizgileri (sürüklenebilir)    │ Risk hesap.  │
│m │                                            │ Long / Short │
├──┴────────────────────────────────────────────┴──────────────┤
│ Replay kontrolü: ▶ ⏸ sonraki mum · hız · zaman dilimi        │
├──────────────────────────────────────────────────────────────┤
│ Alt sekmeler: Pozisyonlar · Bekleyen emirler · Geçmiş · Günlük│
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Seans Sonu
- Perde kalkar: gerçek tarih ve gerçek fiyat aralığı gösterilir.
- Seans özeti: işlem sayısı, kazanma oranı, toplam R, bakiye değişimi.

### 1.5 İstatistik
- Hesap bazında ve genel.
- Kazanma oranı, ortalama R, profit factor, maksimum düşüş, seriler.
- Bakiye eğrisi.
- Isı haritası (saat × gün, seans bazında).

### 1.6 Günlük
- İşlem listesi: her işlemde açılış ve kapanış ekran görüntüsü, notlar.
- Tıklayınca İşlem Tekrarı açılır.

### 1.7 İşlem Tekrarı
- Kapanmış işlemi grafikte baştan oynatır: giriş, SL/TP hareketleri, çıkış.

---

## 2. Özellikler (kategorilere göre)

### 2.1 Veri ve gizlilik
- Kaynak: Binance PAXG/USDT, gerçek gold mumları (ücretsiz, anahtar gerektirmez).
- Fiyat ekseni yok, tarih ve saat etiketi yok.
- Her seans geçmişte rastgele bir noktadan başlar.
- Kâr ve zarar sadece R, % ve sanal $ olarak gösterilir. Gold fiyatı hiç görünmez.

### 2.2 Replay
- Oynat / duraklat / sonraki mum / hız ayarı.
- Zaman dilimleri: 1m · 5m · 15m · 1h · 4h.

### 2.3 Grafik
- **İndikatörler:** Listeye bakılacak, bkz. Açık sorular. Değer etiketleri fiyat göstermez.
- **Çizim araçları:** Trend çizgisi, yatay seviye, kutu. Taşınabilir ve silinebilir.
- **Çoklu zaman dilimi:** İki grafik yan yana, aynı ana senkron.
- **Saat bilgisi:** Asya / Londra / New York seansı göstergesi, seans arka plan bantları.
- **Ekonomik takvim:** NFP, CPI, FOMC gibi olaylar mum üstünde işaret olarak görünür. Geçmiş tarihler için hazır olay listesi kullanılır.

### 2.4 Emirler
- **Tipler:** Market, Limit, Stop.
- **Grafikten emir:** Tıklanan fiyata emir konur.
- **Sürükle bırak:** Bekleyen emir, SL ve TP çizgileri sürüklenerek değiştirilir.
- **İptal:** Çizgi üstündeki ✕ ile.
- **Çizgi etiketi:** R, lot ve hesabın yüzdesi.
- **Risk hesaplayıcı:** Risk %'si seçilir, SL çekildikçe lot otomatik hesaplanır.

### 2.5 Hesap ve prop sistemi
- Challenge, ihlal (hesap kapanır) veya hedefe ulaşma (Funded), ardından ödeme talebi.
- Kurallar sonradan bem funding'den alınacak. O zamana kadar düzenlenebilir varsayılanlar:
  - Kâr hedefi %8
  - Günlük maksimum zarar %5
  - Toplam maksimum zarar %10
  - Kâr paylaşımı %80
- Kurallar her mumda anlık kontrol edilir.
- Firmanın adı ve logosu kullanılmaz.

### 2.6 Günlük ve ekran görüntüsü
- İşlem açılırken ve kapanırken grafik otomatik olarak fotoğraflanır.
- Her işleme not eklenebilir.

### 2.7 İstatistik ve ısı haritası
- Bölüm 1.5'teki metrikler.
- Isı haritası dashboard'da ve istatistik ekranında.

---

## 3. Tasarım ve efektler
- **Kimlik:** Koyu grafit zemin, sıcak altın vurgu. Rakamlar mono yazı tipiyle. Kendi kimliğimiz, kopya yok.
- **Düzen:** Klasik terminal düzeni (sol araçlar, orta grafik, sağ panel, alt sekmeler).
- **Efektler:**
  - Yeni mumda hafif parlama.
  - Emir ve pozisyon açılınca dalga efekti.
  - Kâr ve zarar sayılarak akar.
  - TP'de altın, SL'de kırmızı vuruş.
  - Kural çubukları sınıra yaklaşınca uyarı rengine döner.
  - "Funded oldun" kutlaması.
  - İhlal ekranı.
  - Ödeme onayı animasyonu.
  - Seans sonu perde açılışı.
- Arayüzde sadece işlev yazıları olacak, slogan veya dolgu metin yok.

### 3.1 Amblem ve ikonlar
- **Hazır set yok:** Hazır ikon seti veya emoji kullanılmayacak.
- **Amblem:** Uygulamanın amblemi özel olarak tasarlanacak.
  - Önce birkaç taslak hazırlanır, sen seçersin.
  - Sonra vektör (SVG) ve yüksek çözünürlüklü görsel olarak üretilir.
- **İkon seti:** Uygulamadaki her ikon tek bir çizgi diliyle çizilecek: aynı kalınlık, köşe ve ölçü sistemi. Bu, araç çubuğundan rozetlere kadar her yeri kapsar.
- **Rozetler:** Hesap durumu (Challenge, Funded, İhlal) ve başarı rozetleri de bu dilde özel çizilecek.

### 3.2 Sesler
- **Kaynak:** Hepsi özgün olacak. Web Audio ile sıfırdan sentezlenecek, hazır ses paketi kullanılmayacak.
- **Ses olayları:**
  - Emir verildi
  - Emir doldu
  - TP
  - SL
  - Kural uyarısı
  - İhlal
  - Funded
  - Ödeme onayı
  - Yeni mum (çok hafif, isteğe bağlı)
- **Karakter:** Tek bir ses ailesi, hepsi aynı tını karakterinde.
- **Ayarlar:** Ses seviyesi ayarlanabilir, sesler tamamen kapatılabilir.
- Her ses sana dinletilir, onaylanınca girer.

### 3.3 Animasyonlar
- **Kendi hareket dilimiz:** Tek bir yumuşama eğrisi ve süre ölçeği. Kontroller için kısa geçişler, büyük anlar (Funded, ihlal, seans sonu) için daha uzun sahneler.
- **Özgün sahneler:** Büyük anlar özel tasarlanacak: Funded kutlaması, ihlal, perde açılışı, ödeme.
- **Performans:** Akıcılık için sadece transform ve opacity kullanılacak. "Hareketi azalt" ayarına uyulacak.

### 3.4 Dashboard ve grafik tasarımı
- Dashboard kartları, ilerleme çubukları, bakiye eğrisi ve ısı haritası tek bir görsel sistemle tasarlanacak.
- Grafik detayları da bu sisteme göre özel ayarlanacak: mum renkleri, ızgara, imleç çizgisi, emir çizgileri, etiketler.

---

## 4. Teknik
- **Kod:** Vite + React + TypeScript.
- **Grafik:** TradingView Lightweight Charts (açık kaynak).
- **Kayıt:** Tarayıcıda yerel olarak, IndexedDB'de (hesaplar, işlemler, ekran görüntüleri, çizimler).
- **Çalıştırma:** `npm run dev` ile. İstenirse ileride .exe yapılabilir.
- **Skill'ler:**
  - impeccable: tasarım yönü, kalite kuralları, animate ve polish ile cilalama.
  - dataviz: grafik, istatistik ve ısı haritası.
  - Tarayıcı: her aşamada görsel kontrol.
  - Zaten yüklü:
    - media-use: amblem görseli üretmek ve ses dosyası dışa aktarmak için.
    - frontend-design.
  - GitHub'dan önerilen (kurulum senin onayınla):
    - ui-sound-design (dannyjpwilliams/ui-sound-design-skill, MIT): Tarifle Web Audio sesi üretir, tarayıcıda dinleterek ayarlar.
    - emilkowalski-motion (nexu-io/open-design): Ölçülü ve profesyonel mikro animasyon kuralları.
    - Ayrı bir ikon skill'i gerekmiyor. Mevcut SVG ikon skill'leri zayıf değerlendirildi, ikonlar impeccable kurallarıyla elle çizilecek.

---

## 5. Aşamalar
1. Tasarım yönü ve DESIGN.md, dashboard ile işlem ekranının statik taslağı. **Onay alınır.**
2. Veri, kör grafik, replay, çoklu zaman dilimi, saat bilgisi.
3. Emir motoru: market/limit/stop, sürükle bırak, SL/TP, risk hesaplayıcı.
4. Hesap ve prop sistemi: dashboard, paketler, kurallar, ihlal, funded, ödeme.
5. İndikatörler, çizim araçları, ekonomik takvim.
6. Günlük, ekran görüntüsü, işlem tekrarı, istatistik, ısı haritası, seans sonu.
7. Efektler ve cilalama, ardından test.

Her aşamanın sonunda sana gösterilir, onayınla sonrakine geçilir.

---

## 6. Açık sorular
- bem funding kuralları (sen getireceksin).
- Bilgisayarda Node.js kurulu mu? (kontrol edilecek)
