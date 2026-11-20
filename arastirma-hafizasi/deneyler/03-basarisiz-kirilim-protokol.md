# Başarısız kırılım ve geri dönüş protokolü

19 Kasım 2026. Açılış aralığı raporundan sonra, bu deneyin sonuçları açılmadan önce kaydedildi. Ayrılmış dönem [[donem-kaydi]]. 3 Kasım önceden çıkarıldı.

- Hipotez, son 60 kapanmış M1'in dışına çıkan ve aynı mumda aralığa geri kapanan fiyatın kısa süreli ters yön hareketi üretebilmesidir. Hareketli 60 dakikalık kanal, açılış aralığı ve Fibonacci salınımlarından bağımsız tanımlanır.
- 08:00–16:00 UTC. Kanal en az 4 ATR genişliğinde. Long için mum dibi alt sınırı en az 0,15 ATR aşmalı ve kapanış alt sınırın en az 0,10 ATR üzerine dönmeli. Short simetriktir. İki sınırı birden aşan mum elenir. Aynı yönde sonraki kurulum için 45 M1 beklenir.
- Birincil varyant geri dönüş kapanışından sonra girer. Karşılaştırma, sonraki üç M1 içinde ilk geri dönüş mumunun karşı ucunu kapanışla aşmayı bekler. Teyit öncesi ilk uç fiyat tekrar aşıldığında bekleme iptal olur. Stop taranan uç fiyatın 0,20 ATR ötesinde ve hedef 1,5 brüt R. Giriş sonraki bitişik M1 açılışında. Ortak risk ve seans yönetimi [[01-fibonacci-protokol]].
