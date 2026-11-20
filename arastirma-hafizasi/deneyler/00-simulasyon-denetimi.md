# 00 · S2C simülasyon güvenilirliği

**Düzeltilen hata.** Önce bütün emirleri ve SL/TP çıkışlarını uygulayan akış, TP ile kapanıştan önce mümkün olan hesap ihlalini silebiliyordu. Açık kalan pozisyonlara bütün mumun uçlarını uygulamak da fiyatların gerçekleşme sırasını kaybediyordu. Simülatör şimdi bid fiyatında açılış–yüksek–düşük–kapanış ve açılış–düşük–yüksek–kapanış yollarını ayrı işler. Her fiyat hareketinde emir, koruma ve hesap eşikleri sırayla değerlendirilir. Bir yol ihlal ediyorsa ihtiyatlı oynatım onu seçer. Diğer durumlarda daha düşük kapanış özkaynağı ve ardından daha düşük mum içi özkaynak tercih edilir. Ara dönüşler içeren fiyat yolları bu iki örneğin dışında kalabilir; bunlar kesin sınır veya gerçekleşmiş sıra değildir.

- **Açılış ve boşluklar.** Açılışta yeni kotasyon bir sıçramadır. Fiyat arada işlem görmüş gibi çizilmez. Açılış özkaynağı önce kontrol edilir, sonra açık korumalar ve emirler gelir. Stop kayabilir, limit ve hedef gözlenen açılıştan iyileşebilir. Sürekli parçada zarar eşiği korumadan önce geride kalıyorsa tasfiye, eşik fiyatı üzerinden modellenir. Tam eşikteki stop/tetik gerçekleşebilir; komisyon sonrasında hesap yeniden kontrol edilir.
- **Aynı fiyat ve çoklu pozisyon.** Aynı senaryoda bütün pozisyonlar aynı bid kotasyonundan değerlenir. Short çıkışı ask, long girişi ask. Aynı anda eşleşen seviyelerde açık stoplar, hedefler ve sonra girişler işlenir. Dolum anında kullanılabilir kaldıraç yeniden ölçülür. Gerçekleşen çıkışlar yeterli marjı serbest bırakabilir. Orta fiyat veya birbirine uymayan long/short uçları birleştirilmez.
- **Maliyet ve FTM.** 100 ons/lot, taban 0,01 lot, sabit 0,20 $ spread, taraf başına %0,005 komisyon. Açık özkaynakta giriş komisyonu, realize sonuçta iki taraf komisyonu. FTM Infinity Plus $5.000, günlük $150 kayıp, statik toplam $250 kayıp, $500 hedef, 10× kaldıraç. Gün değişimi 22:00 UTC. Açılışta günlük referans S2C kuralına göre bakiye ile masraf sonrası işaretli özkaynağın yükseğidir. Operatörün market işlemi veya kapaması da görünür kotasyonda eşiği kontrol eder. Firma şartlarının güncel sürümü doğrulanmadı.
- **Veri ve gelecek.** M1 zaman damgası dizisi, kapanış kesimi, OHLC ve hacim kontrol edilir. S2C, 17:00–18:00 New York bakım arası ve hafta sonu dışında uzun veya kısa eksik dakika serilerini de işaretler. Tatil ve ince hacim belirsizliğini ayrıca sınıflandıramaz. Araştırmada eksik muma giriş ötelenmez, sinyal düşer ve bağlam sıfırlanır. Açık pozisyon için sonraki gözlenen kotasyon kullanılır. Gözlenebilir seans kapsamı eşiği, değerlendirme evrenini daraltır. Stratejiler sinyal için yalnız kapanmış, zamansal olarak bitişik M1 barları kullanır. 15 dakika, 4 saat ve günlük seri araştırma kararına dahil edilmedi.
- **Sınırlar.** Model sabit spread ve OHLC dolum varsayımlarını kullanır. Değişken spread, ek kayma, gerçek tik sırası, emir kuyruğu ve piyasa derinliği ölçülmedi. Eski işlem raporları ve önceden üretilen işlem kayıtları yeniden hesaplanmadı. Deney motoru S2C ile fiyat yolu, maliyet, marj ve hesap yardımcılarını paylaşır. Araştırmadaki sonraki açılış girişi tarayıcıdaki elle verilen görünür fiyat emrinden ayrı bir zamanlama kuralıdır.

## Doğrulama

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
node scripts/research/check-causality.mjs
```

46 çekirdek test, üretim derlemesi ve tarayıcı testi geçti. Tarayıcı testi yapay veriyle, geçici profilde ve yerel sunucuda çalıştı. Aynı mumda önce zarar sınırı ve sonra TP senaryosunu uygulamanın hesap statüsüne kadar doğruladı. Dört stratejide toplam 328 önek karşılaştırması, gelecekteki mumlar kaldırıldığında geçmiş sinyallerin değişmediğini gösterdi. Dört ayrılmış test yeniden koşuldu ve dört JSON çıktı özeti SHA-256 düzeyinde aynı kaldı.
